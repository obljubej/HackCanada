"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
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

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    meetingsAPI.list().then((data) => {
      setMeetings(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const active = meetings.filter(m => m.status === "active")
  const scheduled = meetings.filter(m => m.status === "scheduled")
  const past = meetings.filter(m => m.status === "ended")

  const participantCount = meetings.length > 0 ? (Math.random() > 0.5 ? 5 : 3) : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-[#131520] text-slate-200 p-6 lg:px-12 lg:py-8 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-500/20" />
          <p className="text-slate-400">Loading your AI meetings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#131520] text-slate-200 p-6 lg:px-12 lg:py-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── Top Navigation ────────────────────────────────────────── */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/20">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a2.25 2.25 0 012.25-2.25h1.5a2.25 2.25 0 012.25 2.25v7.5m-6.75-10.5h.008v.008H12v-.008zm-3 0h.008v.008H9v-.008zM12 4.5v3m-3-3v3m6-3v3M5.25 10.5h13.5A2.25 2.25 0 0121 12.75v6A2.25 2.25 0 0118.75 21H5.25A2.25 2.25 0 013 18.75v-6a2.25 2.25 0 012.25-2.25z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">RelAI</h1>
              <p className="text-[11px] text-slate-400 font-medium">AI-Powered Workplace Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">
              Back to Dashboard
            </Link>
            <div className="relative text-slate-400 cursor-pointer hover:text-white transition-colors">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 border-2 border-[#131520] text-[9px] font-bold text-white">2</div>
            </div>
            <Link href="/meetings/new" className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create Meeting
            </Link>
          </div>
        </div>

        {/* ── Stats Row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Upcoming" value={scheduled.length.toString()} colorBase="blue" icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
          } />
          <StatCard label="Live Now" value={active.length.toString()} colorBase="emerald" icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
          } />
          <StatCard label="Participants" value={participantCount} colorBase="purple" icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
          } />
          <StatCard label="Completed" value={past.length.toString()} colorBase="slate" icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          } />
        </div>

        {/* ── Search & Filter Row ──────────────────────────────────── */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input 
              className="w-full bg-[#1e2235] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500 transition-colors" 
              placeholder="Search meetings..." 
            />
          </div>
          <select className="bg-[#1e2235] border border-white/5 rounded-xl px-4 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 w-48 appearance-none transition-colors">
            <option>All Projects</option>
            <option>Project Atlas</option>
            <option>Project Mercury</option>
          </select>
        </div>

        {/* ── Meeting Lists ────────────────────────────────────────── */}
        <div className="space-y-8">
          
          {/* Live Meetings Sections */}
          {active.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <h2 className="text-lg font-bold text-white tracking-tight">Live Meetings</h2>
              </div>
              <div className="space-y-3">
                {active.map(m => (
                  <div key={m.id} className="bg-[#1a2035] border border-blue-500/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-bold text-white">{m.title}</h3>
                        <span className="bg-red-500/10 text-red-500 border border-red-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 bg-red-500 rounded-full animate-pulse" /> live
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> 
                          {formatMeetingDate(m.started_at)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> 
                          {formatMeetingTime(m.started_at)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> 
                          {m.projects?.title || "No Project"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
                        <div className="flex -space-x-2">
                          {["D", "E", "M"].map((l, i) => <div key={i} className="h-6 w-6 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white border border-[#1a2035]">{l}</div>)}
                        </div>
                        <span className="ml-2 font-medium">3 participants</span>
                      </div>
                    </div>
                    <Link href={`/meetings/${m.id}`} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-orange-500/20 transition-colors flex items-center gap-2 shrink-0">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 15l-3-3h6l-3 3zm0-6l3 3H9l3-3z" /></svg> Join Now
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Meetings Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white tracking-tight">Upcoming Meetings</h2>
            <div className="space-y-3">
              {scheduled.length === 0 && <p className="text-sm text-slate-400 p-4 border border-white/5 rounded-2xl">No upcoming meetings.</p>}
              {scheduled.map(m => (
                <div key={m.id} className="bg-[#1e2235] border border-white/5 hover:border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
                   <div className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-bold text-slate-200">{m.title}</h3>
                        <span className="bg-[#131520] text-slate-300 border border-white/5 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider">
                          scheduled
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> 
                          {formatMeetingDate(m.scheduled_at)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> 
                          {formatMeetingTime(m.scheduled_at)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> 
                          {m.projects?.title || "No Project"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
                        <div className="flex -space-x-2">
                          {["A", "T", "S"].map((l, i) => <div key={i} className="h-6 w-6 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white border border-[#1e2235]">{l}</div>)}
                        </div>
                        <span className="ml-2 font-medium">3 participants</span>
                      </div>
                    </div>
                    <Link href={`/meetings/${m.id}`} className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2 shrink-0">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg> Details
                    </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Completed Sections */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white tracking-tight">Recent Completed</h2>
            <div className="space-y-3">
              {past.length === 0 && <p className="text-sm text-slate-400 p-4 border border-white/5 rounded-2xl">No completed meetings.</p>}
              {past.map(m => (
                <div key={m.id} className="bg-[#1e2235] border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 opacity-80 hover:opacity-100 transition-opacity">
                   <div className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-bold text-slate-300">{m.title}</h3>
                        <span className="bg-slate-200 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider">
                          completed
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> 
                          {formatMeetingDate(m.ended_at)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> 
                          {formatMeetingTime(m.ended_at)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> 
                          {m.projects?.title || "No Project"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
                        <div className="flex -space-x-2">
                          {["S", "D", "E"].map((l, i) => <div key={i} className="h-6 w-6 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white border border-[#1e2235]">{l}</div>)}
                        </div>
                        <span className="ml-2 font-medium">3 participants</span>
                      </div>
                    </div>
                    <Link href={`/meetings/${m.id}/summary`} className="bg-slate-700/50 hover:bg-slate-700 text-slate-200 font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2 shrink-0 border border-white/5">
                       <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg> View Summary
                    </Link>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
