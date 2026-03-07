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

export async function getUsers(): Promise<string[]> {
  const res = await fetch(`${API_URL}/users`);
  if (!res.ok) return ["default-user"];
  const data = await res.json();
  return data.users || ["default-user"];
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

