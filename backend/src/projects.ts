import { Router } from "express";
import { supabase } from "./config";
import { rankEmployeesForProject, autoAssignTopEmployees } from "./ai-ranking.js";
import { createProjectNotionWorkspace } from "./notion-integration.js";

const router = Router();

// ── PROJECTS ─────────────────────────────────────────────────────

// Get all projects
router.get("/projects", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select(`
        id,
        name,
        description,
        status,
        required_roles,
        required_skills,
        team_size_recommended,
        complexity_level,
        created_at,
        employees (full_name, role)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ projects: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get project by ID
router.get("/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("projects")
      .select(`
        id,
        name,
        description,
        pdf_url,
        status,
        required_roles,
        required_skills,
        team_size_recommended,
        complexity_level,
        created_at,
        project_assignments (
          id,
          employee_id,
          role_in_project,
          match_score,
          employees (full_name, role, email)
        ),
        notion_workspaces (notion_page_id, notion_url)
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    res.json({ project: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create project
router.post("/projects", async (req, res) => {
  try {
    const {
      name,
      description,
      required_roles,
      required_skills,
      team_size_recommended,
      complexity_level,
      created_by,
    } = req.body;

    const { data, error } = await supabase
      .from("projects")
      .insert([
        {
          name,
          description,
          required_roles: required_roles || [],
          required_skills: required_skills || [],
          team_size_recommended,
          complexity_level,
          status: "planning",
          created_by,
        },
      ])
      .select();

    if (error) throw error;
    res.json({ project: data[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update project
router.put("/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status, required_roles, required_skills } =
      req.body;

    const { data, error } = await supabase
      .from("projects")
      .update({
        name,
        description,
        status,
        required_roles,
        required_skills,
        updated_at: new Date(),
      })
      .eq("id", id)
      .select();

    if (error) throw error;
    res.json({ project: data[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PROJECT ASSIGNMENTS ──────────────────────────────────────────

// Assign employee to project
router.post("/projects/:projectId/assign", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { employee_id, role_in_project, match_score } = req.body;

    const { data, error } = await supabase
      .from("project_assignments")
      .insert([
        {
          project_id: projectId,
          employee_id,
          role_in_project,
          match_score,
        },
      ])
      .select();

    if (error) throw error;

    // Create notification for assigned employee
    await supabase.from("notifications").insert([
      {
        employee_id,
        type: "project_assignment",
        title: "You've been assigned to a project",
        message: `You have been assigned to a new project: ${role_in_project}`,
        related_project_id: projectId,
      },
    ]);

    res.json({ assignment: data[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Remove employee from project
router.delete("/projects/:projectId/assign/:employeeId", async (req, res) => {
  try {
    const { projectId, employeeId } = req.params;

    const { error } = await supabase
      .from("project_assignments")
      .delete()
      .eq("project_id", projectId)
      .eq("employee_id", employeeId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get project team
router.get("/projects/:projectId/team", async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data, error } = await supabase
      .from("project_assignments")
      .select(`
        id,
        role_in_project,
        match_score,
        employees (
          id,
          full_name,
          email,
          role,
          employee_skills (
            skills (name, category)
          )
        )
      `)
      .eq("project_id", projectId);

    if (error) throw error;
    res.json({ team: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── TASKS ────────────────────────────────────────────────────────

// Get project tasks
router.get("/projects/:projectId/tasks", async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data, error } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        description,
        status,
        priority,
        due_date,
        assigned_to,
        employees (full_name, email)
      `)
      .eq("project_id", projectId)
      .order("due_date");

    if (error) throw error;
    res.json({ tasks: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create task
router.post("/projects/:projectId/tasks", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, description, assigned_to, priority, due_date } = req.body;

    const { data, error } = await supabase
      .from("tasks")
      .insert([
        {
          project_id: projectId,
          title,
          description,
          assigned_to,
          priority,
          due_date,
          status: "todo",
        },
      ])
      .select();

    if (error) throw error;
    res.json({ task: data[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update task
router.put("/tasks/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, status, priority, due_date } = req.body;

    const { data, error } = await supabase
      .from("tasks")
      .update({
        title,
        description,
        status,
        priority,
        due_date,
        updated_at: new Date(),
      })
      .eq("id", taskId)
      .select();

    if (error) throw error;
    res.json({ task: data[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI RANKING & RECOMMENDATIONS ──────────────────────────────

// Get AI-ranked employees for a project
router.post("/projects/:projectId/rank-employees", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { auto_assign = false } = req.body;

    // Get project details
    const { data: project, error: projError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projError || !project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Rank employees
    const rankings = await rankEmployeesForProject(
      projectId,
      project.description || project.name,
      project.required_roles || [],
      project.required_skills || []
    );

    // Auto-assign top employees if requested
    if (auto_assign && rankings.length > 0) {
      await autoAssignTopEmployees(
        projectId,
        rankings,
        project.team_size_recommended || 5
      );

      // Try to create Notion workspace
      try {
        const { data: team } = await supabase
          .from("project_assignments")
          .select(`
            employees (full_name, role)
          `)
          .eq("project_id", projectId);

        if (team && team.length > 0) {
          const teamMembers = team.map((t: any) => ({
            full_name: t.employees.full_name,
            role: t.employees.role,
          }));

          await createProjectNotionWorkspace(
            projectId,
            project.name,
            project.description || "",
            teamMembers
          );
        }
      } catch (notionErr) {
        console.error("Notion integration failed:", notionErr);
        // Don't fail the request if Notion fails
      }
    }

    res.json({ rankings, auto_assigned: auto_assign });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
