// ─── Shared TypeScript Types for RelAI Dashboard ───────────────────────────

export type UserRole = "manager" | "employee"

export interface Employee {
  id: string
  name: string
  email?: string
  role: string
  department?: string
  skills: string[]
  availability: boolean
  manager_id?: string | null
  created_at?: string
}

export interface Department {
  id: string
  name: string
  manager_id?: string | null
}

export interface Project {
  id: string
  title: string
  description?: string
  status: "planning" | "active" | "completed" | "on_hold"
  manager_id?: string
  notion_url?: string | null
  created_at?: string
}

export interface ProjectAssignment {
  id: string
  project_id: string
  employee_id: string
  role: string
  employee?: Employee
}

export type TaskStatus = "todo" | "in_progress" | "done"
export type TaskPriority = "low" | "medium" | "high"

export interface Task {
  id: string
  project_id: string
  title: string
  status: TaskStatus
  assigned_to?: string | null
  due_date?: string | null
  priority: TaskPriority
  employee?: Employee
}

export interface Meeting {
  id: string
  project_id: string
  title: string
  start_time: string
  attendees: string[]
}

export type NotificationType = "assignment" | "skill_gap" | "meeting" | "deadline" | "update"

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  message: string
  read: boolean
  created_at: string
}

// ─── Backboard API types ────────────────────────────────────────────────────

export interface BackboardRequirement {
  role: string
  count: number
  skills: string[]
}

export interface BackboardAnalysis {
  required_roles: BackboardRequirement[]
  team_size: number
  complexity: "low" | "medium" | "high"
  summary: string
}

export interface EmployeeRankResult {
  employee_id: string
  employee_name: string
  match_score: number // 0–100
  matched_skills: string[]
  missing_skills: string[]
  available: boolean
}

export interface BackboardRanking {
  role: string
  candidates: EmployeeRankResult[]
}
