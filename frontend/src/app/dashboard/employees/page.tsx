"use client"

import { useState, useEffect, useCallback } from "react"
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from "@/lib/db"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card, CardContent } from "@/components/ui/Card"
import { Alert, AlertDescription } from "@/components/ui/Alert"
import type { Employee } from "@/lib/types"

const ROLES = [
  "Frontend Engineer", "Backend Engineer", "Full Stack Engineer",
  "Product Manager", "UX Designer", "Data Scientist",
  "DevOps Engineer", "QA Engineer", "Engineering Manager",
  "CEO", "CTO",
]

const DEPARTMENTS = ["Engineering", "Product", "Design", "Data", "Operations", "Leadership"]

const SKILL_SUGGESTIONS = [
  "React", "TypeScript", "Next.js", "Node.js", "Python", "GraphQL",
  "PostgreSQL", "AWS", "Docker", "Figma", "SQL", "Machine Learning",
  "Go", "Rust", "Kubernetes", "CI/CD", "Product Strategy",
]

function EmployeeModal({
  employee,
  onSave,
  onClose,
}: {
  employee?: Employee | null
  onSave: (data: Omit<Employee, "id" | "created_at">) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(employee?.name ?? "")
  const [role, setRole] = useState(employee?.role ?? "")
  const [department, setDepartment] = useState(employee?.department ?? "")
  const [availability, setAvailability] = useState(employee?.availability ?? true)
  const [skillInput, setSkillInput] = useState("")
  const [skills, setSkills] = useState<string[]>(employee?.skills ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const addSkill = (sk: string) => {
    const trimmed = sk.trim()
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed])
    }
    setSkillInput("")
  }

  const removeSkill = (sk: string) => setSkills((prev) => prev.filter((s) => s !== sk))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !role.trim()) { setError("Name and role are required."); return }
    setSaving(true)
    setError("")
    try {
      await onSave({ name: name.trim(), role: role.trim(), department, availability, skills })
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to save employee")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{employee ? "Edit Employee" : "Add Employee"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select role…</option>
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select department…</option>
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Availability</label>
              <button
                type="button"
                onClick={() => setAvailability(!availability)}
                className={`h-10 w-full rounded-md border text-sm font-medium transition-colors ${
                  availability
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}
              >
                {availability ? "Available" : "Not Available"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Skills</label>
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                placeholder="Type a skill and press Enter"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(skillInput) } }}
              />
              <Button type="button" variant="secondary" onClick={() => addSkill(skillInput)}>Add</Button>
            </div>

            {/* Quick-add suggestions */}
            <div className="flex flex-wrap gap-1.5">
              {SKILL_SUGGESTIONS.filter((s) => !skills.includes(s)).slice(0, 8).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addSkill(s)}
                  className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>

            {/* Added skills */}
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {skills.map((sk) => (
                  <span key={sk} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium border border-primary/20">
                    {sk}
                    <button type="button" onClick={() => removeSkill(sk)} className="hover:text-red-400 transition-colors ml-0.5">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={saving}>{employee ? "Save Changes" : "Add Employee"}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Employee | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setEmployees(await getEmployees())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: Omit<Employee, "id" | "created_at">) => {
    if (editTarget) {
      await updateEmployee(editTarget.id, data)
    } else {
      await createEmployee(data)
    }
    await load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this employee?")) return
    await deleteEmployee(id)
    await load()
  }

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.role.toLowerCase().includes(search.toLowerCase()) ||
      (e.department ?? "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{employees.length} members across your organization</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setShowModal(true) }}>
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Employee
        </Button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="flex gap-3">
        <Input
          placeholder="Search by name, role, or department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}><CardContent className="py-6"><div className="h-20 rounded-lg bg-muted animate-pulse" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 gap-4">
            <svg className="h-10 w-10 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="text-sm text-muted-foreground">{search ? "No employees match your search." : "No employees yet."}</p>
            {!search && <Button onClick={() => setShowModal(true)}>Add your first employee</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((emp) => (
            <Card key={emp.id} className="hover:border-border/60 transition-colors">
              <CardContent className="py-5 px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                      {emp.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{emp.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.role}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${emp.availability ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                    {emp.availability ? "Available" : "Busy"}
                  </span>
                </div>

                {emp.department && (
                  <p className="mt-3 text-xs text-muted-foreground">{emp.department}</p>
                )}

                {emp.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {emp.skills.slice(0, 4).map((sk) => (
                      <span key={sk} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                        {sk}
                      </span>
                    ))}
                    {emp.skills.length > 4 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                        +{emp.skills.length - 4}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-4 flex gap-2 border-t border-border pt-3">
                  <button
                    onClick={() => { setEditTarget(emp); setShowModal(true) }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Edit
                  </button>
                  <span className="text-border">·</span>
                  <button
                    onClick={() => handleDelete(emp.id)}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <EmployeeModal
          employee={editTarget}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
        />
      )}
    </div>
  )
}
