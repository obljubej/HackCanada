"use client"

import { useState, useEffect, useCallback } from "react"
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import type { Notification, NotificationType } from "@/lib/types"

const TYPE_CONFIG: Record<NotificationType, { label: string; color: string; dot: string; path: string }> = {
  assignment: {
    label: "Assignment",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dot: "bg-blue-400",
    path: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
  },
  skill_gap: {
    label: "Skill Gap",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    dot: "bg-amber-400",
    path: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
  },
  meeting: {
    label: "Meeting",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    dot: "bg-purple-400",
    path: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
  },
  deadline: {
    label: "Deadline",
    color: "bg-red-500/10 text-red-400 border-red-500/20",
    dot: "bg-red-400",
    path: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
  },
  update: {
    label: "Update",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-400",
    path: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
  },
}

const FILTERS = [
  { value: "all" as const, label: "All" },
  { value: "unread" as const, label: "Unread" },
  { value: "assignment" as NotificationType, label: "Assignments" },
  { value: "skill_gap" as NotificationType, label: "Skill Gaps" },
  { value: "meeting" as NotificationType, label: "Meetings" },
  { value: "deadline" as NotificationType, label: "Deadlines" },
  { value: "update" as NotificationType, label: "Updates" },
]

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString("en", { month: "short", day: "numeric" })
}

export default function InboxPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [userId, setUserId] = useState("")
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | NotificationType>("all")

  const load = useCallback(async (uid: string) => {
    try {
      const ns = await getNotifications(uid)
      setNotifications(ns)
    } catch {
      // table may not exist yet
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id)
        load(session.user.id)
      } else {
        setLoading(false)
      }
    })
  }, [load])

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    await markNotificationRead(id).catch(() => {})
  }

  const handleMarkAllRead = async () => {
    if (!userId) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    await markAllNotificationsRead(userId).catch(() => {})
  }

  const handleDelete = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const filtered = (() => {
    if (activeFilter === "all") return notifications
    if (activeFilter === "unread") return notifications.filter((n) => !n.read)
    return notifications.filter((n) => n.type === activeFilter)
  })()

  const unreadCount = notifications.filter((n) => !n.read).length

  // Group by date for display
  const grouped: Record<string, Notification[]> = {}
  filtered.forEach((n) => {
    const d = new Date(n.created_at)
    const today = new Date()
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    let key: string
    if (d.toDateString() === today.toDateString()) key = "Today"
    else if (d.toDateString() === yesterday.toDateString()) key = "Yesterday"
    else key = d.toLocaleDateString("en", { month: "long", day: "numeric" })
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(n)
  })

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Inbox</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {unreadCount > 0 ? (
                <span><span className="text-primary font-semibold">{unreadCount} unread</span> · {notifications.length} total</span>
              ) : "All caught up! No unread notifications."}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              ✓ Mark all read
            </Button>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(({ value, label }) => {
            const count = value === "all"
              ? notifications.length
              : value === "unread"
              ? unreadCount
              : notifications.filter((n) => n.type === value).length
            return (
              <button
                key={value}
                onClick={() => setActiveFilter(value)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                  activeFilter === value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 h-4 rounded-full flex items-center ${
                    activeFilter === value ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i}><CardContent className="py-5"><div className="h-14 rounded bg-muted animate-pulse" /></CardContent></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-20 gap-4">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <svg className="h-7 w-7 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">All clear!</p>
                <p className="text-xs text-muted-foreground mt-1">No notifications in this category.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{date}</p>
                <div className="space-y-2">
                  {items.map((n) => {
                    const conf = TYPE_CONFIG[n.type as NotificationType] ?? TYPE_CONFIG.update
                    return (
                      <div
                        key={n.id}
                        className={`group relative flex items-start gap-4 rounded-xl border px-4 py-4 transition-all ${
                          !n.read
                            ? "border-primary/20 bg-primary/5 hover:border-primary/30"
                            : "border-border bg-card hover:border-border/60"
                        }`}
                      >
                        {/* Type icon */}
                        <div className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center border ${conf.color}`}>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={conf.path} />
                          </svg>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${conf.color}`}>
                              {conf.label}
                            </span>
                            {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                            <span className="text-[11px] text-muted-foreground ml-auto">{timeAgo(n.created_at)}</span>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">{n.message}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!n.read && (
                            <button
                              onClick={() => handleMarkRead(n.id)}
                              title="Mark as read"
                              className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(n.id)}
                            title="Dismiss"
                            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
