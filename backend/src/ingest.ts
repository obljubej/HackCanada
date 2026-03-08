import crypto from "crypto";
import { google } from "googleapis";
import { Type } from "@google/genai";
import { supabase, ai } from "./config.js";

// ── Known users ──────────────────────────────────────────────────────

// Fetch known users dynamically from the profiles table in Supabase.
// Uses the full_name column as the user identifier for memory routing.
let cachedUsers: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

export async function getKnownUsers(): Promise<string[]> {
  const now = Date.now();
  if (cachedUsers && now - cacheTimestamp < CACHE_TTL) return cachedUsers;

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name")
    .not("full_name", "is", null);

  if (error) {
    console.warn("[users] Failed to fetch profiles:", error.message);
    return cachedUsers || ["default-user"];
  }

  const users = (data || [])
    .map((row: any) => row.full_name as string)
    .filter(Boolean);

  // Always include "default-user" so legacy memories remain accessible
  if (!users.includes("default-user")) {
    users.unshift("default-user");
  }
  cachedUsers = users;
  cacheTimestamp = now;
  console.log(`[users] Known users: ${cachedUsers.join(", ")}`);
  return cachedUsers;
}

// ── Helpers ──────────────────────────────────────────────────────────

export function extractDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function isDriveFolderUrl(url: string): boolean {
  return /\/folders\/|\/drive\/.*folders\//.test(url);
}

function createDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

export async function listFolderFiles(folderId: string, accessToken: string) {
  const drive = createDriveClient(accessToken);
  const files: { id: string; name: string; mimeType: string; webViewLink: string }[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, webViewLink)",
      pageSize: 100,
      pageToken,
    });
    for (const f of res.data.files ?? []) {
      files.push({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        webViewLink: f.webViewLink ?? "",
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

function chunkText(text: string, size = 1200, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - overlap;
  }
  return chunks;
}

// ── Drive fetch ──────────────────────────────────────────────────────

export async function fetchDriveText(
  fileId: string,
  accessToken: string
) {
  const drive = createDriveClient(accessToken);

  const meta = await drive.files.get({
    fileId,
    fields:
      "id,name,mimeType,modifiedTime,owners(displayName,emailAddress),webViewLink",
  });

  const file = meta.data;
  const mimeType = file.mimeType as string;

  let text = "";

  if (mimeType === "application/vnd.google-apps.document") {
    const exportRes = await drive.files.export(
      { fileId, mimeType: "text/plain" },
      { responseType: "text" }
    );
    text = exportRes.data as string;
  } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
    const exportRes = await drive.files.export(
      { fileId, mimeType: "text/csv" },
      { responseType: "text" }
    );
    text = exportRes.data as string;
  } else if (mimeType === "application/vnd.google-apps.presentation") {
    const exportRes = await drive.files.export(
      { fileId, mimeType: "text/plain" },
      { responseType: "text" }
    );
    text = exportRes.data as string;
  } else {
    throw new Error(`Unsupported mime type: ${mimeType}`);
  }

  return {
    title: file.name ?? "Untitled",
    mimeType,
    sourceUrl: file.webViewLink ?? "",
    metadata: file,
    text,
  };
}

// ── Gemini extraction ────────────────────────────────────────────────

const memorySchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    document_summary: { type: Type.STRING },
    memories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          memory_type: { type: Type.STRING },
          content: { type: Type.STRING },
          weight: { type: Type.NUMBER },
          confidence: { type: Type.NUMBER },
          salience: { type: Type.NUMBER },
          recency_score: { type: Type.NUMBER },
          source_span: {
            type: Type.OBJECT,
            properties: {
              start_char: { type: Type.NUMBER },
              end_char: { type: Type.NUMBER },
            },
            required: ["start_char", "end_char"],
          },
          metadata: {
            type: Type.OBJECT,
            properties: {
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              entities: { type: Type.ARRAY, items: { type: Type.STRING } },
              dates: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
          relevant_users: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: [
          "memory_type",
          "content",
          "weight",
          "confidence",
          "salience",
          "recency_score",
          "source_span",
          "metadata",
          "relevant_users",
        ],
      },
    },
  },
  required: ["title", "document_summary", "memories"],
};

