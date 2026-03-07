"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { getProjects } from "@/lib/db"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import type { Project } from "@/lib/types"

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  active:    { label: "Active",    cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  planning:  { label: "Planning",  cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  on_hold:   { label: "On Hold",   cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  completed: { label: "Completed", cls: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    getProjects().then(setProjects).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = projects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{projects.length} projects total</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects/new">
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Project
          </Link>
        </Button>
      </div>

      <Input
        placeholder="Search projects…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}><CardContent className="py-6"><div className="h-24 rounded-lg bg-muted animate-pulse" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 gap-4">
            <svg className="h-10 w-10 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            <p className="text-sm text-muted-foreground">{search ? "No projects match your search." : "No projects yet."}</p>
            {!search && (
              <Button asChild>
                <Link href="/dashboard/projects/new">Create first project</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const sc = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.planning
            return (
              <Link key={p.id} href={`/dashboard/projects/${p.id}`}>
                <Card className="hover:border-primary/30 hover:bg-white/[0.03] transition-all cursor-pointer h-full">
                  <CardContent className="py-5 px-5 flex flex-col gap-4 h-full">
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-9 w-9 flex-shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                        <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                        </svg>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${sc.cls}`}>
                        {sc.label}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-foreground">{p.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {p.description || "No description provided."}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground border-t border-border pt-3">
                      Created {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
