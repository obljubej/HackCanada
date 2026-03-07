import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { createOAuth2Client } from "./config.js";
import { ingestDriveLink, ingestDriveFolder, isDriveFolderUrl } from "./ingest.js";
import { searchMemories } from "./search.js";
import { askQuestion, resetThread } from "./ask.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

// Serve the chat UI
app.use(express.static(path.join(__dirname, "..", "public")));

// In-memory token store (for hackathon MVP — one user)
let storedTokens: { access_token: string; refresh_token?: string } | null =
  null;

// ── OAuth routes ─────────────────────────────────────────────────────

// Step 1: Visit this URL in your browser to start the OAuth flow
app.get("/oauth/login", (_req, res) => {
  const oauth2 = createOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
  res.redirect(url);
});

// Step 2: Google redirects here after user consents
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
    res.send(
      `<h2>Google Drive connected!</h2>
       <p>You can now ingest documents.</p>
       <p>Try: <code>POST /ingest</code> with <code>{"driveUrl": "https://docs.google.com/document/d/..."}</code></p>`
    );
  } catch (err: any) {
    console.error("[oauth] Token exchange failed:", err.message);
    res.status(500).send("OAuth token exchange failed: " + err.message);
  }
});

// Check if connected
app.get("/oauth/status", (_req, res) => {
  res.json({ connected: !!storedTokens });
});

// ── Ingest route ─────────────────────────────────────────────────────

app.post("/ingest", async (req, res) => {
  if (!storedTokens) {
    res
      .status(401)
      .json({ error: "Not connected to Google. Visit /oauth/login first." });
    return;
  }

  const { driveUrl, userId = "default-user" } = req.body;
  if (!driveUrl) {
    res.status(400).json({ error: "driveUrl is required" });
    return;
  }

  try {
    if (isDriveFolderUrl(driveUrl)) {
      const result = await ingestDriveFolder({
        userId,
        folderUrl: driveUrl,
        accessToken: storedTokens.access_token,
      });
      res.json({ success: true, ...result });
    } else {
      const result = await ingestDriveLink({
        userId,
        driveUrl,
        accessToken: storedTokens.access_token,
      });
      res.json({ success: true, ...result });
    }
  } catch (err: any) {
    console.error("[ingest] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Search route ─────────────────────────────────────────────────────

app.post("/search", async (req, res) => {
  const { query, userId = "default-user" } = req.body;
  if (!query) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  try {
    const results = await searchMemories(userId, query);
    res.json({ results });
  } catch (err: any) {
    console.error("[search] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Ask route (Backboard integration) ────────────────────────────────

app.post("/ask", async (req, res) => {
  const { question, userId = "default-user", threadId } = req.body;
  if (!question) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  try {
    const result = await askQuestion(userId, question, threadId);
    res.json(result);
  } catch (err: any) {
    console.error("[ask] Error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/ask/reset", (req, res) => {
  const { userId = "default-user" } = req.body;
  resetThread(userId);
  res.json({ success: true });
});

// ── Health check ─────────────────────────────────────────────────────

app.get("/api/status", (_req, res) => {
  res.json({
    status: "ok",
    routes: {
      "GET /": "Chat UI",
      "GET /oauth/login": "Start Google OAuth flow",
      "GET /oauth/status": "Check if Google is connected",
      "POST /ingest": "Ingest a Google Drive doc or folder { driveUrl }",
      "POST /search": "Search memories { query }",
      "POST /ask": "Ask a question { question, userId?, threadId? }",
      "POST /ask/reset": "Reset conversation thread { userId? }",
    },
  });
});

// ── Start ────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Memory Layer running on http://localhost:${PORT}`);
  console.log(`  Chat UI:    http://localhost:${PORT}/`);
  console.log(`  OAuth:      http://localhost:${PORT}/oauth/login`);
  console.log(`  API status: http://localhost:${PORT}/api/status\n`);
});
