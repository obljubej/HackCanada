"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { meetingsAPI } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

// ── Types ────────────────────────────────────────────────────

interface TranscriptEntry {
  speaker: string
  message: string
  created_at: string
}

interface ActionItem {
  task: string
  assignee: string
  due_date: string
}

interface MeetingSummary {
  summary_text: string
  key_decisions: string[]
  action_items: ActionItem[]
}

interface Participant {
  id: string
  name: string
  role: string
  availability: boolean
}

interface MeetingData {
  id: string
  title: string
  status: "scheduled" | "active" | "ended"
  projects?: { title: string; description: string }
  participants: Participant[]
  transcript: TranscriptEntry[]
  summary: MeetingSummary | null
}

// ── Web Speech API types ────────────────────────────────────

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

// ── ElevenLabs TTS ─────────────────────────────────────────

const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || ""
// Rachel voice — professional, clear US English
const ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"

let currentAudioSource: AudioBufferSourceNode | null = null

async function speakElevenLabs(text: string, onEnd?: () => void) {
  // Stop any currently playing audio
  currentAudioSource?.stop()
  currentAudioSource = null

  if (!ELEVENLABS_API_KEY) {
    // Fallback to browser TTS
    speakBrowser(text, onEnd)
    return
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!response.ok) throw new Error(`ElevenLabs error: ${response.status}`)

    const arrayBuffer = await response.arrayBuffer()
    const audioCtx = new AudioContext()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    const source = audioCtx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioCtx.destination)
    source.onended = () => {
      currentAudioSource = null
      onEnd?.()
    }
    source.start(0)
    currentAudioSource = source
  } catch (err) {
    console.warn("[TTS] ElevenLabs failed, falling back to browser TTS:", err)
    speakBrowser(text, onEnd)
  }
}

function speakBrowser(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) { onEnd?.(); return }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1.05
  if (onEnd) utterance.onend = onEnd
  window.speechSynthesis.speak(utterance)
}

// Main speak function — uses ElevenLabs
function speak(text: string, onEnd?: () => void) {
  speakElevenLabs(text, onEnd)
}


// ── Main Component ───────────────────────────────────────────

