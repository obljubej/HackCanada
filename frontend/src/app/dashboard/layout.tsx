import type { Metadata } from "next"
import DashboardLayoutClient from "@/app/dashboard/DashboardLayoutClient"

export const metadata: Metadata = {
  title: "RelAI Dashboard",
  description: "AI-powered workplace intelligence platform",
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>
}
