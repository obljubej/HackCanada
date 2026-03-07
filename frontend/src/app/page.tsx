"use client"

import { useState, useEffect } from "react"
import { supabase, markLoginTime } from "@/lib/supabase"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Alert, AlertDescription } from "@/components/ui/Alert"

const FEATURES = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
    label: "Project Intelligence",
    color: "from-violet-500/20 to-blue-500/20 border-violet-500/30",
    iconBg: "bg-violet-500/20 text-violet-400",
    description: "AI-powered team assembly. Upload a project brief — Backboard ranks your employees by skill match, availability, and experience in seconds.",
    tags: ["PDF Analysis", "Employee Ranking", "Skill Matching", "Team Assembly"],
    href: "/dashboard",
    cta: "Open Dashboard →",
    badge: "Feature 1",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
    label: "AI Voice Meeting Agent",
    color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30",
    iconBg: "bg-emerald-500/20 text-emerald-400",
    description: "Voice-to-voice AI meetings with ElevenLabs. Ask questions, get employee recommendations, and receive AI-generated summaries with action items.",
    tags: ["Voice Conversations", "ElevenLabs TTS", "Live Transcript", "Auto Summary"],
    href: "/meetings",
    cta: "Open Meeting Room →",
    badge: "Feature 2",
  },
]

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        markLoginTime()
        window.location.href = "/chat"
      }
    })
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) { setError(signInError.message); setLoading(false); return }
      } else {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        })
        if (signUpError) { setError(signUpError.message); setLoading(false); return }
        if (signUpData.user) {
          await supabase.from("profiles").upsert(
            { id: signUpData.user.id, email, full_name: name },
            { onConflict: "id" }
          )
        }
      }
      markLoginTime()
      window.location.href = "/chat"
    } catch (err: any) {
      setError(err.message || "Authentication failed")
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError("")
    setLoading(true)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/chat` },
    })
    if (oauthError) { setError(oauthError.message); setLoading(false) }
  }

  const toggleMode = () => {
    setIsLogin(!isLogin)
    setError("")
    setEmail("")
    setPassword("")
    setName("")
  }

  if (!mounted) return null

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* ── Left Panel: Feature Showcase ─────────────────────── */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between border-r border-border bg-gradient-to-br from-black via-zinc-950 to-zinc-900 p-12 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-violet-600/8 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[400px] w-[400px] rounded-full bg-emerald-600/8 blur-[100px] pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg">
            R
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight">RelAI</span>
            <span className="ml-2 text-[11px] text-muted-foreground border border-border px-1.5 py-0.5 rounded-full">Workplace Intelligence</span>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">AI-Powered Platform</p>
          <h1 className="text-4xl font-bold tracking-tight leading-tight">
            Two intelligent systems.<br />One unified platform.
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-md">
            RelAI combines project intelligence with voice-driven AI meetings to transform how teams are built and how work gets done.
          </p>
        </div>

        {/* Feature cards */}
        <div className="relative z-10 space-y-4">
          {FEATURES.map((f) => (
            <div key={f.label} className={`rounded-2xl border bg-gradient-to-br ${f.color} p-5 backdrop-blur-sm`}>
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${f.iconBg}`}>
                  {f.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-foreground">{f.label}</p>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/10 text-muted-foreground">{f.badge}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {f.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="relative z-10 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex -space-x-2">
            {["E", "V", "S"].map((l, i) => (
              <div key={i} className="h-7 w-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[11px] font-semibold">
                {l}
              </div>
            ))}
          </div>
          <p>Powered by Backboard AI · Supabase · ElevenLabs</p>
        </div>
      </div>

      {/* ── Right Panel: Auth Form ────────────────────────────── */}
      <div className="flex w-full flex-col justify-center px-4 py-12 sm:px-6 lg:w-1/2 lg:px-20 xl:px-32 relative">
        {/* Mobile logo */}
        <div className="absolute top-4 right-4 lg:hidden flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-xs">R</div>
          <span className="text-sm font-bold tracking-tight">RelAI</span>
        </div>

        <div className="mx-auto w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-semibold tracking-tight">
              {isLogin ? "Welcome back" : "Create an account"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLogin
                ? "Sign in to access your Project Intelligence & AI Voice Agent"
                : "Get started with RelAI's AI-powered workplace platform"}
            </p>
          </div>

          <div className="space-y-6">
            <Button
              type="button"
              variant="outline"
              className="w-full relative py-6"
              onClick={handleGoogleLogin}
              isLoading={loading}
              disabled={loading}
            >
              <svg className="mr-2 h-5 w-5 absolute left-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {isLogin ? "Continue with Google" : "Sign up with Google"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="animate-in fade-in zoom-in-95">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="name">Full Name</label>
                  <Input
                    id="name"
                    placeholder="Jane Smith"
                    type="text"
                    autoCapitalize="words"
                    autoComplete="name"
                    disabled={loading}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="email">Email</label>
                <Input
                  id="email"
                  placeholder="name@company.com"
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium leading-none" htmlFor="password">Password</label>
                  {isLogin && (
                    <a href="#" className="text-xs font-semibold text-primary hover:underline">
                      Forgot password?
                    </a>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full py-6 mt-2" isLoading={loading} disabled={loading}>
                {isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>

            {/* Divider showing both destinations after login */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center">After signing in you'll access</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-violet-500/5 border border-violet-500/15 p-2.5 text-center">
                  <p className="text-[11px] font-semibold text-violet-400">📊 Project Intelligence</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Dashboard + AI team assembly</p>
                </div>
                <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-2.5 text-center">
                  <p className="text-[11px] font-semibold text-emerald-400">🎙 AI Voice Agent</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Voice meetings + summaries</p>
                </div>
              </div>
            </div>

            <p className="px-8 text-center text-sm text-muted-foreground">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={toggleMode}
                className="font-semibold text-primary hover:text-primary/80 transition-colors hover:underline underline-offset-4"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