function buildSystemPrompt(knownUsers: string[]): string {
  const userList = knownUsers.map((u: string) => `  - "${u}"`).join("\n");

  return `You are a structured memory extraction engine.

Your job is to read a document and extract durable, useful memories for a personal memory layer.

Extract memories into exactly these categories:
- fact
- task
- project
- preference
- person
- summary
- skill

Scoring rules:
- weight: future usefulness for retrieval, from 0.0 to 1.0
- confidence: how directly supported by the document, from 0.0 to 1.0
- salience: importance inside this document, from 0.0 to 1.0
- recency_score: how current the information appears, from 0.0 to 1.0

Known users in the system:
${userList}

User routing rules for relevant_users:
- For each memory, set relevant_users to the list of known user IDs it is most relevant to.
- If a memory is specifically about a person (e.g., their role, preference, task), route it to that person's user ID.
- If a memory is general knowledge (e.g., a project fact, company info, shared context), route it to ALL known users.
- If a memory mentions multiple people, route it to each mentioned person.
- Only use user IDs from the known users list above. Never invent new user IDs.
- When in doubt, route to all known users — it's better to over-share than to miss.

Rules:
- Do not invent information.
- Prefer durable knowledge over filler.
- Merge near-duplicates.
- Keep content concise and retrieval-friendly.
- Always include exactly one summary item if there is meaningful content.
- If the document is low-value, return fewer memories.`;
}

async function extractMemories(
  title: string,
  mimeType: string,
  sourceUrl: string,
  text: string,
  knownUsers: string[]
) {
  const prompt = `Extract durable memory objects from this Google Drive document.

Document metadata:
- title: ${title}
- mime_type: ${mimeType}
- source_url: ${sourceUrl}

Document text:
${text}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: memorySchema,
      systemInstruction: buildSystemPrompt(knownUsers),
    },
  });

  return JSON.parse(response.text!);
}

// ── Embeddings ───────────────────────────────────────────────────────

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const res = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: texts.map((text) => ({ parts: [{ text }] })),
  });
  return res.embeddings!.map((e: any) => e.values);
}

async function ingestTextSource(params: {
  userId: string;
  source: string;
  sourceFileId: string;
  sourceUrl: string;
  title: string;
  mimeType: string;
  text: string;
  metadata: any;
}) {
  const knownUsers = await getKnownUsers();
  console.log(`[ingest] Routing to known users: ${knownUsers.join(", ")}`);

  const checksum = crypto.createHash("sha256").update(params.text).digest("hex");

  const { data: sourceRow, error: sourceErr } = await supabase
    .from("source_documents")
    .upsert(
      {
        user_id: params.userId,
        source: params.source,
        source_file_id: params.sourceFileId,
        source_url: params.sourceUrl,
        title: params.title,
        mime_type: params.mimeType,
        raw_text: params.text,
        checksum,
        metadata: params.metadata,
      },
      { onConflict: "user_id,source_file_id" }
    )
    .select()
    .single();

  if (sourceErr) throw sourceErr;
  console.log(`[ingest] Source document stored: ${sourceRow.id}`);

  console.log("[ingest] Extracting memories with Gemini...");
  const extracted = await extractMemories(
    params.title,
    params.mimeType,
    params.sourceUrl,
    params.text,
    knownUsers
  );
  console.log(`[ingest] Extracted ${extracted.memories.length} memories`);

  console.log("[ingest] Generating memory embeddings...");
  const memoryEmbeddings = await embedTexts(
    extracted.memories.map((m: any) => m.content)
  );

  const memoryRows: any[] = [];
  for (let i = 0; i < extracted.memories.length; i++) {
    const m = extracted.memories[i];
    let targetUsers: string[] = (m.relevant_users || []).filter(
      (u: string) => knownUsers.includes(u)
    );
    if (targetUsers.length === 0) {
      targetUsers = [params.userId];
    }
    for (const uid of targetUsers) {
      memoryRows.push({
        user_id: uid,
        document_id: sourceRow.id,
        memory_type: m.memory_type,
        content: m.content,
        weight: m.weight,
        confidence: m.confidence,
        salience: m.salience,
        recency_score: m.recency_score,
        source_span: m.source_span,
        metadata: m.metadata,
        embedding: memoryEmbeddings[i],
      });
    }
  }

  await supabase.from("memory_items").delete().eq("document_id", sourceRow.id);
  const { error: memErr } = await supabase.from("memory_items").insert(memoryRows);
  if (memErr) throw memErr;

  const userBreakdown = knownUsers
    .map((u) => `${u}: ${memoryRows.filter((r) => r.user_id === u).length}`)
    .join(", ");
  console.log(`[ingest] Inserted ${memoryRows.length} memories (${userBreakdown})`);

  console.log("[ingest] Chunking and embedding document...");
  const chunks = chunkText(params.text);
  const chunkEmbeddings = await embedTexts(chunks);
  const chunkRows = chunks.map((content, idx) => ({
    document_id: sourceRow.id,
    user_id: params.userId,
    chunk_index: idx,
    content,
    token_estimate: Math.ceil(content.length / 4),
    metadata: { title: params.title },
    embedding: chunkEmbeddings[idx],
  }));

  await supabase.from("document_chunks").delete().eq("document_id", sourceRow.id);
  const { error: chunkErr } = await supabase.from("document_chunks").insert(chunkRows);
  if (chunkErr) throw chunkErr;
  console.log(`[ingest] Inserted ${chunkRows.length} chunks`);

  return {
    documentId: sourceRow.id,
    title: params.title,
    summary: extracted.document_summary,
    memoriesInserted: memoryRows.length,
    chunksInserted: chunkRows.length,
  };
}

const GITHUB_TEXT_EXTENSIONS = new Set([
  ".md", ".txt", ".json", ".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".go", ".rs", ".rb", ".php", ".cs", ".cpp", ".c", ".h", ".hpp", ".sql", ".yml", ".yaml", ".toml", ".ini", ".env", ".html", ".css", ".scss", ".xml", ".csv", ".sh", ".bat", ".ps1",
]);

function isLikelyTextPath(path: string): boolean {
  const lower = path.toLowerCase();
  if (lower.includes("/node_modules/") || lower.includes("/.git/")) return false;
  const dot = lower.lastIndexOf(".");
  if (dot === -1) return false;
  const ext = lower.slice(dot);
  return GITHUB_TEXT_EXTENSIONS.has(ext);
}

function parseGithubRepoUrl(repoUrl: string): { owner: string; repo: string; branch?: string; subPath?: string } {
  const m = repoUrl.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/tree\/([^\/]+)(?:\/(.*))?)?\/?$/i);
  if (!m) throw new Error("Invalid GitHub repo URL");
  return {
    owner: m[1],
    repo: m[2],
    branch: m[3],
    subPath: m[4],
  };
}

async function githubRequest(path: string) {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "relai-ingestor",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub API ${res.status}: ${txt}`);
  }
  return res.json();
}

