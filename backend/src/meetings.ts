import express from "express";
import { supabase } from "./config.js";
import { askQuestion, resetThread } from "./ask.js";

export const meetingsRouter = express.Router();

// ── Helper: build meeting AI context ─────────────────────────────────

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
    .limit(30);

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

  return `
You are an AI meeting assistant for RelAI — a workplace intelligence platform.

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

Be concise and professional. Format employee recommendations with match percentages when relevant.
`.trim();
}

// ── GET /meetings ─────────────────────────────────────────────────────

meetingsRouter.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("meetings")
      .select("*, projects(title)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /meetings ────────────────────────────────────────────────────

meetingsRouter.post("/", async (req, res) => {
  const { title, project_id, scheduled_at, host_id, participant_ids } = req.body;
  if (!title) { res.status(400).json({ error: "title is required" }); return; }

  try {
    const { data: meeting, error } = await supabase
      .from("meetings")
      .insert({ title, project_id: project_id || null, scheduled_at, host_id, status: "scheduled" })
      .select()
      .single();
    if (error) throw error;

    // Add participants
    if (participant_ids?.length) {
      await supabase.from("meeting_participants").insert(
        participant_ids.map((eid: string) => ({ meeting_id: meeting.id, employee_id: eid }))
      );
    }

    res.json(meeting);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /meetings/:id ─────────────────────────────────────────────────

meetingsRouter.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("meetings")
      .select("*, projects(title, description)")
      .eq("id", req.params.id)
      .single();
    if (error) throw error;

    const { data: participants } = await supabase
      .from("meeting_participants")
      .select("employees(id, name, role, skills, availability)")
      .eq("meeting_id", req.params.id);

    const { data: transcript } = await supabase
      .from("meeting_transcripts")
      .select("*")
      .eq("meeting_id", req.params.id)
      .order("created_at", { ascending: true });

    const { data: summary } = await supabase
      .from("meeting_summaries")
      .select("*")
      .eq("meeting_id", req.params.id)
      .single();

    res.json({
      ...data,
      participants: (participants ?? []).map((p: any) => p.employees),
      transcript: transcript ?? [],
      summary: summary ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /meetings/:id/start ──────────────────────────────────────────

meetingsRouter.post("/:id/start", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("meetings")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /meetings/:id/end ────────────────────────────────────────────

meetingsRouter.post("/:id/end", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("meetings")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;

    // Auto-generate summary after ending
    const meetingId = req.params.id;
    generateSummary(meetingId).catch(console.error);

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /meetings/:id/transcript ─────────────────────────────────────

meetingsRouter.post("/:id/transcript", async (req, res) => {
  const { speaker, message } = req.body;
  if (!message) { res.status(400).json({ error: "message is required" }); return; }

  try {
    const { data, error } = await supabase
      .from("meeting_transcripts")
      .insert({ meeting_id: req.params.id, speaker: speaker || "user", message })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /meetings/:id/ask ────────────────────────────────────────────
// AI responds to a meeting question, save Q&A to transcript

meetingsRouter.post("/:id/ask", async (req, res) => {
  const { question, userId = "meeting-ai" } = req.body;
  if (!question) { res.status(400).json({ error: "question is required" }); return; }

  try {
    const meetingId = req.params.id;
    const threadKey = `meeting-${meetingId}`;

    // Build context-aware prompt
    const context = await buildMeetingContext(meetingId);
    const prompt = context
      ? `[MEETING CONTEXT]\n${context}\n\n[USER QUESTION]\n${question}`
      : question;

    const { answer, threadId } = await askQuestion(threadKey, prompt);

    // Save Q&A to transcript
    await supabase.from("meeting_transcripts").insert([
      { meeting_id: meetingId, speaker: "user", message: question },
      { meeting_id: meetingId, speaker: "AI Assistant", message: answer },
    ]);

    // Store thread ID on meeting record if not already set
    await supabase
      .from("meetings")
      .update({ meeting_thread_id: threadId })
      .eq("id", meetingId)
      .is("meeting_thread_id", null);

    res.json({ answer, threadId });
  } catch (err: any) {
    console.error("[meetings/ask]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /meetings/:id/summary ─────────────────────────────────────────

meetingsRouter.get("/:id/summary", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("meeting_summaries")
      .select("*")
      .eq("meeting_id", req.params.id)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    res.json(data ?? null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /meetings/:id/summary/generate ──────────────────────────────

meetingsRouter.post("/:id/summary/generate", async (req, res) => {
  try {
    const summary = await generateSummary(req.params.id);
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Internal: generateSummary ─────────────────────────────────────────

async function generateSummary(meetingId: string) {
  const { data: transcript } = await supabase
    .from("meeting_transcripts")
    .select("speaker, message")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  if (!transcript?.length) return null;

  const transcriptText = transcript.map((t: any) => `${t.speaker}: ${t.message}`).join("\n");

  const prompt = `You are an AI assistant. Analyze this meeting transcript and generate a structured summary.

TRANSCRIPT:
${transcriptText}

Respond ONLY with valid JSON in this exact format:
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
    // Extract JSON from the answer
    const jsonMatch = answer.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch { /* use raw answer if parse fails */ }

  const { data, error } = await supabase
    .from("meeting_summaries")
    .upsert({
      meeting_id: meetingId,
      summary_text: parsed.summary_text,
      key_decisions: parsed.key_decisions ?? [],
      action_items: parsed.action_items ?? [],
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
