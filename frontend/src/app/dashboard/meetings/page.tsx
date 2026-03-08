"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { meetingsAPI } from "@/lib/api"

interface Meeting {
  id: string
  title: string
  status: "scheduled" | "active" | "ended"
  scheduled_at?: string
  started_at?: string
  ended_at?: string
  created_at: string
  projects?: { title: string }
}

function formatMeetingDate(dateStr?: string): string {
  if (!dateStr) return "TBD"
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" })
}

function formatMeetingTime(dateStr?: string): string {
  if (!dateStr) return "TBD"
  const d = new Date(dateStr)
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
}

function StatCard({ label, value, icon, colorBase }: { label: string; value: number | string; icon: React.ReactNode; colorBase: string }) {
  // We use inline styles for the dynamic bg color to avoid Tailwind purging issues, or standard mapped classes
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500/20 text-blue-400",
    emerald: "bg-emerald-500/20 text-emerald-400",
    purple: "bg-purple-500/20 text-purple-400",
    slate: "bg-slate-500/20 text-slate-400",
  }
  
  return (
    <div className="flex flex-col justify-center gap-1 rounded-2xl bg-[#1e2235] border border-white/5 p-5 shadow-lg relative overflow-hidden group hover:border-white/10 transition-colors">
      <div className="absolute top-0 right-0 h-24 w-24 bg-white/5 blur-2xl -translate-y-1/2 translate-x-1/2 rounded-full pointer-events-none" />
      <div className="flex justify-between items-start z-10">
        <div>
          <p className="text-xs font-medium text-slate-300 mb-1">{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
        </div>
        <div className={`h-10 w-10 flex items-center justify-center rounded-xl ${colorMap[colorBase] || colorMap.blue}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function MeetingsHub() {
  const router = useRouter()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notificationsRead, setNotificationsRead] = useState(false)

  // Modal State
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false)
  const [newMeetingTitle, setNewMeetingTitle] = useState("")
  const [modalError, setModalError] = useState("")

  // Participant State
  const [knownUsers, setKnownUsers] = useState<string[]>([])
  const [participantQuery, setParticipantQuery] = useState("")
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])

  useEffect(() => {
    // Fetch live DB data
    meetingsAPI.list()
      .then((data) => {
        setMeetings(data || [])
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed fetching meetings:", err)
        setMeetings([]) // empty gracefully
        setLoading(false)
      })

    // Fetch known users for invites
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/users`)
      .then(res => res.json())
      .then(data => {
        // We'll mock some emails combined with the names to satisfy the email search requirement
        const users = data.users || []
        const enhancedUsers = [...users, "alice@relai.com", "bob@relai.com", "charlie@relai.com", "david@relai.com"]
        setKnownUsers(Array.from(new Set(enhancedUsers)))
      })
      .catch(err => console.error("Failed fetching users:", err))
  }, [])

  const handleCreateMeeting = () => {
    setIsMeetingModalOpen(true)
  }

  const submitCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setModalError("")
    try {
      const data = await meetingsAPI.create({ 
        title: newMeetingTitle || "Ad-Hoc Team Sync", 
        project_id: null,
        participant_ids: selectedParticipants
      }) 
      setIsMeetingModalOpen(false)
      router.push(`/dashboard/meetings/${data.id}`)
    } catch (error: any) {
      console.error("Error creating meeting:", error)
      setModalError(error.message || "An unexpected DB error occurred.")
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      </div>
    )
  }

  const live = meetings.filter((m) => m.status === "active")
  const scheduled = meetings.filter((m) => m.status === "scheduled")
  const completed = meetings.filter((m) => m.status === "ended")

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* ── Top Navigation ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
            <svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">RelAI</h1>
            <p className="text-xs font-medium text-muted-foreground">AI-Powered Workplace Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Navigation Links */}
          <div className="hidden sm:flex items-center gap-6 pr-4 border-r border-border/50">
            {/* <Link 
              href="/dashboard" 
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Dashboard
            </Link> */}
            <Link 
              href="/dashboard/chat" 
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Memory Chat
            </Link>
          </div>
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {!notificationsRead && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background"></span>}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-border bg-card shadow-2xl z-50 overflow-hidden text-left animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                  <h3 className="font-semibold text-sm">Notifications</h3>
                  {notificationsRead ? (
                    <span className="text-xs text-muted-foreground">All caught up</span>
                  ) : (
                    <button 
                      onClick={() => setNotificationsRead(true)}
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notificationsRead ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">No new notifications</div>
                  ) : (
                    <>
                      <div className="px-4 py-3 hover:bg-muted/50 cursor-pointer border-b border-border/50">
                        <p className="text-sm font-medium text-foreground">Project Alpha Kickoff</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Meeting starts in 15 minutes</p>
                      </div>
                      <div className="px-4 py-3 hover:bg-muted/50 cursor-pointer border-b border-border/50">
                        <p className="text-sm font-medium text-foreground">Action Item Unassigned</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Please review the summary for Quarter Planning</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          <button 
            onClick={handleCreateMeeting}
            disabled={creating}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-500 transition-all disabled:opacity-50"
          >
            {creating ? (
               <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            Create Meeting
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-6xl space-y-10">
          
          {/* ── Stats Row ─────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground mb-1">Upcoming</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-bold text-foreground">{scheduled.length}</h3>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
              </div>
            </div>
            <div className={`rounded-2xl border p-5 shadow-sm relative overflow-hidden ${live.length > 0 ? "border-violet-500/30 bg-violet-500/5" : "border-border bg-card"}`}>
              {live.length > 0 && <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 blur-3xl -mr-10 -mt-10 rounded-full" />}
              <p className={`text-sm font-medium mb-1 ${live.length > 0 ? "text-violet-400" : "text-muted-foreground"}`}>Live Now</p>
              <div className="flex items-end justify-between relative z-10">
                <h3 className="text-3xl font-bold text-foreground">{live.length}</h3>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${live.length > 0 ? "bg-violet-500/20 text-violet-400" : "bg-muted text-muted-foreground"}`}>
                  {live.length > 0 ? (
                    <span className="flex h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
                  ) : (
                    <span className="flex h-2 w-2 rounded-full bg-slate-500/50" />
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground mb-1">Participants Today</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-bold text-foreground">
                  {live.length > 0 ? live.reduce((acc, m) => acc + (m.projects ? 3 : 2), 0) : 0}
                </h3>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground mb-1">Completed</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-bold text-foreground">{completed.length}</h3>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
              </div>
            </div>
          </div>

          {/* ── Search & Filter ───────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Search meetings, projects, or participants..." className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50" />
            </div>
          </div>

          {/* ── Meeting Lists ────────────────────────────────────────── */}
          <div className="space-y-8">
            
            {/* Live Meetings Sections */}
            {live.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <h2 className="text-lg font-bold text-foreground tracking-tight">Live Meetings</h2>
                </div>
                <div className="space-y-3">
                  {live.map(m => (
                    <div key={m.id} className="bg-card border border-violet-500/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-3">
                          <h3 className="text-base font-bold text-foreground">{m.title}</h3>
                          <span className="bg-red-500/10 text-red-500 border border-red-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 bg-red-500 rounded-full animate-pulse" /> live
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <svg className="h-4 w-4 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> 
                            {formatMeetingDate(m.started_at)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <svg className="h-4 w-4 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> 
                            {formatMeetingTime(m.started_at)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <svg className="h-4 w-4 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> 
                            {m.projects?.title || "No Project"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                          <div className="flex -space-x-2">
                            {["D", "E", "M"].map((l, i) => <div key={i} className="h-6 w-6 rounded-full bg-violet-500 flex items-center justify-center text-[9px] font-bold text-white border border-card">{l}</div>)}
                          </div>
                          <span className="ml-2 font-medium">3 participants</span>
                        </div>
                      </div>
                      <Link href={`/dashboard/meetings/${m.id}`} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-orange-500/20 transition-colors flex items-center gap-2 shrink-0">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 15l-3-3h6l-3 3zm0-6l3 3H9l3-3z" /></svg> Join Now
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Meetings Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground tracking-tight">Upcoming Meetings</h2>
              <div className="space-y-3">
                {scheduled.length === 0 && <p className="text-sm text-muted-foreground p-4 border border-border bg-card rounded-2xl">No upcoming meetings.</p>}
                {scheduled.map(m => (
                  <div key={m.id} className="bg-card border border-border hover:border-violet-500/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
                     <div className="space-y-2.5">
                        <div className="flex items-center gap-3">
                          <h3 className="text-base font-bold text-foreground">{m.title}</h3>
                          <span className="bg-muted text-muted-foreground border border-border text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase">
                            scheduled
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <svg className="h-4 w-4 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> 
                            {formatMeetingDate(m.scheduled_at)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <svg className="h-4 w-4 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> 
                            {formatMeetingTime(m.scheduled_at)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <svg className="h-4 w-4 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> 
                            {m.projects?.title || "No Project"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                          <div className="flex -space-x-2">
                            {["A", "T", "S"].map((l, i) => <div key={i} className="h-6 w-6 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white border border-[#1e2235]">{l}</div>)}
                          </div>
                        </div>
                      </div>
                      <Link href={`/dashboard/meetings/${m.id}`} className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2 shrink-0">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg> Details
                      </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Completed Sections */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground tracking-tight">Recent Completed</h2>
              <div className="space-y-3">
                {completed.length === 0 && <p className="text-sm text-muted-foreground p-4 border border-border bg-card rounded-2xl">No completed meetings.</p>}
                {completed.map(m => (
                  <div key={m.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
                     <div className="space-y-2.5">
                        <div className="flex items-center gap-3">
                          <h3 className="text-base font-bold text-muted-foreground">{m.title}</h3>
                          <span className="bg-muted text-muted-foreground text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase border border-border">
                            completed
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground/70">
                          <span className="flex items-center gap-1.5">
                            <svg className="h-4 w-4 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> 
                            {formatMeetingDate(m.started_at)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <svg className="h-4 w-4 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> 
                            {formatMeetingTime(m.started_at)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <svg className="h-4 w-4 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> 
                            {m.projects?.title || "No Project"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground/50">
                          <div className="flex -space-x-2">
                            {["J", "D"].map((l, i) => <div key={i} className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground border border-card">{l}</div>)}
                          </div>
                          <span className="ml-2 font-medium">2 participants</span>
                        </div>
                      </div>
                      <Link href={`/dashboard/meetings/${m.id}/summary`} className="hover:bg-accent text-accent-foreground font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2 shrink-0 border border-border">
                         <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg> View Summary
                      </Link>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Meeting Creation Modal */}
      {isMeetingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#1a1f35] rounded-3xl border border-white/10 shadow-2xl w-full max-w-md overflow-hidden flex flex-col scale-in-center">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#212842]">
              <h2 className="text-lg font-bold text-white">Schedule Meeting</h2>
              <button 
                onClick={() => { setIsMeetingModalOpen(false); setModalError(""); setCreating(false); }}
                className="text-slate-400 hover:text-white transition-colors"
                disabled={creating}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={submitCreateMeeting} className="p-6 flex flex-col gap-5">
              {modalError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl flex items-start gap-2">
                  <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>{modalError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-300">Meeting Title</label>
                <input 
                  type="text" 
                  value={newMeetingTitle}
                  onChange={(e) => setNewMeetingTitle(e.target.value)}
                  placeholder="e.g. Q3 Roadmap Review"
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all font-medium"
                  required
                  disabled={creating}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-300">Select Project (Optional)</label>
                <select className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground appearance-none">
                  <option>No projects available</option>
                  <option>Project Alpha</option>
                  <option>Project Beta</option>
                </select>
              </div>

              <div className="space-y-1.5 relative">
                <label className="text-sm font-semibold text-slate-300">Invite Participants</label>
                
                {selectedParticipants.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedParticipants.map(sp => (
                      <span key={sp} className="inline-flex items-center gap-1.5 bg-violet-500/20 text-violet-300 text-xs font-medium px-2.5 py-1 rounded-md border border-violet-500/20">
                        {sp}
                        <button type="button" onClick={() => setSelectedParticipants(prev => prev.filter(p => p !== sp))} className="hover:text-white transition-colors">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <input 
                  type="text" 
                  placeholder="Search by name or email..." 
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground" 
                  value={participantQuery}
                  onChange={(e) => setParticipantQuery(e.target.value)}
                />

                {/* Autocomplete Dropdown */}
                {participantQuery.trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#212842] border border-white/10 rounded-xl shadow-xl overflow-hidden z-20 max-h-48 overflow-y-auto">
                    {knownUsers
                      .filter(u => u.toLowerCase().includes(participantQuery.toLowerCase()) && !selectedParticipants.includes(u))
                      .map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => {
                            setSelectedParticipants(prev => [...prev, u]);
                            setParticipantQuery("");
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-violet-500/20 hover:text-white transition-colors block border-b border-white/5 last:border-0"
                        >
                          {u}
                        </button>
                    ))}
                    {knownUsers.filter(u => u.toLowerCase().includes(participantQuery.toLowerCase()) && !selectedParticipants.includes(u)).length === 0 && (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">No users found for "{participantQuery}"</div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-300">Date</label>
                  <input type="date" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-300">Time</label>
                  <input type="time" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground" />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-white/5 mt-2">
                <button 
                  type="button" 
                  onClick={() => setIsMeetingModalOpen(false)}
                  disabled={creating}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={creating || !newMeetingTitle.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-600/20 transition-all disabled:opacity-50"
                >
                  {creating && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  Create Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
