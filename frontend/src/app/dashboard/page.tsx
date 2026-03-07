"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { getProjects, getEmployees, getNotifications } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import type { Project, Employee, Notification } from "@/lib/types"

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  planning: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  on_hold: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  completed: "bg-purple-500/10 text-purple-400 border-purple-500/20",
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [projs, emps] = await Promise.all([getProjects(), getEmployees()])
        setProjects(projs)
        setEmployees(emps)

        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const ns = await getNotifications(session.user.id)
          setNotifications(ns)
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const available = employees.filter((e) => e.availability)
  const activeProjects = projects.filter((p) => p.status === "active")
  const unread = notifications.filter((n) => !n.read)

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

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Projects", value: projects.length, sub: `${activeProjects.length} active`, color: "text-primary" },
          { label: "Team Members", value: employees.length, sub: `${available.length} available`, color: "text-emerald-400" },
          { label: "Unread Notifications", value: unread.length, sub: "in your inbox", color: "text-amber-400" },
          { label: "Completion Rate", value: projects.length > 0 ? `${Math.round((projects.filter(p => p.status === "completed").length / projects.length) * 100)}%` : "—", sub: "projects completed", color: "text-purple-400" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Active Projects */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Active Projects</h2>
            <Link href="/dashboard/projects/new" className="text-sm font-medium text-primary hover:underline underline-offset-4">
              + New Project
            </Link>
          </div>

          {projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 gap-4">
                <svg className="h-10 w-10 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
                <p className="text-sm text-muted-foreground">No projects yet.</p>
                <Link href="/dashboard/projects/new" className="text-sm font-semibold text-primary hover:underline">
                  Create your first project
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 6).map((project) => (
                <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
                  <Card className="hover:border-border/80 hover:bg-white/[0.04] transition-all cursor-pointer">
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{project.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{project.description || "No description"}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${STATUS_COLORS[project.status] ?? STATUS_COLORS.planning}`}>
                          {project.status.replace("_", " ")}
                        </span>
                        <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right: Availability + Notifications */}
        <div className="space-y-6">
          {/* Team Availability */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Team Availability</h2>
            <Card>
              <CardContent className="py-4 space-y-3">
                {employees.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No employees added yet.</p>
                ) : employees.slice(0, 6).map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 flex-shrink-0 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold text-foreground">
                        {e.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{e.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{e.role}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${e.availability ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                      {e.availability ? "Available" : "Busy"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Recent Notifications */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Recent Notifications</h2>
            <Card>
              <CardContent className="py-4 space-y-3">
                {unread.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">All caught up!</p>
                ) : unread.slice(0, 4).map((n) => (
                  <div key={n.id} className="flex gap-2.5 items-start">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>
                  </div>
                ))}
                {unread.length > 0 && (
                  <Link href="/dashboard/inbox" className="block text-xs text-primary font-medium hover:underline pt-1">
                    View all notifications →
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
