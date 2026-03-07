"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { getProjects, getEmployees, getNotifications } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { useRole } from "@/lib/role-context"
import type { Project, Employee, Notification } from "@/lib/types"

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  planning: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  on_hold: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  completed: "bg-purple-500/10 text-purple-400 border-purple-500/20",
}

const STATUS_ICONS: Record<string, string> = {
  active: "M5.636 5.636a9 9 0 1012.728 0M12 3v9",
  planning: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  on_hold: "M15.75 5.25v13.5m-7.5-13.5v13.5",
  completed: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
}

function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub: string; color: string; icon: string
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={`text-3xl font-bold ${color}`}>{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
      <div className="absolute right-4 top-4 opacity-10">
        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
    </Card>
  )
}

function ProjectRow({ project }: { project: Project }) {
  return (
    <Link href={`/dashboard/projects/${project.id}`}>
      <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group">
        <div className={`flex-shrink-0 h-2.5 w-2.5 rounded-full ${
          project.status === "active" ? "bg-emerald-400" :
          project.status === "completed" ? "bg-purple-400" :
          project.status === "on_hold" ? "bg-amber-400" : "bg-blue-400"
        }`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{project.title}</p>
          {project.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{project.description}</p>
          )}
        </div>
        <span className={`flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[project.status] ?? STATUS_COLORS.planning}`}>
          {project.status.replace("_", " ")}
        </span>
        <svg className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}

function ManagerDashboard({ projects, employees, notifications }: {
  projects: Project[]; employees: Employee[]; notifications: Notification[]
}) {
  const available = employees.filter((e) => e.availability)
  const busy = employees.filter((e) => !e.availability)
  const activeProjects = projects.filter((p) => p.status === "active")
  const completedProjects = projects.filter((p) => p.status === "completed")
  const unread = notifications.filter((n) => !n.read)

  const completionRate = projects.length > 0
    ? Math.round((completedProjects.length / projects.length) * 100)
    : 0

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manager Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Company-wide overview and team management</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Project
          </Link>
          <Link
            href="/dashboard/employees"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
            Add Employee
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Projects"
          value={projects.length}
          sub={`${activeProjects.length} active · ${completedProjects.length} done`}
          color="text-primary"
          icon="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
        />
        <StatCard
          label="Team Members"
          value={employees.length}
          sub={`${available.length} available · ${busy.length} busy`}
          color="text-emerald-400"
          icon="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
        <StatCard
          label="Completion Rate"
          value={`${completionRate}%`}
          sub={`${completedProjects.length} of ${projects.length} projects done`}
          color="text-purple-400"
          icon="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <StatCard
          label="Unread Alerts"
          value={unread.length}
          sub="team notifications"
          color="text-amber-400"
          icon="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </div>

      {/* Main grid */}
      <div className="grid gap-8 xl:grid-cols-3">
        {/* Projects */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Projects</h2>
            <Link href="/dashboard/projects" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              View all →
            </Link>
          </div>

          {projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16 gap-4">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <svg className="h-7 w-7 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">No projects yet. Create your first project.</p>
                <Link href="/dashboard/projects/new" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                  Create Project
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {projects.slice(0, 8).map((p) => <ProjectRow key={p.id} project={p} />)}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Team Availability */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Team Availability</h2>
              <Link href="/dashboard/employees" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Manage →
              </Link>
            </div>
            <Card>
              <CardContent className="py-3 divide-y divide-border">
                {employees.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-xs text-muted-foreground">No employees added yet.</p>
                    <Link href="/dashboard/employees" className="mt-2 inline-block text-xs text-primary hover:underline">Add team members</Link>
                  </div>
                ) : employees.slice(0, 7).map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-2.5 gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 flex-shrink-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary">
                        {(e.name || "?")[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{e.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{e.role}</p>
                      </div>
                    </div>
                    <div className={`flex-shrink-0 h-2 w-2 rounded-full ${e.availability ? "bg-emerald-400" : "bg-red-400"}`} />
                  </div>
                ))}
                {employees.length > 7 && (
                  <Link href="/dashboard/employees" className="pt-2.5 block text-xs text-primary font-medium hover:underline text-center">
                    +{employees.length - 7} more members
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Org summary */}
          <div>
            <h2 className="text-base font-semibold mb-3">Availability Breakdown</h2>
            <Card>
              <CardContent className="py-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-emerald-400 font-semibold">Available</span>
                    <span className="text-muted-foreground">{employees.length > 0 ? Math.round((available.length / employees.length) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all"
                      style={{ width: `${employees.length > 0 ? (available.length / employees.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-red-400 font-semibold">Busy</span>
                    <span className="text-muted-foreground">{employees.length > 0 ? Math.round((busy.length / employees.length) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-400 transition-all"
                      style={{ width: `${employees.length > 0 ? (busy.length / employees.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="pt-1 grid grid-cols-3 gap-3 text-center border-t border-border">
                  <div>
                    <p className="text-lg font-bold text-foreground">{employees.length}</p>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-400">{available.length}</p>
                    <p className="text-[10px] text-muted-foreground">Free</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-400">{busy.length}</p>
                    <p className="text-[10px] text-muted-foreground">Busy</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Notifications */}
          {unread.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold">Recent Alerts</h2>
                <Link href="/dashboard/inbox" className="text-xs text-primary hover:underline">
                  {unread.length} unread →
                </Link>
              </div>
              <Card>
                <CardContent className="py-3 divide-y divide-border">
                  {unread.slice(0, 4).map((n) => (
                    <div key={n.id} className="py-2.5 flex gap-2.5 items-start">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EmployeeDashboard({ projects, notifications }: {
  projects: Project[]; notifications: Notification[]
}) {
  const unread = notifications.filter((n) => !n.read)
  const myActive = projects.filter((p) => p.status === "active")
  const myCompleted = projects.filter((p) => p.status === "completed")

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Your projects, tasks, and notifications</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="My Projects"
          value={projects.length}
          sub={`${myActive.length} active`}
          color="text-primary"
          icon="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
        />
        <StatCard
          label="Completed"
          value={myCompleted.length}
          sub="projects finished"
          color="text-purple-400"
          icon="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <StatCard
          label="Notifications"
          value={unread.length}
          sub="unread messages"
          color="text-amber-400"
          icon="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </div>

      {/* Projects */}
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-base font-semibold">My Projects</h2>
          {projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 gap-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <svg className="h-6 w-6 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground text-center">You haven't been assigned to any projects yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => <ProjectRow key={p.id} project={p} />)}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">My Inbox</h2>
            <Link href="/dashboard/inbox" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              View all →
            </Link>
          </div>
          <Card>
            <CardContent className="py-3 divide-y divide-border">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <svg className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-muted-foreground">All caught up! No notifications.</p>
                </div>
              ) : notifications.slice(0, 6).map((n) => (
                <div key={n.id} className={`py-3 flex gap-3 items-start ${!n.read ? "opacity-100" : "opacity-60"}`}>
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 mt-1 ${!n.read ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`} />
                  <div className="min-w-0">
                    <p className="text-xs text-foreground leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>("employee")

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        // Fetch role
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_role")
          .eq("id", session.user.id)
          .single()

        const role = profile?.user_role || "employee"
        setUserRole(role)

        const isManager = role === "manager" || role === "ceo" || role === "cto"

        if (isManager) {
          const [projs, emps, ns] = await Promise.all([
            getProjects(),
            getEmployees(),
            getNotifications(session.user.id).catch(() => [])
          ])
          setProjects(projs)
          setEmployees(emps)
          setNotifications(ns)
        } else {
          // Employees see only their own assigned projects
          const [projs, ns] = await Promise.all([
            getProjects().catch(() => []),  // TODO: filter by assigned
            getNotifications(session.user.id).catch(() => [])
          ])
          setProjects(projs)
          setNotifications(ns)
        }
      } catch {
        // silently fail, tables may not exist yet
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  const isManager = userRole === "manager" || userRole === "ceo" || userRole === "cto"

  if (isManager) {
    return <ManagerDashboard projects={projects} employees={employees} notifications={notifications} />
  }
  return <EmployeeDashboard projects={projects} notifications={notifications} />
}

export default function DashboardPage() {
  const { isManager } = useRole()
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const [projs, emps, ns] = await Promise.all([
          getProjects().catch(() => []),
          getEmployees().catch(() => []),
          getNotifications(session.user.id).catch(() => [])
        ])
        setProjects(projs)
        setEmployees(emps)
        setNotifications(ns)
      } catch {
        // silently fail, tables may not exist yet
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  if (isManager) {
    return <ManagerDashboard projects={projects} employees={employees} notifications={notifications} />
  }
  return <EmployeeDashboard projects={projects} notifications={notifications} />
}
