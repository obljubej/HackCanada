import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { createOAuth2Client } from "./config.js";
import { ingestDriveLink, ingestDriveFolder, ingestGithubRepo, ingestGithubCommit, ingestPersonalClaim, isDriveFolderUrl, getKnownUsers } from "./ingest.js";
import { searchMemories } from "./search.js";
import { askQuestion, resetThread } from "./ask.js";
import { meetingsRouter } from "./meetings.js";
import { voiceRouter } from "./voice.js";
import { aiRouter } from "./ai-endpoints.js";
import organizationRouter from "./organization.js";

const app = express();
app.use(express.json());
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  credentials: true,
}));

// In-memory token store (for hackathon MVP — one user)
let storedTokens: { access_token: string; refresh_token?: string } | null =
  null;

// ── OAuth routes ─────────────────────────────────────────────────────

app.get("/oauth/login", (_req, res) => {
  const oauth2 = createOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  res.redirect(url);
});

app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    res.status(400).send("Missing authorization code");
    return;
  }

  try {
    const oauth2 = createOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    storedTokens = {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token ?? undefined,
    };

    console.log("[oauth] Tokens stored successfully");
    // Redirect back to the frontend after OAuth
    res.redirect("http://localhost:3000/dashboard");
  } catch (err: any) {
    console.error("[oauth] Token exchange failed:", err.message);
    res.status(500).send("OAuth token exchange failed: " + err.message);
  }
});

// ── API Routes ─────────────────────────────────────────────────────────

const apiRouter = express.Router();

