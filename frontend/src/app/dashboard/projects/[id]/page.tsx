"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  getProject, getProjectAssignments, getProjectTasks, getProjectMeetings,
  createTask, updateTaskStatus, deleteTask, createMeeting, updateProject
} from "@/lib/db"
import { projectsAPI } from "@/lib/api"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Alert, AlertDescription } from "@/components/ui/Alert"
import type { Project, Task, Meeting, ProjectAssignment } from "@/lib/types"

const TASK_COLUMNS: { id: Task["status"]; label: string; color: string }[] = [
  { id: "todo",        label: "To Do",       color: "text-muted-foreground" },
  { id: "in_progress", label: "In Progress", color: "text-amber-400" },
  { id: "done",        label: "Done",        color: "text-emerald-400" },
]

const PRIORITIES: Task["priority"][] = ["low", "medium", "high"]
const PRIORITY_COLORS: Record<string, string> = {
  high:   "bg-red-500/10 text-red-400 border-red-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
}
const STATUS_COLORS: Record<string, string> = {
  active:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  planning:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  on_hold:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  completed: "bg-purple-500/10 text-purple-400 border-purple-500/20",
}

export default function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [project, setProject] = useState<Project | null>(null)
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Task modal
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskTitle, setTaskTitle] = useState("")
  const [taskAssignee, setTaskAssignee] = useState("")
  const [taskDue, setTaskDue] = useState("")
  const [taskPriority, setTaskPriority] = useState<Task["priority"]>("medium")
  const [savingTask, setSavingTask] = useState(false)

  // AI ranking
  const [ranking, setRanking] = useState(false)
  // Meeting modal
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [meetTitle, setMeetTitle] = useState("")
  const [meetTime, setMeetTime] = useState("")
  const [savingMeeting, setSavingMeeting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const [proj, team, ts, ms] = await Promise.all([
        getProject(id),
        projectsAPI.getTeam(id).then((r: any) => r.team ?? []).catch(() => getProjectAssignments(id)),
        projectsAPI.getTasks(id).then((r: any) => r.tasks ?? []).catch(() => getProjectTasks(id)),
        getProjectMeetings(id),
      ])
      setProject(proj)
      // Normalise team members from API shape to ProjectAssignment shape
      setAssignments(team.map((t: any) => ({
        id: t.id,
        project_id: id,
        employee_id: t.employees?.id ?? t.employee_id,
        role: t.role_in_project ?? t.role,
        employee: t.employees ? {
          id: t.employees.id,
          name: t.employees.full_name ?? t.employees.name,
          email: t.employees.email,
          role: t.employees.role,
          skills: (t.employees.employee_skills ?? []).map((es: any) => es.skills?.name).filter(Boolean),
          availability: true,
        } : t.employee,
      })))
      setTasks(ts.map((t: any) => ({
        id: t.id,
        project_id: id,
        title: t.title,
        status: t.status,
        priority: t.priority ?? "medium",
        assigned_to: t.assigned_to,
        due_date: t.due_date,
        employee: t.employees ? { name: t.employees.full_name ?? t.employees.name } : undefined,
      })))
      setMeetings(ms)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  const handleRankTeam = async () => {
    if (!id) return
    setRanking(true)
    try {
      await projectsAPI.rankEmployees(id, true)
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRanking(false)
    }
  }


  useEffect(() => { load() }, [load])

  const handleStatusChange = async (task: Task, newStatus: Task["status"]) => {
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t))
    // Try backend API first, fall back to direct Supabase
    await projectsAPI.updateTask(task.id, { status: newStatus })
      .catch(() => updateTaskStatus(task.id, newStatus))
      .catch(() => {})
  }

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskTitle.trim()) return
    setSavingTask(true)
    try {
      await createTask({
        project_id: id,
        title: taskTitle.trim(),
        status: "todo",
        assigned_to: taskAssignee || null,
        due_date: taskDue || null,
        priority: taskPriority,
      })
      setTaskTitle(""); setTaskAssignee(""); setTaskDue(""); setTaskPriority("medium")
      setShowTaskModal(false)
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingTask(false)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    await deleteTask(taskId).catch(() => {})
  }

  const handleAddMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!meetTitle.trim() || !meetTime) return
    setSavingMeeting(true)
    try {
      await createMeeting({
        project_id: id,
        title: meetTitle.trim(),
        start_time: meetTime,
        attendees: assignments.map((a) => a.employee_id),
      })
      setMeetTitle(""); setMeetTime("")
      setShowMeetingModal(false)
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingMeeting(false)
    }
  }

  const cycleStatus = async () => {
    if (!project) return
    const order: Project["status"][] = ["planning", "active", "on_hold", "completed"]
    const next = order[(order.indexOf(project.status) + 1) % order.length]
    const updated = await updateProject(id, { status: next })
    setProject(updated)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!project) return (
    <div className="p-8 text-center">
      <p className="text-muted-foreground">Project not found.</p>
      <Link href="/dashboard/projects" className="text-primary text-sm hover:underline">← Back to projects</Link>
    </div>
  )

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Project Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/dashboard/projects" className="hover:text-foreground transition-colors">Projects</Link>
            <span>/</span>
            <span>{project.title}</span>
          </div>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          {project.description && <p className="text-sm text-muted-foreground max-w-lg">{project.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={cycleStatus}
            className={`text-xs font-semibold px-3 py-1.5 rounded border cursor-pointer transition-opacity hover:opacity-80 ${STATUS_COLORS[project.status]}`}
          >
            {project.status.replace("_", " ")}
          </button>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid gap-8 xl:grid-cols-4">
        {/* Main: Kanban Board – 3 cols */}
        <div className="xl:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Task Board</h2>
            <Button size="sm" onClick={() => setShowTaskModal(true)}>
              <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Task
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {TASK_COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.id)
              return (
                <div key={col.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}>{col.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
                  </div>
                  <div className="min-h-24 space-y-2">
                    {colTasks.map((task) => (
                      <Card key={task.id} className="shadow-none hover:border-border/60 transition-colors">
                        <CardContent className="py-3 px-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13px] font-medium text-foreground leading-tight">{task.title}</p>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[task.priority]}`}>
                              {task.priority}
                            </span>
                            {task.due_date && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                                {new Date(task.due_date).toLocaleDateString("en", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                          {/* Status move buttons */}
                          <div className="flex gap-1 pt-0.5">
                            {TASK_COLUMNS.filter((c) => c.id !== col.id).map((c) => (
                              <button
                                key={c.id}
                                onClick={() => handleStatusChange(task, c.id)}
                                className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-1.5 py-0.5 transition-colors"
                              >
                                → {c.label}
                              </button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {colTasks.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border/50 py-6 flex items-center justify-center">
                        <p className="text-xs text-muted-foreground/50">No tasks</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar: Team & Meetings */}
        <div className="space-y-6">
          {/* Team */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Team</h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRankTeam}
                isLoading={ranking}
                title="AI auto-assigns best available employees for this project"
              >
                <svg className="mr-1.5 h-3.5 w-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                {ranking ? "Ranking…" : "AI Rank Team"}
              </Button>
            </div>
            <Card>
              <CardContent className="py-4 space-y-3">
                {assignments.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No members assigned.</p>
                ) : assignments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2.5">
                    <div className="h-8 w-8 flex-shrink-0 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {(a.employee?.name ?? "?")[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{a.employee?.name ?? a.employee_id}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{a.role}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Meetings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Meetings</h2>
              <button
                onClick={() => setShowMeetingModal(true)}
                className="text-xs text-primary hover:underline font-semibold"
              >
                + Schedule
              </button>
            </div>
            <Card>
              <CardContent className="py-4 space-y-3">
                {meetings.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No meetings scheduled.</p>
                ) : meetings.map((m) => (
                  <div key={m.id} className="space-y-0.5">
                    <p className="text-[13px] font-medium text-foreground">{m.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(m.start_time).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">Add Task</h2>
              <button onClick={() => setShowTaskModal(false)} className="text-muted-foreground hover:text-foreground">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddTask} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title *</label>
                <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task description…" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assignee</label>
                  <select
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Unassigned</option>
                    {assignments.map((a) => (
                      <option key={a.employee_id} value={a.employee_id}>{a.employee?.name ?? a.employee_id}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as Task["priority"])}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Due Date</label>
                <Input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowTaskModal(false)}>Cancel</Button>
                <Button type="submit" isLoading={savingTask}>Add Task</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Meeting Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">Schedule Meeting</h2>
              <button onClick={() => setShowMeetingModal(false)} className="text-muted-foreground hover:text-foreground">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddMeeting} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meeting Title *</label>
                <Input value={meetTitle} onChange={(e) => setMeetTitle(e.target.value)} placeholder="e.g., Sprint Planning" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date & Time *</label>
                <Input type="datetime-local" value={meetTime} onChange={(e) => setMeetTime(e.target.value)} required />
              </div>
              <p className="text-xs text-muted-foreground">All project members will be invited automatically.</p>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowMeetingModal(false)}>Cancel</Button>
                <Button type="submit" isLoading={savingMeeting}>Schedule</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
