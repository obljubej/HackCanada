"use client"

import { useState, useEffect, useCallback } from "react"
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import type { Notification, NotificationType } from "@/lib/types"

const TYPE_CONFIG: Record<NotificationType, { label: string; color: string; icon: React.ReactNode }> = {
  assignment: {
    label: "Assignment",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  skill_gap: {
    label: "Skill Gap",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  meeting: {
    label: "Meeting",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  deadline: {
    label: "Deadline",
    color: "bg-red-500/10 text-red-400 border-red-500/20",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  update: {
    label: "Update",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
  },
}

export default function InboxPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [userId, setUserId] = useState("")
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<NotificationType | "all">("all")

  const load = useCallback(async (uid: string) => {
    const ns = await getNotifications(uid)
    setNotifications(ns)
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

  const filtered = activeFilter === "all"
    ? notifications
    : notifications.filter((n) => n.type === activeFilter)

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "assignment", "skill_gap", "meeting", "deadline", "update"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              activeFilter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
            }`}
          >
            {f === "all" ? "All" : f.replace("_", " ")}
            {f === "all" && notifications.length > 0 && (
              <span className="ml-1.5 text-[10px] opacity-60">{notifications.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="py-5"><div className="h-10 rounded bg-muted animate-pulse" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 gap-4">
            <svg className="h-10 w-10 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
            </svg>
            <p className="text-sm text-muted-foreground">No notifications here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const typeConf = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.update
            return (
              <Card
                key={n.id}
                className={`transition-all ${!n.read ? "border-primary/20 bg-primary/5" : ""}`}
              >
                <CardContent className="py-4 px-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center border ${typeConf.color}`}>
                      {typeConf.icon}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${typeConf.color}`}>
                          {typeConf.label}
                        </span>
                        {!n.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                        <span className="text-[11px] text-muted-foreground ml-auto">
                          {new Date(n.created_at).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{n.message}</p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        title="Mark as read"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