apiRouter.use("/meetings", meetingsRouter);
apiRouter.use("/voice", voiceRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/organization", organizationRouter);

apiRouter.get("/oauth/status", (_req, res) => {
  res.json({ connected: !!storedTokens });
});

apiRouter.post("/ingest", async (req, res) => {
  if (!storedTokens) {
    res.status(401).json({ error: "Not connected to Google. Visit /oauth/login first." });
    return;
  }
  const { driveUrl, userId = "default-user" } = req.body;
  if (!driveUrl) {
    res.status(400).json({ error: "driveUrl is required" });
    return;
  }
  try {
    if (isDriveFolderUrl(driveUrl)) {
      const result = await ingestDriveFolder({ userId, folderUrl: driveUrl, accessToken: storedTokens.access_token });
      res.json({ success: true, ...result });
    } else {
      const result = await ingestDriveLink({ userId, driveUrl, accessToken: storedTokens.access_token });
      res.json({ success: true, ...result });
    }
  } catch (err: any) {
    console.error("[ingest] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/ingest/github", async (req, res) => {
  const { repoUrl, userId = "default-user", branch, maxFiles } = req.body;
  if (!repoUrl) {
    res.status(400).json({ error: "repoUrl is required" });
    return;
  }

  try {
    const result = await ingestGithubRepo({
      userId,
      repoUrl,
      branch,
      maxFiles,
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[ingest/github] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GitHub OAuth Login Flow ──────────────────────────────────────────

app.get("/api/github/oauth/login", (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).send("GitHub OAuth is not configured. Missing GITHUB_CLIENT_ID.");
    return;
  }
  
  const redirectUri = encodeURIComponent("http://localhost:5000/api/github/oauth/callback");
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo`;
  
  res.redirect(url);
});

app.get("/api/github/oauth/callback", async (req, res) => {
  const code = req.query.code as string;
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!code || !clientId || !clientSecret) {
    res.status(400).send("Invalid OAuth callback parameters or missing enviroment configuration.");
    return;
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    });
    
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    
    if (!accessToken) {
      throw new Error("Failed to retrieve access token from GitHub.");
    }

    // 2. Fetch authenticated user profile
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });
    
    const userData = await userRes.json();
    const githubUsername = userData.login;
    
    if (!githubUsername) {
      throw new Error("Failed to retrieve username from GitHub.");
    }
    
    console.log(`[github/oauth] Successfully authenticated user: ${githubUsername}`);
    
    // 3. Queue their repos for Background Ingestion seamlessly!
    // (We reuse the existing logic by triggering the same fetch)
    const reposRes = await fetch(`https://api.github.com/users/${githubUsername}/repos?sort=updated&per_page=5`);
    if (reposRes.ok) {
        const repos = await reposRes.json();
        const userId = "default-user"; // Tie to identical dummy user map used by Hackathon frontend
        
        if (Array.isArray(repos) && repos.length > 0) {
           Promise.allSettled(repos.map(async (repo: any) => {
             try {
               console.log(`[github/oauth] Queuing extraction for ${repo.html_url}`);
               await ingestGithubRepo({
                 userId,
                 repoUrl: repo.html_url,
                 branch: repo.default_branch,
                 maxFiles: 20,
                 oauthToken: accessToken
               });
             } catch (e) {
               console.error(`[github/oauth] Error extracting ${repo.html_url}:`, e);
             }
           }));
        }
    }

    // Redirect the user back to the chat interface natively
    res.redirect("http://localhost:3000/dashboard/chat?github_connected=true");

  } catch (err: any) {
    console.error("[github/oauth] Token exchange failed:", err.message);
    res.status(500).send("GitHub OAuth sequence failed: " + err.message);
  }
});

// ── GitHub Account Connection (Automatic Repos Fetch) ─────────────────

app.post("/api/github/connect", async (req, res) => {
  const { githubUsername, userId = "default-user" } = req.body;
  if (!githubUsername) {
    res.status(400).json({ error: "githubUsername is required" });
    return;
  }

  try {
    console.log(`[github/connect] Fetching repositories for ${githubUsername}...`);
    // Fetch public repos for the user natively
    const reposRes = await fetch(`https://api.github.com/users/${githubUsername}/repos?sort=updated&per_page=5`);
    if (!reposRes.ok) throw new Error(`GitHub API error: ${reposRes.statusText}`);
    const repos = await reposRes.json();

    if (!Array.isArray(repos) || repos.length === 0) {
      res.json({ success: true, message: "No public repositories found.", ingested: 0 });
      return;
    }

    // In background, ingest up to 5 recently updated repos
    Promise.allSettled(repos.map(async (repo: any) => {
      try {
        console.log(`[github/connect] Queuing extraction for ${repo.html_url}`);
        await ingestGithubRepo({
          userId,
          repoUrl: repo.html_url,
          branch: repo.default_branch,
          maxFiles: 20 // Process max 20 relevant files per repo
        });
      } catch (e) {
        console.error(`[github/connect] Error extracting ${repo.html_url}:`, e);
      }
    }));

    res.json({ 
      success: true, 
      message: `Successfully connected! Queued ${repos.length} repositories for Backboard AI skill extraction.`,
      reposCount: repos.length
    });
  } catch (err: any) {
    console.error("[github/connect] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GitHub Push Webhook (Automatic Skill Extraction) ─────────────────

app.post("/api/github/webhook", async (req, res) => {
  const payload = req.body;
  
  // Acknowledge receipt immediately to avoid GitHub timeout
  res.status(200).send("Webhook received");

  if (!payload.commits || !payload.repository) return;

  const commits = payload.commits;
  const repo = payload.repository.name;
  const owner = payload.repository.owner.login;

  // Assuming pusher/sender is the mapped user. In production, map github username -> user_id
  const githubUsername = payload.sender?.login || "default-user";
  const userId = githubUsername; // Basic dummy map, normally a lookup to profiles table

  try {
    for (const commit of commits) {
      await ingestGithubCommit({
         userId,
         owner,
         repo,
         commitId: commit.id
      });
    }
  } catch (err) {
    console.error("[github/webhook] Extraction Error:", err);
  }
});

// ── Search route ─────────────────────────────────────────────────────

app.post("/search", async (req, res) => {
  const { query, userId = "default-user" } = req.body;
  if (!query) { res.status(400).json({ error: "query is required" }); return; }
  try {
    const results = await searchMemories(userId, query);
    res.json({ results });
  } catch (err: any) {
    console.error("[search] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/ask", async (req, res) => {
  const { question, userId = "default-user", threadId } = req.body;
  if (!question) { res.status(400).json({ error: "question is required" }); return; }
  try {
    const result = await askQuestion(userId, question, threadId);
    res.json(result);
  } catch (err: any) {
    console.error("[ask] Error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

apiRouter.post("/ask/reset", (req, res) => {
  const { userId = "default-user" } = req.body;
  resetThread(userId);
  res.json({ success: true });
});

apiRouter.post("/claims", async (req, res) => {
  const { userId = "default-user", claim, claimType } = req.body;
  if (!claim || typeof claim !== "string") {
    res.status(400).json({ error: "claim is required" });
    return;
  }

  try {
    const result = await ingestPersonalClaim({
      userId,
      claim,
      claimType,
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[claims] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/users", async (_req, res) => {
  try {
    const users = await getKnownUsers();
    res.json({ users });
  } catch (err: any) {
    console.error("[users] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.use("/api", apiRouter);

// ── Health / status ──────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.json({
    name: "RelAI Backend",
    status: "ok",
    routes: {
      "GET /oauth/login": "Start Google OAuth flow",
      "GET /api/oauth/status": "Check if Google is connected",
      "POST /api/ingest": "Ingest a Google Drive doc or folder { driveUrl }",
      "POST /api/search": "Search memories { query }",
      "POST /api/ask": "Ask a question { question, userId?, threadId? }",
      "POST /api/ask/reset": "Reset conversation thread { userId? }",
      "GET /api/meetings": "Meeting endpoints",
    },
  });
});

// ── Start ────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n  RelAI Backend running on http://localhost:${PORT}`);
  console.log(`  OAuth:  http://localhost:${PORT}/oauth/login`);
  console.log(`  Status: http://localhost:${PORT}/`);
  console.log(`  Frontend should run on http://localhost:3000\n`);
});