export async function ingestGithubRepo(params: {
  userId: string;
  repoUrl: string;
  branch?: string;
  maxFiles?: number;
}) {
  const { owner, repo, branch: parsedBranch, subPath } = parseGithubRepoUrl(params.repoUrl);
  const repoMeta = await githubRequest(`/repos/${owner}/${repo}`);
  const branch = params.branch || parsedBranch || repoMeta.default_branch;

  console.log(`[github] Listing files for ${owner}/${repo}@${branch}...`);
  const tree = await githubRequest(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  const files = (tree.tree || [])
    .filter((n: any) => n.type === "blob")
    .map((n: any) => n.path as string)
    .filter((p: string) => isLikelyTextPath(p))
    .filter((p: string) => !subPath || p.startsWith(subPath));

  const maxFiles = Math.min(params.maxFiles ?? 40, 200);
  const selected = files.slice(0, maxFiles);
  console.log(`[github] ${selected.length} text files selected for ingestion`);

  const results: any[] = [];
  const errors: any[] = [];

  for (const filePath of selected) {
    try {
      const contentData = await githubRequest(
        `/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`
      );
      if (!contentData || Array.isArray(contentData) || !contentData.content) continue;

      const text = Buffer.from(contentData.content, "base64").toString("utf-8");
      if (!text.trim() || text.includes("\u0000")) continue;

      const result = await ingestTextSource({
        userId: params.userId,
        // Keep source compatible with current DB check constraint.
        // GitHub origin is still preserved in metadata/source_file_id/source_url.
        source: "gdrive",
        sourceFileId: `${owner}/${repo}:${branch}:${filePath}`,
        sourceUrl: `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`,
        title: `${owner}/${repo}/${filePath}`,
        mimeType: "text/plain",
        text,
        metadata: {
          owner,
          repo,
          branch,
          path: filePath,
          sha: contentData.sha,
        },
      });
      results.push(result);
    } catch (err: any) {
      console.error(`[github] Failed ${filePath}:`, err.message);
      errors.push({ file: filePath, error: err.message });
    }
  }

  return {
    owner,
    repo,
    branch,
    totalFiles: files.length,
    selectedFiles: selected.length,
    ingested: results.length,
    failed: errors.length,
    results,
    errors,
  };
}

// ── Main pipeline ────────────────────────────────────────────────────

export async function ingestDriveLink(params: {
  userId: string;
  driveUrl: string;
  accessToken: string;
}) {
  const fileId = extractDriveFileId(params.driveUrl);
  if (!fileId)
    throw new Error("Could not extract file ID from Google Drive URL.");

  console.log(`[ingest] Fetching Drive file ${fileId}...`);
  const doc = await fetchDriveText(fileId, params.accessToken);
  console.log(`[ingest] Got "${doc.title}" (${doc.text.length} chars)`);
  return ingestTextSource({
    userId: params.userId,
    source: "gdrive",
    sourceFileId: fileId,
    sourceUrl: doc.sourceUrl || params.driveUrl,
    title: doc.title,
    mimeType: doc.mimeType,
    text: doc.text,
    metadata: doc.metadata,
  });
}

// ── Folder ingestion ─────────────────────────────────────────────────

const SUPPORTED_MIME_TYPES = [
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
];

export async function ingestDriveFolder(params: {
  userId: string;
  folderUrl: string;
  accessToken: string;
}) {
  const folderId = extractDriveFileId(params.folderUrl);
  if (!folderId) throw new Error("Could not extract folder ID from URL.");

  console.log(`[folder] Listing files in folder ${folderId}...`);
  const files = await listFolderFiles(folderId, params.accessToken);
  console.log(`[folder] Found ${files.length} files`);

  const supported = files.filter((f) => SUPPORTED_MIME_TYPES.includes(f.mimeType));
  console.log(`[folder] ${supported.length} supported files to ingest`);

  const results: any[] = [];
  const errors: any[] = [];

  for (const file of supported) {
    try {
      console.log(`[folder] Ingesting "${file.name}"...`);
      const result = await ingestDriveLink({
        userId: params.userId,
        driveUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}`,
        accessToken: params.accessToken,
      });
      results.push(result);
    } catch (err: any) {
      console.error(`[folder] Failed to ingest "${file.name}":`, err.message);
      errors.push({ file: file.name, error: err.message });
    }
  }

  return {
    totalFiles: files.length,
    supportedFiles: supported.length,
    ingested: results.length,
    failed: errors.length,
    results,
    errors,
  };
}

export async function ingestGithubCommit(params: {
  userId: string;
  owner: string;
  repo: string;
  commitId: string;
}) {
  console.log(`[ingest/github] Fetching commit ${params.commitId} from ${params.owner}/${params.repo}...`);
  const data = await githubRequest(`/repos/${params.owner}/${params.repo}/commits/${params.commitId}`);
  if (!data || !data.files) return;
  
  let commitText = `GitHub Commit by ${params.userId} in ${params.owner}/${params.repo} (Commit: ${params.commitId})\n`;
  commitText += `Message: ${data.commit?.message || "No message"}\n\n`;
  
  let processed = 0;
  for (const file of data.files) {
    if (processed >= 20) break;
    if (!file.patch || file.patch.length > 200000) continue;
    commitText += `File: ${file.filename}\nPatch:\n${file.patch}\n\n`;
    processed++;
  }

  console.log(`[ingest/github] Parsing commit diffs via Backboard Memory Pipeline...`);
  await ingestTextSource({
    userId: params.userId,
    source: "gdrive",
    sourceFileId: params.commitId,
    sourceUrl: data.html_url || `https://github.com/${params.owner}/${params.repo}/commit/${params.commitId}`,
    title: `Commit ${params.commitId.slice(0, 7)} in ${params.repo}`,
    mimeType: "text/plain",
    text: commitText,
    metadata: { owner: params.owner, repo: params.repo, commitId: params.commitId }
  });
}
