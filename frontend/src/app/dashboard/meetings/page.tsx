"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { meetingsAPI } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

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

const STATUS_CONFIG = {
  scheduled: { label: "Scheduled", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", dot: "bg-blue-400" },
  active: { label: "In Progress", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400 animate-pulse" },
  ended: { label: "Ended", color: "bg-gray-500/10 text-gray-400 border-gray-500/20", dot: "bg-gray-500" },
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return ""
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(dateStr).toLocaleDateString("en", { month: "short", day: "numeric" })
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

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Meetings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-powered meeting assistant with voice, transcripts, and summaries
          </p>
        </div>
        <Link
          href="/dashboard/meetings/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Schedule Meeting
        </Link>
      </div>

      {/* Active meeting banner */}
      {active.length > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-emerald-400">Active Meeting</p>
              <p className="text-xs text-muted-foreground">{active[0].title}</p>
            </div>
          </div>
          <Link
            href={`/dashboard/meetings/${active[0].id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
          >
            Join Meeting →
          </Link>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="py-5"><div className="h-12 rounded bg-muted animate-pulse" /></CardContent></Card>
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-20 gap-5">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <svg className="h-8 w-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">No meetings yet</p>
              <p className="text-xs text-muted-foreground mt-1">Schedule your first AI-powered meeting</p>
            </div>
            <Link href="/dashboard/meetings/new" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              Schedule Meeting
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Upcoming */}
          {scheduled.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Upcoming</h2>
              <div className="space-y-2">
                {scheduled.map((m) => <MeetingRow key={m.id} meeting={m} />)}
              </div>
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Past Meetings</h2>
              <div className="space-y-2">
                {past.map((m) => <MeetingRow key={m.id} meeting={m} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MeetingRow({ meeting }: { meeting: Meeting }) {
  const cfg = STATUS_CONFIG[meeting.status] ?? STATUS_CONFIG.scheduled
  const dateStr = meeting.status === "ended"
    ? meeting.ended_at
    : meeting.status === "active"
    ? meeting.started_at
    : meeting.scheduled_at

  return (
    <Link href={`/dashboard/meetings/${meeting.id}`}>
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-4 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group">
        <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{meeting.title}</p>
          {meeting.projects && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">Project: {meeting.projects.title}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-muted-foreground">{timeAgo(dateStr)}</span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
          <svg className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  )
}
