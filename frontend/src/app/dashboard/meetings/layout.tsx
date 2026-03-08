import { ReactNode } from "react"

export default function MeetingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#13131f] text-foreground font-sans antialiased selection:bg-indigo-500/30">
      {children}
    </div>
  )
}
