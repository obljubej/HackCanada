"use client"

import { useState, useEffect } from "react"
import { getAllMeetings } from "@/lib/db"
import { Card, CardContent } from "@/components/ui/Card"
import type { Meeting } from "@/lib/types"

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

export default function CalendarPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth())

  useEffect(() => {
    getAllMeetings().then(setMeetings).catch(() => {})
  }, [])

  const today = new Date()

  // Build the calendar grid
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  const getMeetingsForDay = (day: number) => {
    return meetings.filter((m) => {
      const d = new Date(m.start_time)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  const upcoming = meetings
    .filter((m) => new Date(m.start_time) >= today)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 8)

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Meetings, deadlines, and sprint sessions.</p>
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        {/* Calendar Grid */}
        <div className="xl:col-span-2">
          <Card>
            <CardContent className="p-5">
              {/* Month Nav */}
              <div className="flex items-center justify-between mb-5">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-base font-semibold">{MONTHS[month]} {year}</h2>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Day of week headers */}
              <div className="grid grid-cols-7 mb-2">
                {DOW.map((d) => (
                  <div key={d} className="py-1 text-center text-[11px] font-semibold text-muted-foreground uppercase">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-px">
                {cells.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} className="h-14 sm:h-16" />
                  const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                  const dayMeetings = getMeetingsForDay(day)
                  return (
                    <div
                      key={day}
                      className={`h-14 sm:h-16 rounded-lg p-1.5 transition-colors ${
                        isToday ? "bg-primary/20 ring-1 ring-primary/40" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}>
                        {day}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {dayMeetings.slice(0, 2).map((m) => (
                          <div key={m.id} className="truncate rounded bg-blue-500/20 text-blue-400 text-[9px] px-1 font-medium">
                            {m.title}
                          </div>
                        ))}
                        {dayMeetings.length > 2 && (
                          <div className="text-[9px] text-muted-foreground px-1">+{dayMeetings.length - 2} more</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming meetings */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Upcoming</h2>
          {upcoming.length === 0 ? (
            <Card>
              <CardContent className="py-12 flex flex-col items-center gap-3">
                <svg className="h-8 w-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <p className="text-xs text-muted-foreground">No upcoming meetings</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcoming.map((m) => {
                const dt = new Date(m.start_time)
                return (
                  <Card key={m.id}>
                    <CardContent className="py-4 px-4 flex gap-3">
                      <div className="flex-shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-center min-w-[48px]">
                        <div className="text-[10px] font-semibold text-primary uppercase">{MONTHS[dt.getMonth()].slice(0, 3)}</div>
                        <div className="text-lg font-bold text-primary leading-tight">{dt.getDate()}</div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{m.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {dt.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
