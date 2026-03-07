import { supabase } from "./config.js";
import { embedTexts } from "./ingest.js";
import { backboard, getOrCreateAssistant, createThread } from "./backboard.js";
import type { MessageResponse, ToolOutputsResponse } from "backboard-sdk";

// ── Types ────────────────────────────────────────────────────────────

interface RetrievedMemory {
  id: string;
  document_id: string;
  memory_type: string;
  content: string;
  weight: number;
  confidence: number;
  salience: number;
  similarity: number;
  final_score: number;
  metadata: any;
}

interface RetrievedChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  similarity: number;
  metadata: any;
}

interface AskResult {
  answer: string;
  retrievedMemories: RetrievedMemory[];
  retrievedChunks: RetrievedChunk[];
  threadId: string;
}

// ── Retrieval helpers ────────────────────────────────────────────────

async function searchMemories(
  userId: string,
  query: string,
  count = 10
): Promise<RetrievedMemory[]> {
  const [queryEmbedding] = await embedTexts([query]);

  const { data, error } = await supabase.rpc("match_memory_items", {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_count: Math.min(count, 20),
  });

  if (error) throw error;

  return (data as any[]).map((row) => ({
    ...row,
    final_score:
      0.45 * row.similarity +
      0.20 * row.weight +
      0.15 * row.confidence +
      0.10 * row.salience +
      0.10 * (row.recency_score ?? 0.5),
  })).sort((a, b) => b.final_score - a.final_score);
}

async function searchChunks(
  userId: string,
  query: string,
  count = 5
): Promise<RetrievedChunk[]> {
  const [queryEmbedding] = await embedTexts([query]);

  // Direct cosine similarity search on document_chunks
  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_count: Math.min(count, 10),
  });

  if (error) {
    // Fallback: if the RPC doesn't exist, return empty
    console.warn("[ask] match_document_chunks RPC not found, skipping chunk search");
    return [];
  }

  return (data as any[]).map((row) => ({
    id: row.id,
    document_id: row.document_id,
    content: row.content,
    chunk_index: row.chunk_index,
    similarity: row.similarity,
    metadata: row.metadata,
  }));
}

// ── Tool call handler ────────────────────────────────────────────────

async function handleToolCalls(
  userId: string,
  response: MessageResponse
): Promise<{ toolOutputs: any[]; memories: RetrievedMemory[]; chunks: RetrievedChunk[] }> {
  const allMemories: RetrievedMemory[] = [];
  const allChunks: RetrievedChunk[] = [];
  const toolOutputs: any[] = [];

  if (!response.toolCalls) return { toolOutputs, memories: allMemories, chunks: allChunks };

  for (const tc of response.toolCalls) {
    const args = tc.function.parsedArguments;
    let output = "";

    if (tc.function.name === "search_memories") {
      const query = args.query as string;
      const count = (args.count as number) || 10;
      console.log(`[ask] Tool: search_memories("${query}", ${count})`);

      const memories = await searchMemories(userId, query, count);
      allMemories.push(...memories);

      // Format as context for the LLM
      output = memories
        .map(
          (m, i) =>
            `[${i + 1}] [${m.memory_type}] (score: ${m.final_score.toFixed(2)}) ${m.content}`
        )
        .join("\n");

      if (!output) output = "No relevant memories found.";
    } else if (tc.function.name === "search_chunks") {
      const query = args.query as string;
      const count = (args.count as number) || 5;
      console.log(`[ask] Tool: search_chunks("${query}", ${count})`);

      const chunks = await searchChunks(userId, query, count);
      allChunks.push(...chunks);

      output = chunks
        .map(
          (c, i) =>
            `[Chunk ${i + 1}] (similarity: ${c.similarity.toFixed(2)})\n${c.content}`
        )
        .join("\n\n");

      if (!output) output = "No relevant document chunks found.";
    } else {
      output = `Unknown tool: ${tc.function.name}`;
    }

    toolOutputs.push({
      tool_call_id: tc.id,
      output,
    });
  }

  return { toolOutputs, memories: allMemories, chunks: allChunks };
}

// ── Main ask function ────────────────────────────────────────────────

// Thread cache per user (for hackathon MVP)
const userThreads = new Map<string, string>();

export async function askQuestion(
  userId: string,
  question: string,
  threadId?: string
): Promise<AskResult> {
  const assistantId = await getOrCreateAssistant();

  // Reuse or create thread
  if (!threadId) {
    threadId = userThreads.get(userId);
  }
  if (!threadId) {
    threadId = await createThread(assistantId);
    userThreads.set(userId, threadId);
    console.log(`[ask] Created new thread: ${threadId}`);
  }

  // Send message to Backboard
  console.log(`[ask] Sending question to Backboard: "${question}"`);
  let response = (await backboard.addMessage(threadId, {
    content: question,
    llm_provider: "google",
    model_name: "gemini-2.5-flash",
    stream: false,
  })) as MessageResponse;

  let allMemories: RetrievedMemory[] = [];
  let allChunks: RetrievedChunk[] = [];

  // Handle tool calls (may need multiple rounds)
  let iterations = 0;
  while (response.status === "REQUIRES_ACTION" && response.toolCalls && iterations < 5) {
    iterations++;
    console.log(`[ask] Handling ${response.toolCalls.length} tool call(s) (round ${iterations})`);

    const { toolOutputs, memories, chunks } = await handleToolCalls(userId, response);
    allMemories.push(...memories);
    allChunks.push(...chunks);

    // Submit tool outputs back to Backboard
    const toolResponse = (await backboard.submitToolOutputs(
      threadId,
      response.runId!,
      toolOutputs
    )) as ToolOutputsResponse;

    // The tool response has the same shape — check if more tool calls needed
    response = toolResponse as any;
  }

  console.log(`[ask] Got answer (${response.content?.length ?? 0} chars)`);

  return {
    answer: response.content || "I couldn't generate an answer.",
    retrievedMemories: allMemories,
    retrievedChunks: allChunks,
    threadId,
  };
}

// Reset thread for a user (start fresh conversation)
export function resetThread(userId: string): void {
  userThreads.delete(userId);
}
