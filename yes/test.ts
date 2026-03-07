import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";
import { google } from "googleapis";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

function extractDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
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

async function getDriveClient(tokens: { access_token: string; refresh_token?: string }) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials(tokens);
  return google.drive({ version: "v3", auth });
}

async function fetchDriveText(fileId: string, drive: any) {
  const meta = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,modifiedTime,owners(displayName,emailAddress),webViewLink"
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
  } else {
    // For hackathon MVP, keep this simple and focus on Google Docs first.
    throw new Error(`Unsupported mime type for MVP: ${mimeType}`);
  }

  return {
    title: file.name ?? "Untitled",
    mimeType,
    sourceUrl: file.webViewLink ?? "",
    metadata: file,
    text
  };
}

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
              end_char: { type: Type.NUMBER }
            },
            required: ["start_char", "end_char"]
          },
          metadata: {
            type: Type.OBJECT,
            properties: {
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              entities: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              dates: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          }
        },
        required: [
          "memory_type",
          "content",
          "weight",
          "confidence",
          "salience",
          "recency_score",
          "source_span",
          "metadata"
        ]
      }
    }
  },
  required: ["title", "document_summary", "memories"]
};

async function extractMemories(title: string, mimeType: string, sourceUrl: string, text: string) {
  const prompt = `
Extract durable memory objects from this Google Drive document.

Document metadata:
- title: ${title}
- mime_type: ${mimeType}
- source_url: ${sourceUrl}

Document text:
${text}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: memorySchema,
      systemInstruction: `
You are a structured memory extraction engine.

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

Rules:
- Do not invent information.
- Prefer durable knowledge over filler.
- Merge near-duplicates.
- Keep content concise.
- Always include exactly one summary item if there is meaningful content.
`
    }
  });

  return JSON.parse(response.text!);
}

async function embedTexts(texts: string[]) {
  const res = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: texts.map(text => ({ parts: [{ text }] }))
  });

  return res.embeddings!.map((e: any) => e.values);
}

export async function ingestDriveLink(params: {
  userId: string;
  driveUrl: string;
  googleTokens: { access_token: string; refresh_token?: string };
}) {
  const fileId = extractDriveFileId(params.driveUrl);
  if (!fileId) throw new Error("Could not extract file ID from Google Drive URL.");

  const drive = await getDriveClient(params.googleTokens);
  const doc = await fetchDriveText(fileId, drive);

  const checksum = crypto.createHash("sha256").update(doc.text).digest("hex");

  const { data: sourceRow, error: sourceErr } = await supabase
    .from("source_documents")
    .upsert({
      user_id: params.userId,
      source: "gdrive",
      source_file_id: fileId,
      source_url: doc.sourceUrl || params.driveUrl,
      title: doc.title,
      mime_type: doc.mimeType,
      raw_text: doc.text,
      checksum,
      metadata: doc.metadata
    }, { onConflict: "user_id,source_file_id" })
    .select()
    .single();

  if (sourceErr) throw sourceErr;

  const extracted = await extractMemories(doc.title, doc.mimeType, doc.sourceUrl, doc.text);

  const memoryEmbeddings = await embedTexts(
    extracted.memories.map((m: any) => m.content)
  );

  const memoryRows = extracted.memories.map((m: any, i: number) => ({
    user_id: params.userId,
    document_id: sourceRow.id,
    memory_type: m.memory_type,
    content: m.content,
    weight: m.weight,
    confidence: m.confidence,
    salience: m.salience,
    recency_score: m.recency_score,
    source_span: m.source_span,
    metadata: m.metadata,
    embedding: memoryEmbeddings[i]
  }));

  const { error: memErr } = await supabase.from("memory_items").insert(memoryRows);
  if (memErr) throw memErr;

  const chunks = chunkText(doc.text);
  const chunkEmbeddings = await embedTexts(chunks);

  const chunkRows = chunks.map((content, idx) => ({
    document_id: sourceRow.id,
    user_id: params.userId,
    chunk_index: idx,
    content,
    token_estimate: Math.ceil(content.length / 4),
    metadata: { title: doc.title },
    embedding: chunkEmbeddings[idx]
  }));

  const { error: chunkErr } = await supabase.from("document_chunks").insert(chunkRows);
  if (chunkErr) throw chunkErr;

  return {
    documentId: sourceRow.id,
    title: doc.title,
    memoriesInserted: memoryRows.length,
    chunksInserted: chunkRows.length
  };
}