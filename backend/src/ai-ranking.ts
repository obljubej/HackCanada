import { supabase } from "./config";
import { ai } from "./config";

interface Employee {
  id: any;
  full_name: any;
  role: any;
  availability_status: any;
  employee_skills: Array<{
    proficiency_level: any;
    years_of_experience: any;
    skills: { name: any; category: any }[];
  }>;
}

interface RankingResult {
  employee_id: string;
  employee_name: string;
  role: string;
  match_score: number;
  reasons: string[];
  missing_skills: string[];
}

/**
 * Analyze project requirements and rank employees
 */
export async function rankEmployeesForProject(
  projectId: string,
  projectDescription: string,
  requiredRoles: string[],
  requiredSkills: string[]
): Promise<RankingResult[]> {
  try {
    // Get all employees with their skills
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select(`
        id,
        full_name,
        role,
        availability_status,
        employee_skills (
          proficiency_level,
          years_of_experience,
          skills (name, category)
        )
      `)
      .eq("availability_status", "available");

    if (empError || !employees) {
      throw new Error("Failed to fetch employees");
    }

    // Build ranking prompt for Gemini
    const prompt = `
You are an expert project team matcher. Analyze the project requirements and rank employees by suitability.

PROJECT DETAILS:
${projectDescription}

REQUIRED ROLES:
${requiredRoles.join(", ")}

REQUIRED SKILLS:
${requiredSkills.join(", ")}

AVAILABLE EMPLOYEES:
${employees
  .map((emp: any) => {
    const skills = emp.employee_skills
      .map(
        (es: any) =>
          `${es.skills[0]?.name || "Unknown"} (${es.proficiency_level}, ${es.years_of_experience} years)`
      )
      .join(", ");

    return `
- ${emp.full_name} (${emp.role})
  Skills: ${skills || "None"}
    `;
  })
  .join("\n")}

For each employee, provide:
1. Match score (0-100)
2. Why they're a good fit
3. Missing skills they need to learn

Format as JSON array with fields: employee_name, match_score, reasons (array of strings), missing_skills (array of strings)
    `;

    // Call Gemini API for ranking
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });

    const responseText = response.text || "";
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : "[]";
    let rankings = JSON.parse(jsonStr);

    // Ensure it's an array
    if (!Array.isArray(rankings)) {
      rankings = [rankings];
    }

    // Convert scores to 0-1 range and attach to employees
    const results: RankingResult[] = rankings
      .map((rank: any) => {
        const emp = employees.find((e: any) => e.full_name === rank.employee_name);
        return {
          employee_id: emp?.id || rank.employee_id,
          employee_name: rank.employee_name,
          role: emp?.role || "Unknown",
          match_score: Math.min((rank.match_score || 0) / 100, 1),
          reasons: rank.reasons || [],
          missing_skills: rank.missing_skills || [],
        };
      })
      .sort((a: RankingResult, b: RankingResult) => b.match_score - a.match_score);

    return results;
  } catch (err) {
    console.error("[AI Ranking] Error:", err);
    throw err;
  }
}

/**
 * Generate skill recommendations for an employee
 */
export async function generateSkillRecommendations(
  employeeId: string,
  projectRequiredSkills: string[]
): Promise<string[]> {
  try {
    const { data: employee } = await supabase
      .from("employees")
      .select(`
        full_name,
        role,
        employee_skills (
          skills (name, category)
        )
      `)
      .eq("id", employeeId)
      .single();

    if (!employee) {
      return [];
    }

    const employeeSkills = employee.employee_skills
      .map((es: any) => es.skills.name)
      .join(", ");

    const prompt = `
Employee: ${employee.full_name} (${employee.role})
Current Skills: ${employeeSkills || "No skills listed"}

Required Skills for Project:
${projectRequiredSkills.join(", ")}

Recommend top 3-5 skills this employee should learn to be better prepared for this project.
Focus on skills that are:
1. Directly relevant to the project
2. Achievable in a reasonable timeframe
3. High-impact for their role

Respond with a JSON array of skill names.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });

    const responseText = response.text || "";
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : "[]";
    let recommendations = JSON.parse(jsonStr);

    if (!Array.isArray(recommendations)) {
      recommendations = [recommendations];
    }

    return recommendations.slice(0, 5);
  } catch (err) {
    console.error("[Skill Recommendation] Error:", err);
    return [];
  }
}

/**
 * Auto-assign top employees to a project and create notifications
 */
export async function autoAssignTopEmployees(
  projectId: string,
  rankings: RankingResult[],
  teamSizeRecommended: number = 5
): Promise<void> {
  try {
    const topEmployees = rankings.slice(0, teamSizeRecommended);

    for (const emp of topEmployees) {
      if (!emp.employee_id) continue;

      // Assign employee
      await supabase.from("project_assignments").insert([
        {
          project_id: projectId,
          employee_id: emp.employee_id,
          role_in_project: emp.role,
          match_score: emp.match_score,
        },
      ]);

      // Create notification
      const message =
        emp.missing_skills.length > 0
          ? `You've been assigned to a project! Before starting, consider improving: ${emp.missing_skills.join(", ")}`
          : `You've been assigned to a new project! Your skills are a great match.`;

      await supabase.from("notifications").insert([
        {
          employee_id: emp.employee_id,
          type: "project_assignment",
          title: "New Project Assignment",
          message,
          related_project_id: projectId,
        },
      ]);

      // If there are missing skills, create skill recommendation notification
      if (emp.missing_skills.length > 0) {
        await supabase.from("notifications").insert([
          {
            employee_id: emp.employee_id,
            type: "skill_recommendation",
            title: "Recommended Skills to Learn",
            message: `Before starting this project, we recommend improving: ${emp.missing_skills.join(", ")}`,
            related_project_id: projectId,
          },
        ]);
      }
    }
  } catch (err) {
    console.error("[Auto Assign] Error:", err);
    throw err;
  }
}
