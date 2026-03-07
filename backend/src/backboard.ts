import "dotenv/config";
import { BackboardClient } from "backboard-sdk";

export const backboard = new BackboardClient({
  apiKey: process.env.BACKBOARD_API_KEY || process.env.BACKBOARD_URL || "",
});

const ASSISTANT_NAME = "Memory Assistant";

const SYSTEM_PROMPT = `You are RelAI, a highly intelligent and conversational AI Meeting Assistant.
You can host meetings, participate in voice conversations naturally, answer general questions, and help manage projects.
Use the search_memories tool to find facts about the user's knowledge base when appropriate, but you are also fully capable of general chat, reasoning, math, and casual conversation.

Rules:
- Be conversational, natural, and helpful.
- For factual queries about the user's projects or past meetings, use search_memories.
- Do not say "My capabilities are limited to searching your memories". You are a versatile AI.
- Prefer concise, direct answers suitable for a voice conversation.`;

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
