"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { meetingsAPI } from "@/lib/api"
import { getEmployees, getProjects } from "@/lib/db"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card, CardContent } from "@/components/ui/Card"
import { Alert, AlertDescription } from "@/components/ui/Alert"
import type { Employee, Project } from "@/lib/types"

export default function NewMeetingPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [projectId, setProjectId] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([getEmployees(), getProjects()]).then(([emps, projs]) => {
      setEmployees(emps)
      setProjects(projs)
    }).catch(() => {})
  }, [])

  const toggleEmployee = (id: string) => {
    setSelectedEmployees(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError("Meeting title is required"); return }
    setLoading(true); setError("")
    try {
      const meeting = await meetingsAPI.create({
        title: title.trim(),
        project_id: projectId || undefined,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        participant_ids: selectedEmployees,
      })
      router.push(`/dashboard/meetings/${meeting.id}`)
    } catch (err: any) {
      setError(err.message || "Failed to create meeting")
      setLoading(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Schedule Meeting</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Create an AI-powered meeting with your team</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {/* Meeting title */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Meeting Title *</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Project Atlas Sprint Planning"
            required
          />
        </div>

        {/* Project + datetime */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link to Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">No project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schedule For</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Participants */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Invite Participants {selectedEmployees.length > 0 && <span className="text-primary ml-1">({selectedEmployees.length} selected)</span>}
          </label>
          {employees.length === 0 ? (
            <p className="text-xs text-muted-foreground">No employees found. Add team members first.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 max-h-72 overflow-y-auto pr-1">
              {employees.map((emp) => {
                const selected = selectedEmployees.includes(emp.id)
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => toggleEmployee(emp.id)}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all text-left ${
                      selected
                        ? "border-primary/40 bg-primary/10"
                        : "border-border hover:border-border/60 hover:bg-muted/50"
                    }`}
                  >
                    <div className={`h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold border ${
                      selected ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-foreground border-border"
                    }`}>
                      {(emp.name || "?")[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate">{emp.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{emp.role}</p>
                    </div>
                    <div className={`h-2 w-2 rounded-full flex-shrink-0 ${emp.availability ? "bg-emerald-400" : "bg-red-400"}`} />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* AI context note */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 flex gap-3">
            <svg className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-primary">AI Meeting Assistant</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The AI will have full context of participants, their skills, availability, and the linked project — enabling intelligent recommendations during the meeting.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" isLoading={loading} className="flex-1">
            Create Meeting Room
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
