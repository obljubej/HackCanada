import { Router } from "express";
import { supabase } from "./config";

const router = Router();

// ── DEPARTMENTS ──────────────────────────────────────────────────

// Get all departments
router.get("/departments", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("name");

    if (error) throw error;
    res.json({ departments: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create department
router.post("/departments", async (req, res) => {
  try {
    const { name, description } = req.body;

    const { data, error } = await supabase
      .from("departments")
      .insert([{ name, description }])
      .select();

    if (error) throw error;
    res.json({ department: data[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── EMPLOYEES ────────────────────────────────────────────────────

// Get all employees
router.get("/employees", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("employees")
      .select(`
        id,
        full_name,
        email,
        role,
        department_id,
        availability_status,
        current_projects,
        departments (name),
        employee_skills (
          skills (name, category)
        )
      `)
      .order("full_name");

    if (error) throw error;
    res.json({ employees: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get employee by ID
router.get("/employees/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("employees")
      .select(`
        id,
        full_name,
        email,
        role,
        department_id,
        bio,
        availability_status,
        current_projects,
        departments (name),
        employee_skills (
          skill_id,
          proficiency_level,
          years_of_experience,
          skills (id, name, category)
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    res.json({ employee: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create employee
router.post("/employees", async (req, res) => {
  try {
    const { full_name, email, role, department_id, bio } = req.body;

    const { data, error } = await supabase
      .from("employees")
      .insert([
        {
          full_name,
          email,
          role,
          department_id,
          bio,
          availability_status: "available",
        },
      ])
      .select();

    if (error) throw error;
    res.json({ employee: data[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update employee
router.put("/employees/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, role, department_id, bio, availability_status } =
      req.body;

    const { data, error } = await supabase
      .from("employees")
      .update({
        full_name,
        role,
        department_id,
        bio,
        availability_status,
        updated_at: new Date(),
      })
      .eq("id", id)
      .select();

    if (error) throw error;
    res.json({ employee: data[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── SKILLS ──────────────────────────────────────────────────────

// Get all skills
router.get("/skills", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("skills")
      .select("*")
      .order("name");

    if (error) throw error;
    res.json({ skills: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create skill
router.post("/skills", async (req, res) => {
  try {
    const { name, category, description } = req.body;

    const { data, error } = await supabase
      .from("skills")
      .insert([{ name, category, description }])
      .select();

    if (error) throw error;
    res.json({ skill: data[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add skill to employee
router.post("/employees/:employeeId/skills", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { skill_id, proficiency_level, years_of_experience } = req.body;

    const { data, error } = await supabase
      .from("employee_skills")
      .insert([
        {
          employee_id: employeeId,
          skill_id,
          proficiency_level,
          years_of_experience,
        },
      ])
      .select();

    if (error) throw error;
    res.json({ employee_skill: data[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Remove skill from employee
router.delete("/employees/:employeeId/skills/:skillId", async (req, res) => {
  try {
    const { employeeId, skillId } = req.params;

    const { error } = await supabase
      .from("employee_skills")
      .delete()
      .eq("employee_id", employeeId)
      .eq("skill_id", skillId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
