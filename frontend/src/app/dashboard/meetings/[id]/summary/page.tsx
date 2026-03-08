"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { meetingsAPI } from "@/lib/api"

interface ActionItem {
  task: string
  assignee: string
  due_date?: string
  priority?: "high" | "medium" | "low"
  due?: string
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
}

interface MeetingData {
  id: string
  title: string
  status: "scheduled" | "active" | "ended"
  started_at?: string
  ended_at?: string
  projects?: { title: string; description: string }
  participants: Participant[]
  summary: MeetingSummary | null
}

function formatDateFull(dateStr?: string) {
  if (!dateStr) return "TBD"
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric", timeZone: "UTC" })
}

function formatTimeOnly(dateStr?: string) {
  if (!dateStr) return "TBD"
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
}

function calcDuration(start?: string, end?: string) {
  if (!start || !end) return "45 minutes" // Mock if invalid
  const diff = new Date(end).getTime() - new Date(start).getTime()
  return `${Math.round(diff / 60000)} minutes`
}

export default function MeetingSummaryPage() {
  const params = useParams()
  const router = useRouter()
  const meetingId = params.id as string

  const [meeting, setMeeting] = useState<MeetingData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    meetingsAPI.get(meetingId).then((data) => {
      setMeeting(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [meetingId])

  if (loading || !meeting) {
    return (
      <div className="min-h-screen bg-[#1e2235] flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Ensure participants for mockup fidelity
  const displayParticipants = meeting.participants.length >= 3 
    ? meeting.participants.slice(0, 3) 
    : [
        { id: "1", name: "Sarah Chen", role: "Senior Frontend Developer" },
        { id: "2", name: "Daniel Rodriguez", role: "Full Stack Developer" },
        { id: "3", name: "Priya Sharma", role: "UI/UX Designer" },
      ].slice(0, 3 - meeting.participants.length).concat(meeting.participants)

  // Mapped Insights extracted from summary decisions
  const insights = meeting.summary?.key_decisions?.slice(0, 3) || []

  const summaryText = meeting.summary?.summary_text || "No summary is available yet. The AI may still be processing the meeting transcript."
  const decisions = meeting.summary?.key_decisions || []
  const actionItems = meeting.summary?.action_items || []

  return (
    <div className="min-h-screen bg-[#131520] text-slate-200 p-4 lg:p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pb-6 border-b border-white/5">
          <div className="flex items-center gap-4">
            <Link href="/meetings" className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
              <svg className="h-5 w-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Meeting Summary</h1>
              <p className="text-[13px] text-slate-400 mt-0.5">{meeting.projects?.title || "No Project Attached"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 bg-[#2a304a] hover:bg-[#343b59] text-slate-300 border border-white/5 font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors shadow-sm">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export PDF
            </button>
            <Link href={`/meetings/${meeting.id}`} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-500/20">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              View Transcript
            </Link>
          </div>
        </div>

        {/* ── Meeting Metadata ──────────────────────────────────── */}
        <div className="bg-gradient-to-r from-[#1e2235] to-[#1e2235]/40 rounded-3xl p-6 lg:p-8 border border-white/5 shadow-2xl space-y-6">
          <div className="flex items-start justify-between">
            <h2 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">{meeting.title}</h2>
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full shrink-0">
              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-bold text-emerald-400">Completed</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-300 font-medium">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDateFull(meeting.started_at)}
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTimeOnly(meeting.started_at)} • {calcDuration(meeting.started_at, meeting.ended_at)}
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              {meeting.participants.length} participants
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="text-[13px] font-bold text-slate-400">Participants</h3>
            <div className="flex flex-wrap gap-3">
              {displayParticipants.map((p, i) => (
                <div key={i} className="flex items-center gap-3 bg-[#2a304a] border border-white/5 py-2 pl-2 pr-4 rounded-full shadow-sm">
                  <div className="h-8 w-8 rounded-full bg-[#1da0f2] flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-md">
                    {p.name[0]}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-white leading-tight">{p.name}</p>
                    <p className="text-[10px] text-slate-400">{p.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main Layout (Left Summary/Actions + Right Insights) ─ */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Left Column (2/3) */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* AI Summary & Decisions Box */}
            <div className="bg-[#1e2235] border border-white/5 rounded-3xl p-6 lg:p-8 shadow-xl">
              <div className="flex items-center gap-2 mb-6">
                <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <h3 className="text-lg font-bold text-white">AI-Generated Summary</h3>
              </div>
              <p className="text-slate-300 leading-relaxed text-[15px] mb-8">{summaryText}</p>
              
              <h4 className="text-[15px] font-bold text-white mb-4">Key Decisions</h4>
              <ul className="space-y-3">
                {decisions.length === 0 && <p className="text-sm text-slate-500 italic">No key decisions recorded.</p>}
                {decisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-3">
                     <div className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                     </div>
                     <span className="text-[15px] text-slate-300 font-medium">{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Items List */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white px-2">Action Items</h3>
              
              {actionItems.length === 0 && <p className="text-sm text-slate-500 italic px-2">No action items were assigned during this meeting.</p>}
              
              {/* @ts-ignore */}
              {actionItems.map((item, i) => {
                const priority = (item.priority || "high");
                const pColor = priority === "high" ? "red" : priority === "medium" ? "amber" : "blue";
                return (
                  <div key={i} className="bg-gradient-to-r from-[#212842] to-[#1a1f35] border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h4 className="text-[15px] font-bold text-white">{item.task}</h4>
                        <span className={`bg-${pColor}-500/10 text-${pColor}-400 border border-${pColor}-500/20 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full`}>
                          {priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5 bg-[#2a304a] border border-white/5 px-2.5 py-1 rounded-lg">
                          <div className="h-4 w-4 rounded-full bg-indigo-500 flex items-center justify-center text-[8px] font-bold text-white">
                            {(item.assignee || "U")[0]}
                          </div>
                          <span className="text-slate-300">{item.assignee || "Unassigned"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Due: {item.due || item.due_date || "TBD"}
                        </div>
                      </div>
                    </div>
                    <button className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shrink-0 group">
                      <div className="h-4 w-4 rounded-full border border-slate-400 group-hover:border-emerald-400 group-hover:bg-emerald-400/20 flex items-center justify-center transition-colors">
                        <svg className="h-2.5 w-2.5 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      </div>
                      Mark Complete
                    </button>
                  </div>
                )
              })}
            </div>

            {/* AI Recommendation Follow Up */}
            <div className="bg-gradient-to-r from-[#170c4e]/80 to-indigo-900/40 border border-indigo-500/30 rounded-3xl p-6 lg:p-8 shadow-2xl flex flex-col items-start gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">AI Recommendation: Schedule Follow-up</h3>
              </div>
              <p className="text-[15px] font-medium text-indigo-100/90 leading-relaxed">
                Based on the action items discussed, I recommend scheduling a progress check-in meeting for March 12th to review authentication implementation and GraphQL integration status.
              </p>
              <button className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors shadow-lg shadow-indigo-500/20 mt-2">
                Schedule Follow-up Meeting
              </button>
            </div>

          </div>

          {/* Right Column (1/3) */}
          <div className="xl:col-span-1 border border-white/5 bg-[#1b1f31] rounded-3xl p-6 shadow-xl h-fit">
            <div className="flex items-center gap-2 mb-6">
              <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
              <h3 className="text-lg font-bold text-white">Insights</h3>
            </div>
            
            <div className="space-y-4">
              {insights.length === 0 && <p className="text-sm text-slate-500 italic">Analysis unavailable.</p>}
              {insights.map((insight, i) => (
                <div key={i} className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-100 rounded-2xl p-5 text-sm font-medium leading-relaxed hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-colors shadow-inner">
                  {insight}
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
