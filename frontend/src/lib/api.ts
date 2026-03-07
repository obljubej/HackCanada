const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function askQuestion(question: string, userId = "default-user", threadId?: string) {
  const body: any = { question, userId };
  if (threadId) body.threadId = threadId;

  const res = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }

  return res.json();
}

export async function ingestDriveUrl(driveUrl: string, userId = "default-user") {
  const res = await fetch(`${API_URL}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ driveUrl, userId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }

  return res.json();
}

export async function getOAuthStatus() {
  const res = await fetch(`${API_URL}/oauth/status`);
  return res.json();
}

export function getOAuthLoginUrl() {
  return `${API_URL}/oauth/login`;
}

export async function resetChat(userId = "default-user") {
  await fetch(`${API_URL}/ask/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}
