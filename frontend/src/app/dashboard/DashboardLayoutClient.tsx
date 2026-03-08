"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { supabase, isSessionExpired, clearLoginTime, markLoginTime } from "@/lib/supabase"
import { getNotifications } from "@/lib/db"
import { cn } from "@/lib/utils"
import { RoleProvider, useRole } from "@/lib/role-context"

const MANAGER_NAV = [
  { href: "/dashboard", label: "Overview", exact: true, icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" },
  { href: "/dashboard/projects", label: "Projects", icon: "M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" },
  { href: "/dashboard/employees", label: "Team", icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" },
  { href: "/dashboard/meetings", label: "Meetings", icon: "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" },
  { href: "/dashboard/calendar", label: "Calendar", icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" },
  { href: "/dashboard/inbox", label: "Inbox", badge: true, icon: "M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" },
]

const EMPLOYEE_NAV = [
  { href: "/dashboard", label: "My Dashboard", exact: true, icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" },
  { href: "/dashboard/projects", label: "My Projects", icon: "M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" },
  { href: "/dashboard/meetings", label: "Meetings", icon: "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" },
  { href: "/dashboard/calendar", label: "Calendar", icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" },
  { href: "/dashboard/inbox", label: "Inbox", badge: true, icon: "M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" },
]

const MANAGER_ROLES = ["ceo", "cto", "manager", "engineering manager", "product manager", "vp", "director", "lead"]

function isManagerRole(role?: string): boolean {
  if (!role) return false
  return MANAGER_ROLES.some(r => role.toLowerCase().includes(r))
}

interface DashboardLayoutClientProps {
  children: React.ReactNode
}

export default function DashboardLayoutClient({ children }: DashboardLayoutClientProps) {
  const pathname = usePathname()
  const [userEmail, setUserEmail] = useState("")
  const [userName, setUserName] = useState("")
  const [userId, setUserId] = useState("")
  const [userRole, setUserRole] = useState<string>("employee")
  const [unreadCount, setUnreadCount] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session || isSessionExpired()) {
        clearLoginTime()
        await supabase.auth.signOut()
        window.location.href = "/"
        return
      }
      markLoginTime()
      const email = session.user.email || ""
      const name = session.user.user_metadata?.full_name || email.split("@")[0] || "User"
      setUserEmail(email)
      setUserName(name)
      setUserId(session.user.id)

      // Fetch role from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_role")
        .eq("id", session.user.id)
        .single()

      if (profile?.user_role) {
        setUserRole(profile.user_role)
      } else {
        // Check employees table for role
        const { data: emp } = await supabase
          .from("employees")
          .select("role, user_role")
          .eq("email", email)
          .single()
        if (emp) {
          const resolvedRole = emp.user_role || (isManagerRole(emp.role) ? "manager" : "employee")
          setUserRole(resolvedRole)
        }
      }
    })
  }, [])

  useEffect(() => {
    if (!userId) return
    getNotifications(userId).then((ns) => {
      setUnreadCount(ns.filter((n) => !n.read).length)
    }).catch(() => {})
  }, [userId, pathname])

  const handleSignOut = async () => {
    clearLoginTime()
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  if (!mounted) return null

  return (
    <RoleProvider dbRole={userRole}>
      <DashboardShell
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        unreadCount={unreadCount}
        userName={userName}
        userEmail={userEmail}
        handleSignOut={handleSignOut}
      >
        {children}
      </DashboardShell>
    </RoleProvider>
  )
}

/** Inner component that can use the role context */
function DashboardShell({
  mobileOpen, setMobileOpen, unreadCount, userName, userEmail, handleSignOut, children,
}: {
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
  unreadCount: number
  userName: string
  userEmail: string
  handleSignOut: () => void
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { isManager, effectiveRole, toggleRole, isOverridden } = useRole()

  const NAV = isManager ? MANAGER_NAV : EMPLOYEE_NAV

  const displayRole = effectiveRole === "manager" ? "Manager" : "Employee"
  const roleColor = isManager
    ? "from-violet-500 to-indigo-500"
    : "from-emerald-500 to-teal-500"

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-sidebar transition-transform duration-300 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-6 border-b border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm flex-shrink-0">
            R
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-foreground">RelAI</div>
            <div className="text-[11px] text-muted-foreground">Workspace Intelligence</div>
          </div>
        </div>

        {/* Role badge + Switch button */}
        <div className="px-4 py-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-white bg-gradient-to-r ${roleColor}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-pulse" />
              {displayRole} View
            </div>
            <button
              onClick={toggleRole}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
              title={`Switch to ${isManager ? "Employee" : "Manager"} view`}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              Switch
            </button>
          </div>
          {isOverridden && (
            <p className="text-[10px] text-amber-400/70 leading-tight">Viewing as {displayRole} (demo mode)</p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon, badge, exact }) => {
            const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 group",
                  isActive
                    ? "bg-white/10 text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <svg className={cn("h-5 w-5 flex-shrink-0", isActive && "text-white")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
                <span>{label}</span>
                {badge && unreadCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            )
          })}

          {/* Divider + Chat link (always shown) */}
          <div className="pt-3 pb-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">AI Tools</p>
          </div>
          <Link
            href="/chat"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
              pathname === "/chat"
                ? "bg-white/10 text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <span>Memory Chat</span>
          </Link>
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${roleColor} text-xs font-bold text-white flex-shrink-0`}>
              {userName?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{userName || userEmail}</div>
              <div className="text-[11px] text-muted-foreground">{displayRole}</div>
            </div>
            <button
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Sign out"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-4 sm:px-6">
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1">
            <h1 className="text-sm font-semibold text-foreground">
              {NAV.find((n) => n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + "/"))?.label ?? "Dashboard"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard/inbox" className="relative text-muted-foreground hover:text-foreground transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

// Re-export useRole for convenient imports
export { useRole } from "@/lib/role-context"
