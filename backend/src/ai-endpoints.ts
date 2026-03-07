import express from "express";
import { supabase } from "./config.js";
import { askQuestion, resetThread } from "./ask.js";

export const aiRouter = express.Router();

// ── Helper: generate meeting context ─────────────────────────────────────
async function buildMeetingContext(meetingId: string): Promise<string> {
  const { data: meeting } = await supabase
    .from("meetings").select("*, projects(title, description)").eq("id", meetingId).single();
  if (!meeting) return "";

  const { data: participants } = await supabase
    .from("meeting_participants")
    .select("employees(name, role, skills, availability)")
    .eq("meeting_id", meetingId);

  const { data: transcript } = await supabase
    .from("meeting_transcripts")
    .select("speaker, message, created_at")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true })
    .limit(50); // get last 50 messages for context

  const participantList = (participants ?? [])
    .map((p: any) => {
      const e = p.employees;
      return e ? `- ${e.name} (${e.role}) — ${e.availability ? "Available" : "Busy"} — Skills: ${(e.skills || []).join(", ")}` : "";
    })
    .filter(Boolean)
    .join("\n");

  const transcriptText = (transcript ?? [])
    .map((t: any) => `${t.speaker}: ${t.message}`)
    .join("\n");

  return `You are an AI meeting assistant for RelAI — a workplace intelligence platform.

Current Meeting: "${meeting.title}"
Project: ${meeting.projects?.title || "None"} — ${meeting.projects?.description || ""}

Meeting Participants:
${participantList || "No participants listed"}

Recent Transcript:
${transcriptText || "Meeting just started"}

You can:
- Answer project questions
- Recommend employees for roles based on skills and availability
- Summarize discussions
- Suggest task assignments
- Check employee availability

You must respond clearly and concisely as a voice assistant. Do NOT use markdown. Keep your answers brief.`.trim();
}

// ── POST /api/ai/meeting-response ────────────────────────────────────────
aiRouter.post("/meeting-response", async (req, res) => {
  const { meetingId, question, userId = "meeting-ai" } = req.body;
  if (!meetingId || !question) { 
    res.status(400).json({ error: "meetingId and question are required" }); 
    return; 
  }

  try {
    const threadKey = `meeting-${meetingId}`;
    const context = await buildMeetingContext(meetingId);
    const prompt = context
      ? `[MEETING CONTEXT]\n${context}\n\n[USER QUESTION]\n${question}`
      : question;

    // Call Backboard AI internally
    const { answer, threadId } = await askQuestion(threadKey, prompt);

    // Save user's question to transcript
    await supabase.from("meeting_transcripts").insert({
      meeting_id: meetingId,
      speaker: "user", // Can be passed from frontend if known
      message: question,
    });

    // Save AI's response to transcript
    await supabase.from("meeting_transcripts").insert({
      meeting_id: meetingId,
      speaker: "AI Assistant",
      message: answer,
    });

    res.json({ answer, threadId });
  } catch (err: any) {
    console.error("[ai/meeting-response]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/generate-summary ────────────────────────────────────────
aiRouter.post("/generate-summary", async (req, res) => {
  const { meetingId } = req.body;
  if (!meetingId) { 
    res.status(400).json({ error: "meetingId is required" }); 
    return; 
  }

  try {
    const { data: transcript } = await supabase
      .from("meeting_transcripts")
      .select("speaker, message")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true });

    if (!transcript?.length) {
      res.status(400).json({ error: "No transcript found to summarize" });
      return;
    }

    const transcriptText = transcript.map((t: any) => `${t.speaker}: ${t.message}`).join("\n");

    const prompt = `You are an AI assistant. Analyze this meeting transcript and generate a structured summary.

TRANSCRIPT:
${transcriptText}

Respond ONLY with valid JSON in this exact format, with NO markdown formatting:
{
  "summary_text": "Brief paragraph summary of the meeting",
  "key_decisions": ["decision 1", "decision 2"],
  "action_items": [
    {"task": "task description", "assignee": "person name", "due_date": "YYYY-MM-DD or empty string"}
  ]
}`;

    const { answer } = await askQuestion(`summary-${meetingId}`, prompt);
    resetThread(`summary-${meetingId}`);

    let parsed: any = { summary_text: answer, key_decisions: [], action_items: [] };
    try {
      const jsonMatch = answer.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch { /* fallback */ }

    // Upsert the summary
    const { data: summary, error: summaryErr } = await supabase
      .from("meeting_summaries")
      .upsert({
        meeting_id: meetingId,
        summary_text: parsed.summary_text,
        key_decisions: parsed.key_decisions ?? [],
        action_items: parsed.action_items ?? [],
      })
      .select()
      .single();

    if (summaryErr) throw summaryErr;

    // Create Tasks from action items automatically if possible
    const { data: meeting } = await supabase.from("meetings").select("project_id").eq("id", meetingId).single();
    if (meeting?.project_id && parsed.action_items?.length) {
      for (const item of parsed.action_items) {
        // Find employee by name (naive match for demo)
        const { data: assignedList } = await supabase
          .from("employees")
          .select("id")
          .ilike("name", `%${item.assignee}%`)
          .limit(1);
        
        await supabase.from("tasks").insert({
          project_id: meeting.project_id,
          title: item.task,
          assigned_to: assignedList?.[0]?.id || null,
          due_date: item.due_date || null
        });
      }
    }

    res.json(summary);
  } catch (err: any) {
    console.error("[ai/generate-summary]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/task-reminder ──────────────────────────────────────────
aiRouter.post("/task-reminder", async (req, res) => {
  try {
    // Find tasks that are due today or tomorrow
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 2); // padding
    
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*, employees(id, name)")
      .not("status", "eq", "done")
      .lte("due_date", tomorrow.toISOString())
      .not("assigned_to", "is", null);

    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        // Prevent duplicate notifications by checking recency or just inserting blindly for demo
        await supabase.from("notifications").insert({
          employee_id: task.assigned_to,
          type: "deadline",
          title: `Task Reminder: ${task.title}`,
          message: `Reminder: Your task '${task.title}' is due soon.`,
          related_project_id: task.project_id
        });
      }
    }

    res.json({ success: true, remindedCount: tasks?.length || 0 });
  } catch (err: any) {
    console.error("[ai/task-reminder]", err);
    res.status(500).json({ error: err.message });
  }
});
