"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

type EffectiveRole = "manager" | "employee"

interface RoleContextValue {
  /** The role currently in effect (may be overridden by the toggle) */
  effectiveRole: EffectiveRole
  /** Whether the user is currently viewing as a manager */
  isManager: boolean
  /** Toggle between manager ↔ employee view */
  toggleRole: () => void
  /** Whether the role override is active (user manually switched) */
  isOverridden: boolean
}

const RoleContext = createContext<RoleContextValue>({
  effectiveRole: "employee",
  isManager: false,
  toggleRole: () => {},
  isOverridden: false,
})

export function useRole() {
  return useContext(RoleContext)
}

const STORAGE_KEY = "relai_role_override"

export function RoleProvider({
  dbRole,
  children,
}: {
  /** The role fetched from the database / profiles table */
  dbRole: string
  children: ReactNode
}) {
  const [override, setOverride] = useState<EffectiveRole | null>(null)

  // Load persisted override on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "manager" || stored === "employee") {
        setOverride(stored)
      }
    } catch {}
  }, [])

  const dbIsManager = dbRole === "manager" || dbRole === "ceo" || dbRole === "cto"
  const effectiveRole: EffectiveRole = override ?? (dbIsManager ? "manager" : "employee")
  const isManager = effectiveRole === "manager"

  const toggleRole = () => {
    const next: EffectiveRole = effectiveRole === "manager" ? "employee" : "manager"
    setOverride(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
  }

  return (
    <RoleContext.Provider value={{ effectiveRole, isManager, toggleRole, isOverridden: override !== null }}>
      {children}
    </RoleContext.Provider>
  )
}
