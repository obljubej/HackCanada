"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { askQuestion, getOAuthStatus, getOAuthLoginUrl, ingestDriveUrl, ingestGithubRepo, resetChat, getUsers, addPersonalClaim } from "@/lib/api"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Alert, AlertDescription } from "@/components/ui/Alert"

interface Memory {
  id: string
  memory_type: string
  content: string
  final_score?: number
  weight?: number
  confidence?: number
  similarity?: number
}

interface Message {
  role: "user" | "assistant"
  content: string
  memories?: Memory[]
}

interface ClaimSaveResult {
  memoryId?: string
  documentId?: string
  memoryType?: string
}

const memoryTypeBadgeColors: Record<string, string> = {
  fact: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  task: "bg-red-500/10 text-red-400 border-red-500/20",
  project: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  preference: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  person: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  summary: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
}

export default function DashboardChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const cloneFromQuery = searchParams.get("clone")
  const [ready, setReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I can answer questions about your ingested documents and memories. Ask me anything.",
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [showIngest, setShowIngest] = useState(false)
  const [driveUrl, setDriveUrl] = useState("")
  const [githubUrl, setGithubUrl] = useState("")
  const [ingesting, setIngesting] = useState(false)
  const [ingestResult, setIngestResult] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [memoryUserId, setMemoryUserId] = useState("default-user")
  const [availableUsers, setAvailableUsers] = useState<string[]>(["default-user"])
  const [personalMode, setPersonalMode] = useState(false)
  const [personalClaim, setPersonalClaim] = useState("")
  const [savingClaim, setSavingClaim] = useState(false)
  const [lastClaimSave, setLastClaimSave] = useState<ClaimSaveResult | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Validate session (dashboard layout already guards auth; this just grabs the user id)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id)
      }
      setReady(true)
    })
  }, [])

  useEffect(() => {
    getOAuthStatus()
      .then((d) => setGoogleConnected(d.connected))
      .catch(() => {})
    getUsers()
      .then((users) => {
        const resolved = users.length > 0 ? users : ["default-user"]
        setAvailableUsers(resolved)
        if (cloneFromQuery && resolved.includes(cloneFromQuery)) {
          setMemoryUserId(cloneFromQuery)
        }
      })
      .catch(() => {})
  }, [cloneFromQuery])

  useEffect(() => {
    if (!cloneFromQuery || !availableUsers.includes(cloneFromQuery)) return
    setMemoryUserId(cloneFromQuery)
    setThreadId(null)
  }, [cloneFromQuery, availableUsers])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // Intercept GitHub OAuth Callback Success
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("github_connected") === "true") {
        // Switch the active memory group to the real Supabase userId that was used for ingestion
        const memUser = urlParams.get("memory_user");
        if (memUser) {
          setMemoryUserId(memUser);
          setThreadId(null); // start a fresh thread in the new memory context
        }

        setShowIngest(true);
        setIngestResult({
          type: "success",
          text: `GitHub Authenticated! Your repositories are being ingested into Supabase${memUser ? ` for user ${memUser.slice(0, 8)}…` : ""}.`
        });
        
        // Clean up the URL parameters
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: newUrl }, "", newUrl);
      }
    }
  }, [])

  const handleSend = async () => {
    const q = input.trim()
    if (!q || loading) return

    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: q }])
    setLoading(true)

    const chatUserId = personalMode && userId ? userId : memoryUserId

    try {
      const data = await askQuestion(q, chatUserId, threadId ?? undefined)
      setThreadId(data.threadId)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          memories: data.retrievedMemories,
        },
      ])
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` },
      ])
    }

    setLoading(false)
  }

  const handleTeachAndSend = async () => {
    if (!personalMode || !userId || loading) {
      await handleSend()
      return
    }

    const claim = input.trim()
    if (!claim) return

    setLoading(true)
    setIngestResult(null)

    try {
      const saved = await addPersonalClaim(claim, userId)
      setLastClaimSave({
        memoryId: saved.memoryId,
        documentId: saved.documentId,
        memoryType: saved.memoryType,
      })
      setIngestResult({
        type: "success",
        text: `Saved to DB ✓ type=${saved.memoryType || "fact"} memoryId=${saved.memoryId || "n/a"}`,
      })
    } catch (err: any) {
      setIngestResult({
        type: "error",
        text: err.message || "Failed to save personal claim",
      })
    }

    setLoading(false)
    await handleSend()
  }

  const handleReset = async () => {
    const chatUserId = personalMode && userId ? userId : memoryUserId
    await resetChat(chatUserId)
    setThreadId(null)
    setMessages([
      {
        role: "assistant",
        content: "Chat reset. Ask me anything about your documents.",
      },
    ])
  }

  const handleAddClaim = async () => {
    if (!userId) return
    const claim = personalClaim.trim()
    if (!claim || savingClaim) return

    setSavingClaim(true)
    setIngestResult(null)
    try {
      const result = await addPersonalClaim(claim, userId)
      setLastClaimSave({
        memoryId: result.memoryId,
        documentId: result.documentId,
        memoryType: result.memoryType,
      })
      setIngestResult({
        type: "success",
        text: `Saved to DB ✓ type=${result.memoryType || "fact"} memoryId=${result.memoryId || "n/a"}`,
      })
      setPersonalClaim("")
    } catch (err: any) {
      setIngestResult({
        type: "error",
        text: err.message || "Failed to save personal claim",
      })
    }
    setSavingClaim(false)
  }

  const handleIngest = async () => {
    if (!driveUrl.trim()) return
    setIngesting(true)
    setIngestResult(null)
    try {
      const data = await ingestDriveUrl(driveUrl.trim(), memoryUserId)
      if (data.ingested !== undefined) {
        setIngestResult({
          type: "success",
          text: `Successfully ingested ${data.ingested} documents (${data.results?.reduce((s: number, r: any) => s + r.memoriesInserted, 0) || 0} memories extracted).`,
        })
      } else {
        setIngestResult({
          type: "success",
          text: `Successfully ingested "${data.title}" (${data.memoriesInserted} memories extracted).`,
        })
      }
      setDriveUrl("")
    } catch (err: any) {
      setIngestResult({ type: "error", text: err.message || "Failed to ingest document" })
    }
    setIngesting(false)
  }

  const handleGithubIngest = async () => {
    if (!githubUrl.trim()) return
    setIngesting(true)
    setIngestResult(null)
    try {
      const data = await ingestGithubRepo(githubUrl.trim(), memoryUserId)
      setIngestResult({
        type: "success",
        text: `GitHub ingest complete: ${data.ingested}/${data.selectedFiles ?? data.totalFiles ?? 0} files (${data.failed ?? 0} failed).`,
      })
      setGithubUrl("")
    } catch (err: any) {
      setIngestResult({ type: "error", text: err.message || "Failed to ingest GitHub repository" })
    }
    setIngesting(false)
  }

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading chat…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Toolbar ───────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-background/80 backdrop-blur-sm px-4 sm:px-6 py-2 flex flex-wrap items-center gap-3">
        {/* Memory Group selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground hidden sm:block">Memory Group</label>
          <select
            value={memoryUserId}
            onChange={(e) => {
              const selected = e.target.value
              setMemoryUserId(selected)
              setThreadId(null)
              router.replace(`/dashboard/chat?clone=${encodeURIComponent(selected)}`)
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
          >
            {availableUsers.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        <div className="h-5 w-px bg-border hidden sm:block" />

        <button
          type="button"
          onClick={() => {
            setPersonalMode((prev) => !prev)
            setThreadId(null)
          }}
          className={`inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors ${
            personalMode
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border-input bg-background text-muted-foreground hover:text-foreground"
          }`}
          title="Toggle personal AI mode"
        >
          Personal AI {personalMode ? "On" : "Off"}
        </button>

        <div className="h-5 w-px bg-border hidden sm:block" />

        {/* Ingest toggle */}
        <Button
          variant={showIngest ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowIngest(!showIngest)}
        >
          <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Ingest Data
        </Button>

        {/* Google Drive status */}
        {googleConnected ? (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-md text-xs font-semibold border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Drive Connected
          </div>
        ) : (
          <a href={getOAuthLoginUrl()}>
            <Button variant="outline" size="sm" className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400" type="button">
              Connect Google Drive
            </Button>
          </a>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* New Thread */}
          <Button variant="ghost" size="sm" onClick={handleReset} title="New Thread">
            <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Thread
          </Button>
        </div>
      </div>

      {/* ── Ingest Panel (slide-down) ────────────────────────────── */}
      <div
        className={`shrink-0 border-b border-border bg-muted/30 transition-all duration-300 ease-in-out overflow-hidden ${
          showIngest ? "max-h-[36rem] opacity-100 py-4" : "max-h-0 opacity-0"
        }`}
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 flex flex-col gap-4">
          {personalMode && (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex-1 w-full space-y-1">
                <label className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Teach Your AI</label>
                <Input
                  type="text"
                  value={personalClaim}
                  onChange={(e) => setPersonalClaim(e.target.value)}
                  placeholder='Example: "I learned React and can build production dashboards."'
                  className="w-full bg-background"
                  onKeyDown={(e) => e.key === "Enter" && handleAddClaim()}
                  disabled={savingClaim}
                />
              </div>
              <div className="w-full sm:w-auto">
                <Button
                  onClick={handleAddClaim}
                  disabled={savingClaim || !personalClaim.trim()}
                  isLoading={savingClaim}
                  className="w-full sm:w-auto"
                >
                  {savingClaim ? "Saving..." : "Save Claim"}
                </Button>
              </div>
            </div>
          )}

          {/* Drive */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="flex-1 w-full space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Drive URL</label>
              <Input
                type="text"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="Paste Google Drive link (doc or folder)..."
                className="w-full bg-background"
                onKeyDown={(e) => e.key === "Enter" && handleIngest()}
                disabled={ingesting}
              />
            </div>
            <div className="w-full sm:w-auto">
              <Button onClick={handleIngest} disabled={ingesting || !driveUrl.trim()} isLoading={ingesting} className="w-full sm:w-auto">
                {ingesting ? "Extracting..." : "Ingest Document"}
              </Button>
            </div>
          </div>

          {/* GitHub OAuth Login */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="flex-1 w-full space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Connect GitHub Account</label>
              <div className="text-sm text-foreground/80 py-1.5 flex items-center gap-2">
                <svg className="h-4 w-4" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"></path></svg>
                Connect your profile natively to extract intelligence from up to 5 of your latest repositories.
              </div>
            </div>
            <div className="pt-0 sm:pt-5 w-full sm:w-auto flex flex-col gap-2">
              {/* Pass the real Supabase userId so the backend tags ingested data correctly */}
              <a href={`http://localhost:5000/api/github/oauth/login?supabase_user_id=${encodeURIComponent(userId || "default-user")}`}>
                <Button type="button" className="w-full sm:w-auto bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white">
                  Login with GitHub
                </Button>
              </a>
            </div>
          </div>

          {ingestResult && (
            <Alert variant={ingestResult.type === "success" ? "success" : "destructive"} className="py-2 px-3">
              <AlertDescription className="text-xs font-medium">{ingestResult.text}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* ── Chat Messages ────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-8 flex flex-col pb-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex w-full ${msg.role === "user" ? "justify-end pt-2" : "justify-start"}`}
            >
              <div
                className={`flex max-w-[85%] sm:max-w-[75%] flex-col gap-2 ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                {/* Bubble */}
                <div
                  className={`rounded-2xl px-5 py-3.5 shadow-sm text-[15px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground border border-border rounded-tl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* Memories drawer */}
                {msg.memories && msg.memories.length > 0 && (
                  <Card className="w-full mt-1 bg-background border-border shadow-none overflow-hidden">
                    <details className="group marker:content-['']">
                      <summary className="flex cursor-pointer items-center justify-between p-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors outline-none select-none">
                        <span className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          Used {msg.memories.length} memories
                        </span>
                        <svg className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="border-t border-border px-3 py-3 bg-muted/10 space-y-3 max-h-96 overflow-y-auto">
                        {msg.memories.map((m, j) => (
                          <div
                            key={j}
                            className="flex flex-col gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 text-sm"
                          >
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider border ${
                                  memoryTypeBadgeColors[m.memory_type] || "bg-gray-500/10 text-gray-400 border-gray-500/20"
                                }`}
                              >
                                {m.memory_type}
                              </span>
                              {m.final_score !== undefined && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-background px-2 py-0.5 rounded border border-border">
                                  Score: <span className="text-foreground font-medium">{m.final_score.toFixed(3)}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-muted-foreground text-[13px] leading-snug">{m.content}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  </Card>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-end gap-2 text-muted-foreground text-sm">
                <div className="flex items-center gap-1.5 bg-muted rounded-2xl p-4 border border-border rounded-tl-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* ── Composer ─────────────────────────────────────────────── */}
      <footer className="shrink-0 border-t border-border bg-background/95 backdrop-blur-sm p-4">
        <div className="mx-auto max-w-4xl relative flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleTeachAndSend()
              }
            }}
            placeholder="Ask RelAI about your documents…"
            className="w-full resize-none rounded-xl border border-input bg-background pl-4 pr-16 py-3.5 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 min-h-[52px] max-h-32 overflow-y-auto shadow-sm"
            disabled={loading}
            rows={1}
          />
          <div className="absolute right-2 bottom-1.5">
              <Button
                size="icon"
                onClick={handleTeachAndSend}
                disabled={loading || !input.trim()}
                className="h-[40px] w-[40px] rounded-lg shadow-sm"
              >
              <svg className="h-4 w-4 translate-x-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </div>
        {personalMode && lastClaimSave && (
          <div className="mx-auto mt-2 max-w-4xl rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
            Saved to database: memoryId <span className="font-mono">{lastClaimSave.memoryId || "n/a"}</span>
            {" · "}documentId <span className="font-mono">{lastClaimSave.documentId || "n/a"}</span>
            {" · "}type <span className="font-mono">{lastClaimSave.memoryType || "fact"}</span>
          </div>
        )}
        <div className="mx-auto max-w-4xl pt-2 text-center">
          <p className="text-[11px] text-muted-foreground font-medium">
            RelAI can make mistakes. Consider verifying important information.
          </p>
        </div>
      </footer>
    </div>
  )
}
