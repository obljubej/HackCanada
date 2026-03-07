import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Session expiry ───────────────────────────────────────────────────
// Sessions expire after this many minutes of inactivity.
const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

const LOGIN_TS_KEY = 'relai_login_ts'

/** Call after a successful login to record the timestamp. */
export function markLoginTime() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOGIN_TS_KEY, Date.now().toString())
  }
}

/** Returns true if the session has expired (or no timestamp was recorded). */
export function isSessionExpired(): boolean {
  if (typeof window === 'undefined') return false
  const ts = localStorage.getItem(LOGIN_TS_KEY)
  if (!ts) return true
  return Date.now() - parseInt(ts, 10) > SESSION_TIMEOUT_MS
}

/** Clear the stored login timestamp (call on sign-out). */
export function clearLoginTime() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOGIN_TS_KEY)
  }
}
