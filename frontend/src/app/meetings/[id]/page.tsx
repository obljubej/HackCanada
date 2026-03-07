"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { meetingsAPI } from "@/lib/api"

// ── Types ────────────────────────────────────────────────────

interface TranscriptEntry {
  speaker: string
  message: string
  created_at: string
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
}

function formatMeetingTime(dateStr?: string): string {
  if (!dateStr) return "TBD"
  const d = new Date(dateStr)
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

// ── TTS via Backend ─────────────────────────────────────────

let currentAudioSource: AudioBufferSourceNode | null = null

async function speakBackendTTS(text: string, onEnd?: () => void) {
  currentAudioSource?.stop()
  currentAudioSource = null

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api"
    const response = await fetch(`${apiUrl}/voice/text-to-speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceId: "21m00Tcm4TlvDq8ikWAM" }),
    })

    if (!response.ok) throw new Error(`Backend TTS error: ${response.status}`)

    const arrayBuffer = await response.arrayBuffer()
    // @ts-ignore
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
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
    console.warn("[TTS] Backend TTS failed, falling back to browser TTS:", err)
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

function speak(text: string, onEnd?: () => void) {
  speakBackendTTS(text, onEnd)
}

// ── Main Component ───────────────────────────────────────────

export default function MeetingRoomPage() {
  const params = useParams()
  const router = useRouter()
  const meetingId = params.id as string

  const [meeting, setMeeting] = useState<MeetingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])

  // Voice state
  const [status, setStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle")
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const recognitionRef = useRef<any>(null)
  const [voiceSupported, setVoiceSupported] = useState(false)

  // Chat state
  const [textInput, setTextInput] = useState("")
  const [aiLoading, setAiLoading] = useState(false)

  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const speakingRef = useRef(false)
  
  // Voice threshold logic
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const activeTranscriptRef = useRef("")

  // Load meeting data
  useEffect(() => {
    // @ts-ignore
    setVoiceSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition))
    meetingsAPI.get(meetingId).then((data) => {
      setMeeting(data)
      setTranscript(data.transcript || [])
      setLoading(false)
      
      // Auto-start active meetings
      if (data.status === "active") {
        setIsVoiceActive(true)
        setTimeout(() => startListening(), 500)
      }
    }).catch(() => setLoading(false))
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId])

  // Auto-scroll chat
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcript])

  // ── AI Ask ───────────────────────────────────────────────

  const askAI = useCallback(async (question: string, voiceResponse = false) => {
    if (!question.trim()) return
    setAiLoading(true)
    setStatus("thinking")

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

      if (voiceResponse && !isMuted) {
        setStatus("speaking")
        speakingRef.current = true
        recognitionRef.current?.stop() // Prevent feedback loop

        speak(result.answer, () => {
          speakingRef.current = false
          if (isVoiceActive && !isMuted) {
            setStatus("listening")
            startListening()
          } else {
            setStatus("idle")
          }
        })
      } else {
        setStatus(isVoiceActive && !isMuted ? "listening" : "idle")
      }
    } catch (err) {
      const errEntry: TranscriptEntry = {
        speaker: "AI Assistant",
        message: "Sorry, I couldn't connect to the AI. Make sure the backend is running.",
        created_at: new Date().toISOString()
      }
      setTranscript(prev => [...prev, errEntry])
      setStatus(isVoiceActive && !isMuted ? "listening" : "idle")
    }
    setAiLoading(false)
  }, [meetingId, isVoiceActive, isMuted])

  // ── Voice Recognition ────────────────────────────────────

  const startListening = useCallback(() => {
    if (!voiceSupported || isMuted || speakingRef.current) return
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = "en-US"

    rec.onresult = (event: any) => {
      let currentInterim = ""
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentInterim += event.results[i][0].transcript
      }
      
      const text = currentInterim.trim()
      if (!text) return

      activeTranscriptRef.current = text

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      
      // Wait 2.5 seconds after speaking stops before asking AI
      silenceTimerRef.current = setTimeout(() => {
        if (activeTranscriptRef.current) {
          const finalQ = activeTranscriptRef.current
          activeTranscriptRef.current = ""
          askAI(finalQ, true)
        }
      }, 2500)
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
    currentAudioSource?.stop()
    setStatus("idle")
    setIsVoiceActive(false)
  }, [])

  // ── Meeting Controls ─────────────────────────────────────
  
  const handleStartMeeting = async () => {
    await meetingsAPI.start(meetingId)
    setMeeting(prev => prev ? { ...prev, status: "active" } : prev)
    setIsVoiceActive(true)
    startListening()
  }

  const handleEndMeeting = async () => {
    stopListening()
    await meetingsAPI.end(meetingId)
    router.push(`/meetings/${meetingId}/summary`)
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
    await askAI(q, true) // Force TTS for text-to-text as requested
  }

  // ── UI Rendering ─────────────────────────────────────────

  if (loading || !meeting) {
    return (
      <div className="min-h-screen bg-[#1e2235] flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Determine User for the bottom center
  const userParticipant = meeting.participants[0] || { name: "You", role: "Organizer" }

  return (
    <div className="flex flex-col h-screen bg-[#1e2235] text-slate-200 font-sans overflow-hidden">
      
      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-black/20 bg-[#252a40]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">{meeting.title}</h1>
          <p className="text-sm text-slate-400 mt-0.5">{meeting.projects?.title || "No Project Attached"}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-[#2a304a] border border-red-500/20 px-3 py-1.5 rounded-full">
            <div className={`h-2.5 w-2.5 rounded-full bg-red-500 ${meeting.status === "active" ? "animate-pulse" : ""}`} />
            <span className="text-xs font-semibold text-slate-300">Recording</span>
          </div>
          <button 
            onClick={meeting.status !== "active" ? handleStartMeeting : handleEndMeeting}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg transition-colors ${
              meeting.status !== "active" 
                ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20"
                : "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20"
            }`}
          >
            {meeting.status !== "active" ? "Start Meeting" : "End Meeting"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* ── Left: Video Grid (2/3 width) ───────────────────── */}
        <div className="w-2/3 p-6 flex flex-col justify-center max-w-4xl mx-auto">
          <div className="grid grid-rows-2 grid-cols-1 gap-6 flex-1 h-full py-8">
            
            {/* Box 1: AI Assistant (Top Center) */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] relative overflow-hidden flex flex-col items-center justify-center group shadow-xl">
              <div className="absolute inset-0 bg-black/10 mix-blend-overlay pointer-events-none" />
              
              <div className={`h-28 w-28 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center mb-6 transition-transform border border-white/20 shadow-2xl ${
                status === "listening" ? "scale-105" :
                status === "speaking" ? "animate-pulse scale-105" : ""
              }`}>
                <svg className="h-14 w-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              
              <h3 className="text-2xl font-bold text-white z-10 tracking-tight">RelAI Assistant</h3>
              
              <div className="mt-4 bg-indigo-900/40 backdrop-blur-md px-5 py-2 rounded-full border border-white/10 text-xs font-bold text-white uppercase tracking-widest z-10 flex items-center gap-2">
                {status === "listening" && <span className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse" />}
                {status === "speaking" && <span className="h-2 w-2 bg-blue-400 rounded-full animate-pulse" />}
                {status === "thinking" && <span className="h-2 w-2 bg-amber-400 rounded-full animate-pulse" />}
                {status === "idle" && <span className="h-2 w-2 bg-slate-400 rounded-full" />}
                {status === "idle" ? "Ready" : status}
              </div>
            </div>

            {/* Box 2: User (Bottom Center) */}
            <div className="bg-[#2a304a] rounded-[2rem] relative overflow-hidden flex flex-col items-center justify-center shadow-lg border border-white/5">
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
              <div className="h-28 w-28 rounded-full bg-[#1da0f2] flex items-center justify-center text-5xl font-light text-white shadow-xl z-10">
                {userParticipant.name.charAt(0)}
              </div>
              
              <div className="absolute bottom-6 left-6 right-6 bg-[#1e2235]/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl flex items-center justify-between z-10">
                <div>
                  <p className="text-base font-bold text-white truncate">{userParticipant.name}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{userParticipant.role}</p>
                </div>
                {status === "listening" && (
                  <div className="h-10 w-10 flex items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                     <svg className="h-5 w-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ── Right: Chat Sidebar (1/3 width) ────────────────── */}
        <div className="w-1/3 bg-[#131520] border-l border-white/5 flex flex-col relative shadow-2xl z-10">
          
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {transcript.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.speaker === "You" ? "flex-row-reverse" : "flex-row"} items-start`}>
                {msg.speaker === "AI Assistant" ? (
                  <div className="h-8 w-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                ) : (
                  <div className="h-8 w-8 rounded-full bg-[#1e2235] text-slate-400 flex items-center justify-center text-xs font-bold border border-white/5 shrink-0">
                    {msg.speaker === "You" ? (meeting.participants[0]?.name[0] || "Y") : msg.speaker[0]}
                  </div>
                )}
                
                <div className={`flex flex-col ${msg.speaker === "You" ? "items-end" : "items-start"} max-w-[80%]`}>
                  <div className={`px-5 py-3.5 rounded-2xl ${
                    msg.speaker === "You" 
                      ? "bg-indigo-600 text-white rounded-tr-sm" 
                      : "bg-[#1e2235] text-slate-300 border border-white/5 rounded-tl-sm shadow-md"
                  }`}>
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1.5 px-1 font-mono">{formatMeetingTime(msg.created_at)}</span>
                </div>
              </div>
            ))}
            
            {aiLoading && (
              <div className="flex gap-3 items-start">
                <div className="h-8 w-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div className="bg-[#1e2235] border border-white/5 rounded-2xl rounded-tl-sm px-5 py-4 flex gap-1 shadow-md">
                   <div className="h-1.5 w-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                   <div className="h-1.5 w-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                   <div className="h-1.5 w-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Chat Input Header */}
          <div className="px-6 py-2">
            <p className="text-xs text-slate-500 text-center">Click the mic to use voice-to-voice conversation</p>
          </div>

          {/* Chat Input Container */}
          <div className="px-6 pb-6 pt-2 shrink-0">
            <form onSubmit={handleTextSubmit} className="relative flex items-center bg-[#1e2235] rounded-xl border border-white/10 hover:border-white/20 transition-colors shadow-lg overflow-hidden pr-2">
              <button
                type="button"
                onClick={handleVoiceToggle}
                className={`p-4 shrink-0 transition-colors ${
                  isVoiceActive 
                    ? "text-red-400 hover:text-red-300"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {isVoiceActive ? (
                  <svg className="h-5 w-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                )}
              </button>
              
              <input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Ask AI assistant..."
                disabled={aiLoading}
                className="flex-1 bg-transparent py-4 text-[13px] text-white focus:outline-none placeholder-slate-500 min-w-0"
              />
              
              <button 
                type="submit" 
                disabled={aiLoading || !textInput.trim()} 
                className={`p-2 shrink-0 rounded-lg transition-colors ${
                  textInput.trim() ? "text-indigo-400 hover:bg-indigo-500/10 cursor-pointer" : "text-slate-600 cursor-not-allowed"
                }`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>
          
        </div>

      </div>
    </div>
  )
}
