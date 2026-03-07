import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { askQuestion, resetThread } from "./ask.js";

export const meetingsRouter = express.Router();

const DB_PATH = path.join(process.cwd(), "meetings_db.json");

// Define a simple local schema interface
interface LocalDB {
  meetings: any[];
  meeting_participants: any[];
  meeting_transcripts: any[];
  meeting_summaries: any[];
}

function readDB(): LocalDB {
  if (!fs.existsSync(DB_PATH)) {
    return { meetings: [], meeting_participants: [], meeting_transcripts: [], meeting_summaries: [] };
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeDB(db: LocalDB) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ── Helper: build meeting AI context ─────────────────────────────────

async function buildMeetingContext(meetingId: string): Promise<string> {
  const db = readDB();
  const meeting = db.meetings.find(m => m.id === meetingId);
  if (!meeting) return "";

  const participants = db.meeting_participants.filter(p => p.meeting_id === meetingId);
  const transcript = db.meeting_transcripts.filter(t => t.meeting_id === meetingId).slice(-30);

  const participantList = participants
    .map((p: any) => `- Participant User ID: ${p.employee_id}`)
    .join("\n");

  const transcriptText = transcript
    .map((t: any) => `${t.speaker}: ${t.message}`)
    .join("\n");

  return `
You are an AI meeting assistant for RelAI — a workplace intelligence platform.

Current Meeting: "${meeting.title}"
Project Placeholder: None

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
    const db = readDB();
    // sort by created_at desc
    const sorted = db.meetings.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(sorted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /meetings ────────────────────────────────────────────────────

meetingsRouter.post("/", async (req, res) => {
  const { title, project_id, scheduled_at, host_id, participant_ids } = req.body;
  if (!title) { res.status(400).json({ error: "title is required" }); return; }

  try {
    const db = readDB();
    const meeting = {
      id: crypto.randomUUID(),
      title,
      project_id: project_id || null,
      scheduled_at: scheduled_at || new Date().toISOString(),
      host_id: host_id || null,
      status: "scheduled",
      created_at: new Date().toISOString()
    };
    db.meetings.push(meeting);

    if (participant_ids?.length) {
      for (const eid of participant_ids) {
        db.meeting_participants.push({
          id: crypto.randomUUID(),
          meeting_id: meeting.id,
          employee_id: eid
        });
      }
    }
    writeDB(db);

    res.json(meeting);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /meetings/:id ─────────────────────────────────────────────────

meetingsRouter.get("/:id", async (req, res) => {
  try {
    const db = readDB();
    const meeting = db.meetings.find(m => m.id === req.params.id);
    if (!meeting) { res.status(404).json({ error: "Not found" }); return; }

    const participants = db.meeting_participants.filter(p => p.meeting_id === req.params.id);
    const transcript = db.meeting_transcripts.filter(t => t.meeting_id === req.params.id);
    const summary = db.meeting_summaries.find(s => s.meeting_id === req.params.id) || null;

    res.json({
      ...meeting,
      participants: participants,
      transcript: transcript,
      summary: summary,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /meetings/:id/start ──────────────────────────────────────────

meetingsRouter.post("/:id/start", async (req, res) => {
  try {
    const db = readDB();
    const mInfo = db.meetings.find(m => m.id === req.params.id);
    if (mInfo) {
      mInfo.status = "active";
      mInfo.started_at = new Date().toISOString();
      writeDB(db);
      res.json(mInfo);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /meetings/:id/end ────────────────────────────────────────────

meetingsRouter.post("/:id/end", async (req, res) => {
  try {
    const db = readDB();
    const mInfo = db.meetings.find(m => m.id === req.params.id);
    if (mInfo) {
      mInfo.status = "ended";
      mInfo.ended_at = new Date().toISOString();
      writeDB(db);
      // Auto-generate summary mock
      if (!db.meeting_summaries.find(s => s.meeting_id === req.params.id)) {
         db.meeting_summaries.push({
            id: crypto.randomUUID(),
            meeting_id: req.params.id,
            summary_text: "Meeting successfully recorded locally.",
            action_items: [{ task: "Review Notes", priority: "low" }],
            key_decisions: ["Migrated to JSON local fallback"]
         });
         writeDB(db);
      }
      res.json(mInfo);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /meetings/:id/transcript ─────────────────────────────────────

meetingsRouter.post("/:id/transcript", async (req, res) => {
  const { speaker, message } = req.body;
  if (!message) { res.status(400).json({ error: "message is required" }); return; }

  try {
    const db = readDB();
    const trans = {
      id: crypto.randomUUID(),
      meeting_id: req.params.id,
      speaker: speaker || "user",
      message,
      created_at: new Date().toISOString()
    };
    db.meeting_transcripts.push(trans);
    writeDB(db);

    res.json(trans);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /meetings/:id/ask ────────────────────────────────────────────

meetingsRouter.post("/:id/ask", async (req, res) => {
  const { question, userId = "meeting-ai" } = req.body;
  if (!question) { res.status(400).json({ error: "question is required" }); return; }

  try {
    const meetingId = req.params.id;
    const threadKey = `meeting-${meetingId}`;

    const context = await buildMeetingContext(meetingId);
    const prompt = context
      ? `[MEETING CONTEXT]\n${context}\n\n[USER QUESTION]\n${question}`
      : question;

    const { answer, threadId } = await askQuestion(threadKey, prompt);

    const db = readDB();
    db.meeting_transcripts.push({
      id: crypto.randomUUID(),
      meeting_id: meetingId,
      speaker: "user",
      message: question,
      created_at: new Date().toISOString()
    });
    db.meeting_transcripts.push({
      id: crypto.randomUUID(),
      meeting_id: meetingId,
      speaker: "AI Assistant",
      message: answer,
      created_at: new Date().toISOString()
    });

    const mInfo = db.meetings.find(m => m.id === meetingId);
    if (mInfo) {
      mInfo.meeting_thread_id = threadId;
    }
    writeDB(db);

    res.json({ answer, threadId });
  } catch (err: any) {
    console.error("[meetings/ask]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /meetings/:id/summary ─────────────────────────────────────────

meetingsRouter.get("/:id/summary", async (req, res) => {
  try {
    const db = readDB();
    const summary = db.meeting_summaries.find(s => s.meeting_id === req.params.id);
    res.json(summary || null);
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
  const db = readDB();
  const transcript = db.meeting_transcripts.filter(t => t.meeting_id === meetingId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

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

  const summaryIndex = db.meeting_summaries.findIndex(s => s.meeting_id === meetingId);
  const newSummary = {
    id: summaryIndex >= 0 ? db.meeting_summaries[summaryIndex].id : crypto.randomUUID(),
    meeting_id: meetingId,
    summary_text: parsed.summary_text,
    key_decisions: parsed.key_decisions ?? [],
    action_items: parsed.action_items ?? [],
  };

  if (summaryIndex >= 0) {
    db.meeting_summaries[summaryIndex] = newSummary;
  } else {
    db.meeting_summaries.push(newSummary);
  }

  writeDB(db);
  return newSummary;
}