export default function MeetingRoomPage() {
  const params = useParams()
  const router = useRouter()
  const meetingId = params.id as string

  const [meeting, setMeeting] = useState<MeetingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [summary, setSummary] = useState<MeetingSummary | null>(null)

  // Voice state
  const [status, setStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle")
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const recognitionRef = useRef<any>(null)
  const [voiceSupported, setVoiceSupported] = useState(false)

  // Chat state
  const [textInput, setTextInput] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"transcript" | "chat" | "summary">("transcript")

  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // Load meeting data
  useEffect(() => {
    setVoiceSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition))
    meetingsAPI.get(meetingId).then((data) => {
      setMeeting(data)
      setTranscript(data.transcript || [])
      setSummary(data.summary)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [meetingId])

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcript])

  // ── AI Ask ───────────────────────────────────────────────

  const askAI = useCallback(async (question: string, voiceResponse = false) => {
    if (!question.trim()) return
    setAiLoading(true)
    setStatus("thinking")

    // Optimistic update
    const userEntry: TranscriptEntry = {
      speaker: "You",
      message: question,
      created_at: new Date().toISOString()
    }
    setTranscript(prev => [...prev, userEntry])

    try {
      const result = await meetingsAPI.ask(meetingId, { question })
      const aiEntry: TranscriptEntry = {
        speaker: "AI Assistant",
        message: result.answer,
        created_at: new Date().toISOString()
      }
      setTranscript(prev => [...prev, aiEntry])
      setActiveTab("transcript")

      if (voiceResponse && isVoiceActive && !isMuted) {
        setStatus("speaking")
        speak(result.answer, () => {
          setStatus("listening")
          startListening()
        })
      } else {
        setStatus("idle")
      }
    } catch (err) {
      const errEntry: TranscriptEntry = {
        speaker: "AI Assistant",
        message: "Sorry, I couldn't connect to the AI. Make sure the backend is running.",
        created_at: new Date().toISOString()
      }
      setTranscript(prev => [...prev, errEntry])
      setStatus("idle")
    }
    setAiLoading(false)
  }, [meetingId, isVoiceActive, isMuted])

  // ── Voice Recognition ────────────────────────────────────

  const startListening = useCallback(() => {
    if (!voiceSupported || isMuted) return
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SpeechRecognition()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = "en-US"

    rec.onresult = (event: any) => {
      const text = event.results[0][0].transcript
      if (text.trim()) {
        askAI(text, true)
      }
    }
    rec.onerror = () => {
      setStatus("idle")
    }
    rec.onend = () => {
      if (status === "listening") setStatus("idle")
    }

    recognitionRef.current = rec
    rec.start()
    setStatus("listening")
  }, [voiceSupported, isMuted, askAI, status])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    window.speechSynthesis?.cancel()
    setStatus("idle")
    setIsVoiceActive(false)
  }, [])

  // ── Meeting Controls ─────────────────────────────────────

  const handleStartMeeting = async () => {
    await meetingsAPI.start(meetingId)
    setMeeting(prev => prev ? { ...prev, status: "active" } : prev)
  }

  const handleEndMeeting = async () => {
    if (!confirm("End this meeting? The AI will generate a summary.")) return
    stopListening()
    await meetingsAPI.end(meetingId)
    setMeeting(prev => prev ? { ...prev, status: "ended" } : prev)

    // Poll for summary (generated async on backend)
    setActiveTab("summary")
    const poll = async (attempts = 0) => {
      if (attempts > 10) return
      const s = await meetingsAPI.getSummary(meetingId).catch(() => null)
      if (s) { setSummary(s); return }
      setTimeout(() => poll(attempts + 1), 2000)
    }
    setTimeout(() => poll(), 3000)
  }

  const handleVoiceToggle = () => {
    if (isVoiceActive) {
      stopListening()
    } else {
      setIsVoiceActive(true)
      startListening()
    }
  }

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = textInput.trim()
    setTextInput("")
    await askAI(q, false)
  }

  const handleGenerateSummary = async () => {
    setAiLoading(true)
    try {
      const s = await meetingsAPI.generateSummary(meetingId)
      setSummary(s)
      setActiveTab("summary")
    } catch { }
    setAiLoading(false)
  }

  // ── Loading ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading meeting room…</p>
        </div>
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Meeting not found.</p>
      </div>
    )
  }

  const isActive = meeting.status === "active"
  const isEnded = meeting.status === "ended"
  const isScheduled = meeting.status === "scheduled"

  const statusColors = {
    idle: "bg-gray-500",
    listening: "bg-emerald-500 animate-pulse",
    thinking: "bg-amber-500 animate-pulse",
    speaking: "bg-blue-500 animate-pulse",
  }

  const statusLabels = {
    idle: "Ready",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking…",
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* ── Left: AI + Controls ───────────────────────────── */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-border bg-background">
        {/* Meeting info */}
        <div className="p-5 border-b border-border space-y-3">
          <div className="flex items-start gap-2 justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-foreground truncate">{meeting.title}</h2>
              {meeting.projects && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">📁 {meeting.projects.title}</p>
              )}
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
              isActive ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
              isEnded ? "text-gray-400 bg-gray-500/10 border-gray-500/20" :
              "text-blue-400 bg-blue-500/10 border-blue-500/20"
            }`}>
              {isActive ? "LIVE" : isEnded ? "ENDED" : "SCHEDULED"}
            </span>
          </div>
        </div>

        {/* AI Avatar */}
        <div className="p-6 flex flex-col items-center gap-4 border-b border-border">
          <div className="relative">
            <div className={`h-20 w-20 rounded-full flex items-center justify-center border-2 transition-all ${
              status === "speaking" ? "border-blue-500 bg-blue-500/10" :
              status === "listening" ? "border-emerald-500 bg-emerald-500/10" :
              status === "thinking" ? "border-amber-500 bg-amber-500/10" :
              "border-border bg-muted"
            }`}>
              <svg className={`h-10 w-10 transition-all ${
                status !== "idle" ? "text-primary" : "text-muted-foreground/50"
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-background ${statusColors[status]}`} />
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-foreground">RelAI Assistant</p>
            <p className="text-[11px] text-muted-foreground">{statusLabels[status]}</p>
          </div>
        </div>

        {/* Voice controls */}
        <div className="p-5 space-y-3 border-b border-border">
          {!isActive && !isEnded && (
            <Button onClick={handleStartMeeting} className="w-full" size="sm">
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
              </svg>
              Start Meeting
            </Button>
          )}

          {isActive && (
            <>
              {voiceSupported && (
                <button
                  onClick={handleVoiceToggle}
                  disabled={status === "thinking"}
                  className={`w-full flex items-center justify-center gap-2 h-10 rounded-lg border text-sm font-semibold transition-all ${
                    isVoiceActive
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                      : "bg-card border-border text-foreground hover:bg-muted"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                  {isVoiceActive ? "Stop Voice" : "Start Voice"}
                </button>
              )}

              {isVoiceActive && (
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`w-full flex items-center justify-center gap-2 h-10 rounded-lg border text-sm font-medium transition-all ${
                    isMuted
                      ? "bg-red-500/10 border-red-500/20 text-red-400"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isMuted ? "🔇 Unmute" : "🎙 Mute"}
                </button>
              )}

              <Button onClick={handleEndMeeting} variant="outline" size="sm" className="w-full text-red-400 border-red-500/20 hover:bg-red-500/10">
                End Meeting
              </Button>
            </>
          )}

          {isEnded && (
            <Button onClick={handleGenerateSummary} variant="outline" size="sm" className="w-full" disabled={aiLoading}>
              {aiLoading ? "Generating…" : "Regenerate Summary"}
            </Button>
          )}
        </div>

        {/* Participants */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Participants ({meeting.participants.length})
          </p>
          <div className="space-y-2">
            {meeting.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5">
                <div className="h-7 w-7 flex-shrink-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary">
                  {(p.name || "?")[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{p.role}</p>
                </div>
                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${p.availability ? "bg-emerald-400" : "bg-red-400"}`} />
              </div>
            ))}
            {meeting.participants.length === 0 && (
              <p className="text-xs text-muted-foreground">No participants</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: Main Content ───────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-border px-6 gap-1 bg-background shrink-0">
          {(["transcript", "chat", "summary"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "transcript" ? "📝 Transcript" : tab === "chat" ? "💬 Chat" : "📊 Summary"}
              {tab === "transcript" && transcript.length > 0 && (
                <span className="ml-2 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{transcript.length}</span>
              )}
              {tab === "summary" && summary && (
                <span className="ml-2 text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full">Ready</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Transcript tab */}
          {activeTab === "transcript" && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {transcript.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                    <svg className="h-7 w-7 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">No transcript yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isScheduled ? "Start the meeting to begin" : "Use voice or chat to talk to the AI"}
                    </p>
                  </div>
                  {isActive && (
                    <div className="mt-2 space-y-1 text-left">
                      <p className="text-xs text-muted-foreground text-center mb-2">Try asking:</p>
                      {[
                        "Who should work on the frontend?",
                        "What's the project status?",
                        "Summarize our discussion so far"
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => askAI(q, false)}
                          className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground"
                        >
                          "{q}"
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {transcript.map((entry, i) => (
                    <TranscriptMessage key={i} entry={entry} />
                  ))}
                  <div ref={transcriptEndRef} />
                </>
              )}
            </div>
          )}

          {/* Chat tab */}
          {activeTab === "chat" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {transcript.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">Ask the AI anything about this meeting or project</p>
                    <div className="mt-4 space-y-2 max-w-sm mx-auto">
                      {[
                        "Who is best suited for the backend role?",
                        "List all the skills we need for this project",
                        "Who is available right now?",
                        "What tasks should we assign this sprint?",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => askAI(q, false)}
                          className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground"
                        >
                          "{q}"
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {transcript.map((entry, i) => (
                  <TranscriptMessage key={i} entry={entry} />
                ))}
                {aiLoading && (
                  <div className="flex gap-3 items-start">
                    <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <svg className="h-4 w-4 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>

              {/* Chat input */}
              <form onSubmit={handleTextSubmit} className="p-4 border-t border-border flex gap-2">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Ask the AI assistant anything…"
                  disabled={aiLoading}
                  className="flex-1"
                />
                <Button type="submit" disabled={aiLoading || !textInput.trim()} size="sm">
                  Send
                </Button>
              </form>
            </div>
          )}

          {/* Summary tab */}
          {activeTab === "summary" && (
            <div className="flex-1 overflow-y-auto p-6">
              {!summary ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                    <svg className="h-7 w-7 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold">No summary yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isEnded ? "Generating summary…" : "End the meeting to generate an AI summary"}
                    </p>
                  </div>
                  {!isEnded && transcript.length > 2 && (
                    <Button onClick={handleGenerateSummary} variant="outline" size="sm" disabled={aiLoading}>
                      Generate Summary Now
                    </Button>
                  )}
                </div>
              ) : (
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <h2 className="text-base font-bold">AI Meeting Summary</h2>
                  </div>

                  {/* Summary text */}
                  {summary.summary_text && (
                    <Card>
                      <CardContent className="py-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Overview</p>
                        <p className="text-sm text-foreground leading-relaxed">{summary.summary_text}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Key decisions */}
                  {summary.key_decisions?.length > 0 && (
                    <Card>
                      <CardContent className="py-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Key Decisions</p>
                        <ul className="space-y-2">
                          {summary.key_decisions.map((d, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-[11px] font-bold mt-0.5">{i + 1}</span>
                              <span className="text-sm text-foreground">{d}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Action items */}
                  {summary.action_items?.length > 0 && (
                    <Card>
                      <CardContent className="py-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Action Items</p>
                        <div className="space-y-3">
                          {summary.action_items.map((item, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                              <svg className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{item.task}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  {item.assignee && (
                                    <span className="text-[11px] text-muted-foreground">👤 {item.assignee}</span>
                                  )}
                                  {item.due_date && (
                                    <span className="text-[11px] text-muted-foreground">📅 {item.due_date}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Transcript Message Component ─────────────────────────────

function TranscriptMessage({ entry }: { entry: TranscriptEntry }) {
  const isAI = entry.speaker === "AI Assistant"
  const isUser = entry.speaker === "You"

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] space-y-1">
          <p className="text-[10px] text-muted-foreground text-right">{entry.speaker}</p>
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3">
            <p className="text-sm leading-relaxed">{entry.message}</p>
          </div>
        </div>
      </div>
    )
  }

  if (isAI) {
    return (
      <div className="flex gap-3 items-start">
        <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div className="max-w-[80%] space-y-1">
          <p className="text-[10px] text-muted-foreground">AI Assistant</p>
          <div className="bg-muted border border-border rounded-2xl rounded-tl-sm px-4 py-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.message}</p>
          </div>
        </div>
      </div>
    )
  }

  // Other participants
  return (
    <div className="flex gap-3 items-start">
      <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
        {(entry.speaker || "?")[0]}
      </div>
      <div className="max-w-[80%] space-y-1">
        <p className="text-[10px] text-muted-foreground">{entry.speaker}</p>
        <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
          <p className="text-sm leading-relaxed">{entry.message}</p>
        </div>
      </div>
    </div>
  )
}
