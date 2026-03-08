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

export async function ingestGithubRepo(
  repoUrl: string,
  userId = "default-user",
  branch?: string,
  maxFiles?: number
) {
  const res = await fetch(`${API_URL}/ingest/github`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl, userId, branch, maxFiles }),
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

export async function getUsers(): Promise<string[]> {
  const urls = [`${API_URL}/users`, `${API_URL}/api/users`];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data.users) && data.users.length > 0) return data.users;
    } catch {
      // try next candidate URL
    }
  }

  return ["default-user"];
}

export async function resetChat(userId = "default-user") {
  await fetch(`${API_URL}/ask/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

// ── Organization API ──────────────────────────────────────────────────────────

async function apiGet(path: string) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPut(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiDelete(path: string) {
  const res = await fetch(`${API_URL}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const organizationAPI = {
  // Departments
  getDepartments: () => apiGet("/departments"),
  createDepartment: (body: { name: string; description?: string }) =>
    apiPost("/departments", body),

  // Employees
  getEmployees: () => apiGet("/employees"),
  getEmployee: (id: string) => apiGet(`/employees/${id}`),
  createEmployee: (body: {
    full_name: string;
    email: string;
    role: string;
    department_id: string;
    bio?: string;
  }) => apiPost("/employees", body),
  updateEmployee: (id: string, body: Record<string, unknown>) =>
    apiPut(`/employees/${id}`, body),

  // Skills
  getSkills: () => apiGet("/skills"),
  createSkill: (body: { name: string; category?: string; description?: string }) =>
    apiPost("/skills", body),
  addSkillToEmployee: (
    employeeId: string,
    body: { skill_id: string; proficiency_level?: string; years_of_experience?: number }
  ) => apiPost(`/employees/${employeeId}/skills`, body),
  removeSkillFromEmployee: (employeeId: string, skillId: string) =>
    apiDelete(`/employees/${employeeId}/skills/${skillId}`),
};

export const projectsAPI = {
  getProjects: () => apiGet("/projects"),
  getProject: (id: string) => apiGet(`/projects/${id}`),
  createProject: (body: Record<string, unknown>) => apiPost("/projects", body),
  updateProject: (id: string, body: Record<string, unknown>) =>
    apiPut(`/projects/${id}`, body),
  assignEmployee: (projectId: string, body: Record<string, unknown>) =>
    apiPost(`/projects/${projectId}/assign`, body),
  getTeam: (projectId: string) => apiGet(`/projects/${projectId}/team`),
  getTasks: (projectId: string) => apiGet(`/projects/${projectId}/tasks`),
  createTask: (projectId: string, body: Record<string, unknown>) =>
    apiPost(`/projects/${projectId}/tasks`, body),
};
export async function connectGithubAccount(githubUsername: string, userId: string) {
  return apiPost("/github/connect", { githubUsername, userId });
}

export const notificationsAPI = {
  getNotifications: (userId: string) =>
    apiGet(`/notifications?user_id=${encodeURIComponent(userId)}`),
  getUnreadCount: (userId: string) =>
    apiGet(`/notifications/unread/count?user_id=${encodeURIComponent(userId)}`),
  markAsRead: (id: string) => apiPut(`/notifications/${id}/read`, {}),
  deleteNotification: (id: string) => apiDelete(`/notifications/${id}`),
  createNotification: (body: Record<string, unknown>) =>
    apiPost("/notifications", body),
};

export const meetingsAPI = {
  list: () => apiGet("/meetings"),
  get: (id: string) => apiGet(`/meetings/${id}`),
  create: (body: Record<string, unknown>) => apiPost("/meetings", body),
  start: (id: string) => apiPost(`/meetings/${id}/start`, {}),
  end: (id: string) => apiPost(`/meetings/${id}/end`, {}),
  addTranscript: (id: string, body: { speaker: string; message: string }) =>
    apiPost(`/meetings/${id}/transcript`, body),
  ask: (id: string, body: { question: string }) => 
    apiPost(`/ai/meeting-response`, { meetingId: id, question: body.question }),
  getSummary: (id: string) => apiGet(`/meetings/${id}/summary`),
  generateSummary: (id: string) => apiPost(`/ai/generate-summary`, { meetingId: id }),
};
