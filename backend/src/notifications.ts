import { Router } from "express";
import { supabase } from "./config";

const router = Router();

// ── NOTIFICATIONS ────────────────────────────────────────────────

// Get user's notifications
router.get("/notifications", async (req, res) => {
  try {
    const userId = req.query.user_id as string;
    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // Get employee ID from user ID
    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ notifications: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get unread notifications count
router.get("/notifications/unread/count", async (req, res) => {
  try {
    const userId = req.query.user_id as string;
    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // Get employee ID from user ID
    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("employee_id", employee.id)
      .eq("is_read", false);

    if (error) throw error;
    res.json({ unread_count: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mark notification as read
router.put("/notifications/:id/read", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .select();

    if (error) throw error;
    res.json({ notification: data[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create notification (internal)
router.post("/notifications", async (req, res) => {
  try {
    const { employee_id, type, title, message, related_project_id } = req.body;

    const { data, error } = await supabase
      .from("notifications")
      .insert([
        {
          employee_id,
          type,
          title,
          message,
          related_project_id,
        },
      ])
      .select();

    if (error) throw error;
    res.json({ notification: data[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete notification
router.delete("/notifications/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
