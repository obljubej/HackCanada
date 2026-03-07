import { supabase } from "@/lib/supabase"
import type {
  Employee,
  Project,
  Task,
  Meeting,
  Notification,
  ProjectAssignment,
} from "@/lib/types"

// ─── Employees ──────────────────────────────────────────────────────────────

export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("name")
  if (error) {
    console.warn("[db] getEmployees:", error.message)
    return []
  }
  return data ?? []
}

export async function createEmployee(
  emp: Omit<Employee, "id" | "created_at">
): Promise<Employee> {
  const { data, error } = await supabase
    .from("employees")
    .insert(emp)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateEmployee(
  id: string,
  emp: Partial<Employee>
): Promise<Employee> {
  const { data, error } = await supabase
    .from("employees")
    .update(emp)
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await supabase.from("employees").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

// ─── Projects ───────────────────────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) {
    console.warn("[db] getProjects:", error.message)
    return []
  }
  return data ?? []
}

export async function getProject(id: string): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function createProject(
  proj: Omit<Project, "id" | "created_at">
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert(proj)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateProject(
  id: string,
  proj: Partial<Project>
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update(proj)
    .eq("id", id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

// ─── Project Assignments ────────────────────────────────────────────────────

export async function getProjectAssignments(
  projectId: string
): Promise<ProjectAssignment[]> {
  const { data, error } = await supabase
    .from("project_assignments")
    .select("*, employee:employees(*)")
    .eq("project_id", projectId)
  if (error) {
    console.warn("[db] getProjectAssignments:", error.message)
    return []
  }
  return data ?? []
}

export async function assignEmployee(
  projectId: string,
  employeeId: string,
  role: string
): Promise<void> {
  const { error } = await supabase.from("project_assignments").upsert({
    project_id: projectId,
    employee_id: employeeId,
    role,
  })
  if (error) throw new Error(error.message)
}

export async function removeAssignment(
  projectId: string,
  employeeId: string
): Promise<void> {
  const { error } = await supabase
    .from("project_assignments")
    .delete()
    .eq("project_id", projectId)
    .eq("employee_id", employeeId)
  if (error) throw new Error(error.message)
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export async function getProjectTasks(projectId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, employee:employees(name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
  if (error) {
    console.warn("[db] getProjectTasks:", error.message)
    return []
  }
  return data ?? []
}

export async function createTask(task: Omit<Task, "id">): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert(task)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateTaskStatus(
  id: string,
  status: Task["status"]
): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id)
  if (error) throw new Error(error.message)
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

// ─── Meetings ───────────────────────────────────────────────────────────────

export async function getProjectMeetings(
  projectId: string
): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("project_id", projectId)
    .order("start_time")
  if (error) {
    console.warn("[db] getProjectMeetings:", error.message)
    return []
  }
  return data ?? []
}

export async function getAllMeetings(): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("start_time")
  if (error) {
    console.warn("[db] getAllMeetings:", error.message)
    return []
  }
  return data ?? []
}

export async function createMeeting(
  meeting: Omit<Meeting, "id">
): Promise<Meeting> {
  const { data, error } = await supabase
    .from("meetings")
    .insert(meeting)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

// ─── Notifications ───────────────────────────────────────────────────────────

export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) {
    console.warn("[db] getNotifications:", error.message)
    return []
  }
  return data ?? []
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
  if (error) throw new Error(error.message)
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export async function createNotification(
  n: Omit<Notification, "id" | "created_at">
): Promise<void> {
  const { error } = await supabase.from("notifications").insert(n)
  if (error) throw new Error(error.message)
}
