"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { analyzeProject, rankEmployees } from "@/lib/backboard"
import { getEmployees, createProject, assignEmployee, createNotification } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Alert, AlertDescription } from "@/components/ui/Alert"
import type { BackboardAnalysis, BackboardRanking, EmployeeRankResult } from "@/lib/types"

type Step = "upload" | "analyze" | "rank" | "confirm"

const COMPLEXITY_COLORS: Record<string, string> = {
  low:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  high:   "text-red-400 bg-red-500/10 border-red-500/20",
}

export default function NewProjectPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>("upload")
  const [title, setTitle] = useState("")
  const [pdfText, setPdfText] = useState("")
  const [fileName, setFileName] = useState("")
  const [analysis, setAnalysis] = useState<BackboardAnalysis | null>(null)
  const [rankings, setRankings] = useState<BackboardRanking[]>([])
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, string>>({}) // role → employee_id
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState("")

  // ── PDF Extraction ───────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || file.type !== "application/pdf") {
      setError("Please select a PDF file.")
      return
    }
    setError("")
    setFileName(file.name)

    try {
      // Use pdfjs-dist to extract text client-side
      const pdfjs = await import("pdfjs-dist")
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
      let text = ""
      for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map((item: any) => item.str).join(" ") + "\n"
      }
      setPdfText(text.trim())
    } catch {
      // Fallback: use file name + title as synthetic content for demo purposes
      const fallback = `Project: ${file.name.replace(".pdf", "")}\n${title}\nThis project requires frontend and backend engineering work with UI design and API integrations.`
      setPdfText(fallback)
    }
  }

  // ── Analyze Step ─────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (!title.trim()) { setError("Enter a project title."); return }
    if (!pdfText && !title) { setError("Upload a PDF or describe the project."); return }

    setError("")
    setAnalyzing(true)
    setStep("analyze")

    try {
      const content = pdfText || `Project: ${title}\nRequired: engineering, design, product management`
      const result = await analyzeProject(content)
      setAnalysis(result)

      const employees = await getEmployees()
      const ranked = await rankEmployees(result, employees)
      setRankings(ranked)

      // Pre-select top available candidate per role
      const initial: Record<string, string> = {}
      ranked.forEach(({ role, candidates }) => {
        const best = candidates.find((c) => c.available) ?? candidates[0]
        if (best) initial[role] = best.employee_id
      })
      setSelectedCandidates(initial)
      setStep("rank")
    } catch (err: any) {
      setError(err.message || "Analysis failed")
      setStep("upload")
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Confirm & Create ─────────────────────────────────────────────────────

  const handleCreate = async () => {
    setSaving(true)
    setError("")
    try {
      const { data: { session } } = await supabase.auth.getSession()

      const project = await createProject({
        title: title.trim(),
        description: analysis?.summary ?? pdfText.slice(0, 200),
        status: "planning",
        manager_id: session?.user.id,
      })

      // Group assignments by employee so we don't violate the unique constraint
      const groupedAssignments: Record<string, string[]> = {}
      for (const [role, empId] of Object.entries(selectedCandidates)) {
        if (empId) {
          if (!groupedAssignments[empId]) groupedAssignments[empId] = []
          groupedAssignments[empId].push(role)
        }
      }

      for (const [empId, roles] of Object.entries(groupedAssignments)) {
        const combinedRoles = roles.join(", ")
        await assignEmployee(project.id, empId, combinedRoles)

        // Find candidate info for notifications from any matching ranking
        const candidate = rankings.flatMap((r) => r.candidates).find((c) => c.employee_id === empId)

        if (session?.user.id) {
          await createNotification({
            user_id: session.user.id,
            type: "assignment",
            message: `${candidate?.employee_name ?? "Employee"} has been assigned as ${combinedRoles} on project "${title}".`,
            read: false,
          })
        }
      }

      router.push(`/dashboard/projects/${project.id}`)
    } catch (err: any) {
      setError(err.message || "Failed to create project")
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">New Project</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Upload a project brief and let AI recommend your ideal team.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(["upload", "analyze", "rank"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              step === s ? "bg-primary text-primary-foreground" :
              (step === "rank" && i < 2) || (step === "analyze" && i < 1) || step === "confirm"
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            }`}>{i + 1}</div>
            <span className="text-xs text-muted-foreground capitalize hidden sm:block">{s === "upload" ? "Upload" : s === "analyze" ? "Analyze" : "Select Team"}</span>
            {i < 2 && <div className="h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Step 1: Upload */}
      {(step === "upload" || step === "analyze") && (
        <Card>
          <CardHeader><CardTitle className="text-base">Project Details</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Customer Portal Redesign"
                disabled={analyzing}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project Brief (PDF)</label>
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {fileName ? (
                  <div className="flex flex-col items-center gap-2">
                    <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium text-foreground">{fileName}</p>
                    <p className="text-xs text-muted-foreground">{pdfText ? `${pdfText.split(" ").length} words extracted` : "Processing…"}</p>
                    <button type="button" className="text-xs text-primary hover:underline" onClick={(e) => { e.stopPropagation(); setFileName(""); setPdfText(""); if (fileRef.current) fileRef.current.value = "" }}>
                      Change file
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <svg className="h-8 w-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <p className="text-sm font-medium text-muted-foreground">Click to upload PDF</p>
                    <p className="text-xs text-muted-foreground/60">Project description, requirements, or brief</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
              <p className="text-xs text-muted-foreground">No PDF? The AI will analyze based on your title and common project patterns.</p>
            </div>

            <Button onClick={handleAnalyze} isLoading={analyzing} className="w-full sm:w-auto" disabled={!title.trim() || analyzing}>
              {analyzing ? "Analyzing with AI…" : "Analyze & Get Team Recommendations"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2 & 3: Rankings */}
      {step === "rank" && analysis && (
        <div className="space-y-6">
          {/* Analysis Summary */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-5 px-5">
              <div className="flex flex-wrap gap-4 items-start">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">AI Summary</p>
                  <p className="text-sm text-foreground">{analysis.summary}</p>
                </div>
                <div className="flex gap-3 flex-shrink-0 ml-auto">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{analysis.team_size}</p>
                    <p className="text-[11px] text-muted-foreground">team size</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-semibold px-2 py-0.5 rounded border ${COMPLEXITY_COLORS[analysis.complexity]}`}>{analysis.complexity}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">complexity</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {analysis.required_roles.map((r) => (
                  <span key={r.role} className="text-xs px-2 py-0.5 rounded bg-background border border-border text-muted-foreground">
                    {r.count}× {r.role}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Role Rankings */}
          <form onSubmit={(e) => { e.preventDefault(); handleCreate() }} className="space-y-5">
            {rankings.map(({ role, candidates }) => (
              <Card key={role}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span>{role}</span>
                    <span className="text-xs font-normal text-muted-foreground">— select a candidate</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {candidates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No matching employees found. Add employees first.</p>
                    ) : candidates.map((c: EmployeeRankResult) => {
                      const isSelected = selectedCandidates[role] === c.employee_id
                      const isUnavailable = !c.available

                      return (
                        <button
                          key={c.employee_id}
                          type="button"
                          onClick={() => setSelectedCandidates((prev) => ({ ...prev, [role]: c.employee_id }))}
                          className={`w-full text-left rounded-lg border p-3 transition-all ${
                            isSelected
                              ? "border-primary/40 bg-primary/10"
                              : "border-border bg-background hover:border-border/80 hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                                {c.employee_name[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground">{c.employee_name}</p>
                                {c.matched_skills.length > 0 && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    Matches: {c.matched_skills.slice(0, 3).join(", ")}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isUnavailable && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-semibold">
                                  Busy
                                </span>
                              )}
                              <div className="text-right">
                                <div className={`text-sm font-bold ${c.match_score >= 80 ? "text-emerald-400" : c.match_score >= 60 ? "text-amber-400" : "text-muted-foreground"}`}>
                                  {c.match_score}%
                                </div>
                                <div className="text-[10px] text-muted-foreground">match</div>
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}

            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button type="submit" isLoading={saving}>
                Create Project & Assign Team
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
