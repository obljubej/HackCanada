"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { askQuestion, getOAuthStatus, getOAuthLoginUrl, ingestDriveUrl, resetChat, getUsers } from "@/lib/api"

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
  const [ingestResult, setIngestResult] = useState("")
  const [memoryUserId, setMemoryUserId] = useState("default-user")
  const [availableUsers, setAvailableUsers] = useState<string[]>(["default-user"])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Check auth on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.href = "/"
        return
      }
      setUser({
        id: session.user.id,
        email: session.user.email || "",
        name: session.user.user_metadata?.full_name || session.user.email || "",
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
    setIngestResult("")
    try {
      const data = await ingestDriveUrl(driveUrl.trim(), memoryUserId)
      if (data.ingested !== undefined) {
        setIngestResult(`Ingested ${data.ingested} documents (${data.results?.reduce((s: number, r: any) => s + r.memoriesInserted, 0) || 0} memories)`)
      } else {
        setIngestResult(`Ingested "${data.title}" (${data.memoriesInserted} memories)`)
      }
      setDriveUrl("")
    } catch (err: any) {
      setIngestResult(`Error: ${err.message}`)
    }
    setIngesting(false)
  }

  const memoryTypeColor: Record<string, string> = {
    fact: "bg-blue-500/20 text-blue-300",
    task: "bg-red-500/20 text-red-300",
    project: "bg-green-500/20 text-green-300",
    preference: "bg-yellow-500/20 text-yellow-300",
    person: "bg-purple-500/20 text-purple-300",
    summary: "bg-cyan-500/20 text-cyan-300",
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="text-2xl font-bold tracking-tight">
            RelAI
          </a>
          <span className="text-sm text-gray-500">Memory Chat</span>
          <select
            value={memoryUserId}
            onChange={(e) => {
              setMemoryUserId(e.target.value)
              setThreadId(null)
            }}
            className="ml-2 px-2 py-1 text-xs bg-white/5 border border-white/20 rounded-lg text-gray-300 focus:outline-none focus:border-white/40 cursor-pointer"
          >
            {availableUsers.map((u) => (
              <option key={u} value={u} className="bg-black text-white">
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowIngest(!showIngest)}
            className="px-3 py-1.5 text-xs border border-white/20 rounded-lg text-gray-400 hover:text-white hover:border-white/40 transition-colors"
          >
            {showIngest ? "Hide" : "Ingest"}
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs border border-white/20 rounded-lg text-gray-400 hover:text-white hover:border-white/40 transition-colors"
          >
            New Chat
          </button>
          {googleConnected ? (
            <span className="text-xs text-green-400">Drive connected</span>
          ) : (
            <a
              href={getOAuthLoginUrl()}
              className="px-3 py-1.5 text-xs bg-white/10 rounded-lg text-yellow-300 hover:bg-white/20 transition-colors"
            >
              Connect Google
            </a>
          )}
          <div className="flex items-center gap-2 pl-3 border-l border-white/10">
            <span className="text-xs text-gray-400">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="px-2 py-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Ingest panel */}
      {showIngest && (
        <div className="border-b border-white/10 px-6 py-4 bg-white/[0.02]">
          <div className="max-w-3xl mx-auto flex gap-3 items-center">
            <input
              type="text"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="Paste Google Drive link (doc or folder)..."
              className="flex-1 px-4 py-2.5 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-white/40"
              onKeyDown={(e) => e.key === "Enter" && handleIngest()}
            />
            <button
              onClick={handleIngest}
              disabled={ingesting}
              className="px-4 py-2.5 bg-white/10 rounded-lg text-sm font-medium hover:bg-white/20 disabled:opacity-50 transition-colors"
            >
              {ingesting ? "Ingesting..." : "Ingest"}
            </button>
          </div>
          {ingestResult && (
            <p className="max-w-3xl mx-auto mt-2 text-xs text-gray-400">
              {ingestResult}
            </p>
          )}
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-white/10 rounded-2xl rounded-br-sm"
                    : "bg-transparent"
                } px-4 py-3`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                {msg.memories && msg.memories.length > 0 && (
                  <details className="mt-4 border-t border-white/10 pt-3">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 transition-colors">
                      {msg.memories.length} supporting memories
                    </summary>
                    <div className="mt-3 space-y-2">
                      {msg.memories.map((m, j) => (
                        <div
                          key={j}
                          className="bg-white/[0.03] border border-white/10 rounded-lg p-3"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                                memoryTypeColor[m.memory_type] || "bg-gray-500/20 text-gray-300"
                              }`}
                            >
                              {m.memory_type}
                            </span>
                            {m.final_score !== undefined && (
                              <span className="text-[10px] text-gray-600">
                                {m.final_score.toFixed(2)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed">
                            {m.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  Searching memories...
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <div className="border-t border-white/10 px-6 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask about your documents..."
            className="flex-1 px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30 transition-all"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-6 py-3 bg-white text-black font-semibold rounded-xl text-sm hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
