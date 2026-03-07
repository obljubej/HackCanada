import { supabase } from "./config.js";
import { embedTexts } from "./ingest.js";

export async function searchMemories(userId: string, query: string) {
  const [queryEmbedding] = await embedTexts([query]);

  const { data, error } = await supabase.rpc("match_memory_items", {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_count: 10,
  });

  if (error) throw error;

  return (data as any[])
    .map((row) => ({
      ...row,
      final_score:
        0.45 * row.similarity +
        0.20 * row.weight +
        0.15 * row.confidence +
        0.10 * row.salience +
        0.10 * 0.5,
    }))
    .sort((a, b) => b.final_score - a.final_score);
}
