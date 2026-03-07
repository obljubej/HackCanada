import express from "express";
import multer from "multer";

export const voiceRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ── GET elevenlabs TTS stream ────────────────────────────────────────────────
// The user prompt specifically requested POST /api/voice/text-to-speech
voiceRouter.post("/text-to-speech", express.json(), async (req, res) => {
  // Using 'EXAVITQu4vr4xnSDxMaL' (Sarah) for a highly conversational, human voice
  const { text, voiceId = "EXAVITQu4vr4xnSDxMaL" } = req.body;
  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ELEVENLABS_API_KEY is not configured on the backend." });
    return;
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    // Return the audio buffer to the frontend
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.length,
    });
    
    res.send(buffer);
  } catch (err: any) {
    console.error("[voice/text-to-speech]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST speech-to-text ──────────────────────────────────────────────────
// Receives an audio file upload, converts it to text
voiceRouter.post("/speech-to-text", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No audio file provided" });
    return;
  }

  try {
    // For this prototype, depending on the environment, we might use Gemini 1.5 Pro to transcribe Audio, 
    // or rely on a fallback if a dedicated STT key isn't provided.
    // Given the Google Gen AI is present in package.json:
    const { GoogleGenAI } = await import("@google/genai");
    
    if (process.env.GEMINI_API_KEY) {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            {
               role: 'user',
               parts: [
                   { text: "Transcribe the following audio accurately. Just output the transcript text and nothing else." },
                   {
                       inlineData: {
                           data: req.file.buffer.toString("base64"),
                           mimeType: req.file.mimetype || "audio/webm",
                       }
                   }
               ]
            }
        ]
      });
      res.json({ text: response.text?.trim() || "" });
      return;
    }

    res.status(501).json({ error: "No STT provider configured (requires GEMINI_API_KEY)" });
  } catch (err: any) {
    console.error("[voice/speech-to-text]", err);
    res.status(500).json({ error: err.message });
  }
});
