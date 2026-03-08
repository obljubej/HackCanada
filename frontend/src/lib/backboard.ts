/**
 * Backboard AI API client
 * Calls the AI analysis & ranking backend.
 * Falls back to realistic mock data if NEXT_PUBLIC_BACKBOARD_URL is not set.
 */

import type {
  Employee,
  BackboardAnalysis,
  BackboardRanking,
  EmployeeRankResult,
} from "@/lib/types"

const BACKBOARD_URL =
  process.env.NEXT_PUBLIC_BACKBOARD_URL || "http://localhost:5000"

// ─── Analyze Project Document ───────────────────────────────────────────────

export async function analyzeProject(
  projectText: string
): Promise<BackboardAnalysis> {
  try {
    const res = await fetch(`${BACKBOARD_URL}/api/ai/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: projectText }),
    })
    if (!res.ok) throw new Error("Backboard /api/ai/analyze failed")
    return res.json()
  } catch {
    // Fallback: generate mock analysis from keywords
    return mockAnalyzeProject(projectText)
  }
}

// ─── Rank Employees ─────────────────────────────────────────────────────────

export async function rankEmployees(
  analysis: BackboardAnalysis,
  employees: Employee[]
): Promise<BackboardRanking[]> {
  try {
    const res = await fetch(`${BACKBOARD_URL}/api/ai/rank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirements: analysis.required_roles, employees }),
    })
    if (!res.ok) throw new Error("Backboard /api/ai/rank failed")
    return res.json()
  } catch {
    // Fallback: score employees locally by skill overlap
    return mockRankEmployees(analysis, employees)
  }
}

// ─── Mock Implementations ────────────────────────────────────────────────────

function mockAnalyzeProject(text: string): BackboardAnalysis {
  const lower = text.toLowerCase()

  const roleKeywords: Record<string, string[]> = {
    "Frontend Engineer": ["react", "frontend", "ui", "css", "javascript", "nextjs"],
    "Backend Engineer": ["backend", "api", "node", "python", "database", "server"],
    "Product Manager": ["product", "roadmap", "stakeholder", "requirements", "strategy"],
    Designer: ["design", "figma", "ux", "ui", "wireframe", "prototype"],
    "Data Scientist": ["ml", "machine learning", "data", "model", "training", "analytics"],
    "DevOps Engineer": ["devops", "ci/cd", "deployment", "docker", "kubernetes", "infra"],
  }

  const required_roles = Object.entries(roleKeywords)
    .filter(([, kws]) => kws.some((kw) => lower.includes(kw)))
    .map(([role, kws]) => ({
      role,
      count: 1,
      skills: kws.filter((kw) => lower.includes(kw)).slice(0, 3),
    }))
    .slice(0, 5)

  if (required_roles.length === 0) {
    required_roles.push({ role: "Engineer", count: 2, skills: ["problem-solving", "communication"] })
  }

  const complexityWords = ["architecture", "scale", "enterprise", "migration", "integration"]
  const highComplexity = complexityWords.filter((w) => lower.includes(w)).length

  return {
    required_roles,
    team_size: required_roles.reduce((s, r) => s + r.count, 0),
    complexity:
      highComplexity >= 3 ? "high" : highComplexity >= 1 ? "medium" : "low",
    summary: `This project requires a team of ${required_roles.reduce((s, r) => s + r.count, 0)} across ${required_roles.length} roles.`,
  }
}

function mockRankEmployees(
  analysis: BackboardAnalysis,
  employees: Employee[]
): BackboardRanking[] {
  return analysis.required_roles.map((req) => {
    const candidates: EmployeeRankResult[] = employees
      .filter((e) => {
        const roleMatch =
          e.role.toLowerCase().includes(req.role.toLowerCase().split(" ")[0].toLowerCase()) ||
          req.role.toLowerCase().includes(e.role.toLowerCase().split(" ")[0].toLowerCase())
        return roleMatch || e.skills.some((s) => req.skills.includes(s.toLowerCase()))
      })
      .map((e) => {
        const matched = e.skills.filter((sk) =>
          req.skills.some((rs) => sk.toLowerCase().includes(rs.toLowerCase()))
        )
        const rawScore =
          (matched.length / Math.max(req.skills.length, 1)) * 60 +
          (e.role.toLowerCase().includes(req.role.toLowerCase().split(" ")[0].toLowerCase()) ? 35 : 0) +
          Math.random() * 10
        const score = Math.min(Math.round(rawScore), 99)
        const missing = req.skills.filter(
          (rs) => !e.skills.some((sk) => sk.toLowerCase().includes(rs.toLowerCase()))
        )
        return {
          employee_id: e.id,
          employee_name: e.name,
          match_score: score,
          matched_skills: matched,
          missing_skills: missing,
          available: e.availability,
        }
      })
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 5)

    // if no matched candidates, take top 3 from all available
    if (candidates.length === 0) {
      employees.slice(0, 3).forEach((e) => {
        candidates.push({
          employee_id: e.id,
          employee_name: e.name,
          match_score: Math.round(40 + Math.random() * 30),
          matched_skills: [],
          missing_skills: req.skills,
          available: e.availability,
        })
      })
    }

    return { role: req.role, candidates }
  })
}
