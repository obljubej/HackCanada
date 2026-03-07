import "dotenv/config";
import { BackboardClient } from "backboard-sdk";

export const backboard = new BackboardClient({
  apiKey: process.env.BACKBOARD_API_KEY || process.env.BACKBOARD_URL || "",
});

const ASSISTANT_NAME = "Memory Assistant";

const SYSTEM_PROMPT = `You answer questions using retrieved memory records from a stored knowledge base.

When you need information to answer a question, use the search_memories tool to find relevant memories.
You may also use search_chunks to get raw document excerpts for more detail.

Rules:
- Use the provided memory context as your primary source of truth.
- If the answer is not sufficiently supported by the context, say so clearly.
- Do not invent facts.
- Prefer concise, direct answers.
- When useful, mention uncertainty.
- If you get multiple memories, synthesize them into a coherent answer.
- Reference specific details from memories when relevant.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_memories",
      description:
        "Search the user's stored memory items (facts, tasks, projects, preferences, people, summaries) using semantic similarity. Use this to find relevant context before answering questions.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The search query to find relevant memories. Should be a natural language description of what you're looking for.",
          },
          count: {
            type: "number",
            description:
              "Number of memories to retrieve (default 10, max 20)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_chunks",
      description:
        "Search raw document chunks for more detailed context. Use this when you need verbatim text from the original documents.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to find relevant document chunks.",
          },
          count: {
            type: "number",
            description: "Number of chunks to retrieve (default 5, max 10)",
          },
        },
        required: ["query"],
      },
    },
  },
];

let cachedAssistantId: string | null = null;

export async function getOrCreateAssistant(): Promise<string> {
  if (cachedAssistantId) return cachedAssistantId;

  // Check if assistant already exists
  const assistants = await backboard.listAssistants({ limit: 100 });
  const existing = assistants.find((a) => a.name === ASSISTANT_NAME);

  if (existing) {
    cachedAssistantId = existing.assistantId;
    console.log(`[backboard] Using existing assistant: ${cachedAssistantId}`);
    return cachedAssistantId;
  }

  // Create new assistant
  const assistant = await backboard.createAssistant({
    name: ASSISTANT_NAME,
    system_prompt: SYSTEM_PROMPT,
    tools: TOOLS,
  });

  cachedAssistantId = assistant.assistantId;
  console.log(`[backboard] Created assistant: ${cachedAssistantId}`);
  return cachedAssistantId;
}

export async function createThread(assistantId: string): Promise<string> {
  const thread = await backboard.createThread(assistantId);
  return thread.threadId;
}
