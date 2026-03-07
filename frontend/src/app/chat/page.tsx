"use client"

import { useState, useEffect, useRef } from "react"
import { supabase, isSessionExpired, clearLoginTime, markLoginTime } from "@/lib/supabase"
import { askQuestion, getOAuthStatus, getOAuthLoginUrl, ingestDriveUrl, resetChat, getUsers } from "@/lib/api"
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

interface UserInfo {
  id: string
  email: string
  name: string
}

export default function ChatPage() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
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
  const [ingesting, setIngesting] = useState(false)
  const [ingestResult, setIngestResult] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [memoryUserId, setMemoryUserId] = useState("default-user")
  const [availableUsers, setAvailableUsers] = useState<string[]>(["default-user"])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Check auth + session expiry on mount
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session || isSessionExpired()) {
        clearLoginTime()
        await supabase.auth.signOut()
        window.location.href = "/"
        return
      }
      markLoginTime()
      const fullName = session.user.user_metadata?.full_name || session.user.email || ""
      await supabase.from("profiles").upsert(
        { id: session.user.id, email: session.user.email || "", full_name: fullName },
        { onConflict: "id" }
      )
      setUser({
        id: session.user.id,
        email: session.user.email || "",
        name: fullName,
      })
      setAuthChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        window.location.href = "/"
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    getOAuthStatus()
      .then((d) => setGoogleConnected(d.connected))
      .catch(() => {})
    getUsers()
      .then((users) => {
        setAvailableUsers(users.length > 0 ? users : ["default-user"])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const handleSignOut = async () => {
    clearLoginTime()
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  const handleSend = async () => {
    const q = input.trim()
    if (!q || loading || !user) return

    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: q }])
    setLoading(true)

    try {
      const data = await askQuestion(q, memoryUserId, threadId ?? undefined)
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

  const handleReset = async () => {
    if (!user) return
    await resetChat(memoryUserId)
    setThreadId(null)
    setMessages([
      {
        role: "assistant",
        content: "Chat reset. Ask me anything about your documents.",
      },
    ])
  }

  const handleIngest = async () => {
    if (!driveUrl.trim() || !user) return
    setIngesting(true)
    setIngestResult(null)
    try {
      const data = await ingestDriveUrl(driveUrl.trim(), memoryUserId)
      if (data.ingested !== undefined) {
        setIngestResult({ 
          type: "success", 
          text: `Successfully ingested ${data.ingested} documents (${data.results?.reduce((s: number, r: any) => s + r.memoriesInserted, 0) || 0} memories extracted).` 
        })
      } else {
        setIngestResult({ 
          type: "success", 
          text: `Successfully ingested "${data.title}" (${data.memoriesInserted} memories extracted).` 
        })
      }
      setDriveUrl("")
    } catch (err: any) {
      setIngestResult({ type: "error", text: err.message || "Failed to ingest document" })
    }
    setIngesting(false)
  }

  const memoryTypeBadgeColors: Record<string, string> = {
    fact: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    task: "bg-red-500/10 text-red-400 border-red-500/20",
    project: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    preference: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    person: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    summary: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <svg className="h-8 w-8 animate-spin text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm text-muted-foreground font-medium">Authenticating...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground overflow-hidden">
      {/* App Shell Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 sm:px-6 backdrop-blur-md z-10">
        <div className="flex items-center gap-3 sm:gap-6">
          <a href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-sm">
              R
            </div>
            <span className="hidden sm:inline-block text-lg font-bold tracking-tight">RelAI</span>
          </a>
          
          <div className="h-6 w-px bg-border hidden sm:block" />
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <label className="text-xs font-medium text-muted-foreground hidden sm:block">Memory Group</label>
            <select
              value={memoryUserId}
              onChange={(e) => {
                setMemoryUserId(e.target.value)
                setThreadId(null)
              }}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
            >
              {availableUsers.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant={showIngest ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowIngest(!showIngest)}
            className="hidden sm:flex"
          >
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Ingest Data
          </Button>

          {googleConnected ? (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-md text-xs font-semibold border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Drive Connected
            </div>
          ) : (
            <a href={getOAuthLoginUrl()} className="hidden sm:flex">
              <Button variant="outline" size="sm" className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400" type="button">
                Connect Google Drive
              </Button>
            </a>
          )}

          <div className="h-6 w-px bg-border ml-2" />

          <Button variant="ghost" size="sm" onClick={handleReset} title="New Chat" className="px-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline-block ml-2">New Thread</span>
          </Button>

          <Button variant="ghost" size="sm" onClick={handleSignOut} title="Sign Out" className="px-2 text-muted-foreground hover:text-destructive">
             <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </Button>
        </div>
      </header>

      {/* Responsive Ingest Panel (Slide Over / Dropdown) */}
      <div className={`border-b border-border bg-muted/30 transition-all duration-300 ease-in-out overflow-hidden ${showIngest ? "max-h-96 opacity-100 py-4" : "max-h-0 opacity-0"}`}>
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
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
             <div className="pt-0 sm:pt-5 w-full sm:w-auto flex flex-col gap-2">
                <Button onClick={handleIngest} disabled={ingesting || !driveUrl.trim()} isLoading={ingesting} className="w-full sm:w-auto">
                  {ingesting ? "Extracting..." : "Ingest Document"}
                </Button>
             </div>
          </div>
          {ingestResult && (
             <div className="mt-3">
               <Alert variant={ingestResult.type === "success" ? "success" : "destructive"} className="py-2 px-3">
                 <AlertDescription className="text-xs font-medium">{ingestResult.text}</AlertDescription>
               </Alert>
             </div>
          )}
        </div>
      </div>

      {/* Chat Timeline */}
      <main className="flex-1 overflow-y-auto px-4 py-8">
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
                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-5 py-3.5 shadow-sm text-[15px] leading-relaxed relative ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground border border-border rounded-tl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* Memories / Sources Drawer */}
                {msg.memories && msg.memories.length > 0 && (
                  <Card className="w-full mt-1 bg-background border-border shadow-none overflow-hidden hover:border-border/80 transition-colors">
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
              <div className="flex max-w-[85%] items-end gap-2 text-muted-foreground text-sm font-medium py-2">
                 <div className="flex items-center gap-1.5 bg-muted rounded-2xl p-4 border border-border rounded-tl-sm">
                   <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]"></span>
                   <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]"></span>
                   <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"></span>
                 </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Composer Footer */}
      <footer className="shrink-0 border-t border-border bg-background/95 backdrop-blur-sm p-4 z-10">
        <div className="mx-auto max-w-4xl relative flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Ask RelAI about your documents..."
            className="w-full resize-none rounded-xl border border-input bg-background pl-4 pr-16 py-3.5 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 min-h-[52px] max-h-32 overflow-y-auto shadow-sm"
            disabled={loading}
            rows={1}
          />
          <div className="absolute right-2 bottom-1.5">
             <Button
                size="icon"
                onClick={handleSend}
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
        <div className="mx-auto max-w-4xl pt-2 text-center">
            <p className="text-[11px] text-muted-foreground font-medium">
               RelAI can make mistakes. Consider verifying important information.
            </p>
        </div>
      </footer>
    </div>
  )
}
