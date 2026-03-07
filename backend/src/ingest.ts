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
    model: "gemini-2.0-flash",
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

// ── Main pipeline ────────────────────────────────────────────────────

export async function ingestDriveLink(params: {
  userId: string;
  driveUrl: string;
  accessToken: string;
}) {
  const fileId = extractDriveFileId(params.driveUrl);
  if (!fileId)
    throw new Error("Could not extract file ID from Google Drive URL.");

  // Fetch known users for memory routing
  const knownUsers = await getKnownUsers();
  console.log(`[ingest] Routing to known users: ${knownUsers.join(", ")}`);

  console.log(`[ingest] Fetching Drive file ${fileId}...`);
  const doc = await fetchDriveText(fileId, params.accessToken);
  console.log(`[ingest] Got "${doc.title}" (${doc.text.length} chars)`);

  const checksum = crypto.createHash("sha256").update(doc.text).digest("hex");

  // Upsert source document
  const { data: sourceRow, error: sourceErr } = await supabase
    .from("source_documents")
    .upsert(
      {
        user_id: params.userId,
        source: "gdrive",
        source_file_id: fileId,
        source_url: doc.sourceUrl || params.driveUrl,
        title: doc.title,
        mime_type: doc.mimeType,
        raw_text: doc.text,
        checksum,
        metadata: doc.metadata,
      },
      { onConflict: "user_id,source_file_id" }
    )
    .select()
    .single();

  if (sourceErr) throw sourceErr;
  console.log(`[ingest] Source document stored: ${sourceRow.id}`);

  // Extract memories with Gemini
  console.log("[ingest] Extracting memories with Gemini...");
  const extracted = await extractMemories(
    doc.title,
    doc.mimeType,
    doc.sourceUrl,
    doc.text,
    knownUsers
  );
  console.log(
    `[ingest] Extracted ${extracted.memories.length} memories`
  );

  // Embed memory content
  console.log("[ingest] Generating memory embeddings...");
  const memoryEmbeddings = await embedTexts(
    extracted.memories.map((m: any) => m.content)
  );

  // Route each memory to the relevant users identified by Gemini.
  // If a memory has no relevant_users or lists unknown users, fall back to params.userId.
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

  // Delete old memories for this document (re-ingest scenario)
  await supabase
    .from("memory_items")
    .delete()
    .eq("document_id", sourceRow.id);

  const { error: memErr } = await supabase
    .from("memory_items")
    .insert(memoryRows);
  if (memErr) throw memErr;
  const userBreakdown = knownUsers.map(
    (u) => `${u}: ${memoryRows.filter((r) => r.user_id === u).length}`
  ).join(", ");
  console.log(`[ingest] Inserted ${memoryRows.length} memories (${userBreakdown})`);

  // Chunk and embed document text
  console.log("[ingest] Chunking and embedding document...");
  const chunks = chunkText(doc.text);
  const chunkEmbeddings = await embedTexts(chunks);

  // Chunks are stored once per document (not per user) — memories handle user routing
  const chunkRows = chunks.map((content, idx) => ({
    document_id: sourceRow.id,
    user_id: params.userId,
    chunk_index: idx,
    content,
    token_estimate: Math.ceil(content.length / 4),
    metadata: { title: doc.title },
    embedding: chunkEmbeddings[idx],
  }));

  // Delete old chunks for this document
  await supabase
    .from("document_chunks")
    .delete()
    .eq("document_id", sourceRow.id);

  const { error: chunkErr } = await supabase
    .from("document_chunks")
    .insert(chunkRows);
  if (chunkErr) throw chunkErr;
  console.log(`[ingest] Inserted ${chunkRows.length} chunks`);

  return {
    documentId: sourceRow.id,
    title: doc.title,
    summary: extracted.document_summary,
    memoriesInserted: memoryRows.length,
    chunksInserted: chunkRows.length,
  };
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
