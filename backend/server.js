
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error("Missing Supabase environment variables in backend/.env");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

// Basic health check and database connection check.
app.get("/health", async (req, res) => {
  const { error } = await supabase
    .from("calls")
    .select("id")
    .limit(1);

  if (error) {
    console.error("Supabase health check failed:", error.message);
    return res.status(503).json({
      status: "error",
      message: "Backend is running, but the database check failed.",
    });
  }

  res.json({
    status: "ok",
    message: "Backend and Supabase are connected.",
  });
});

// Create a new call.
app.post("/api/calls", async (req, res) => {
  try {
    const prospect =
      typeof req.body.prospect === "string" && req.body.prospect.trim()
        ? req.body.prospect.trim()
        : "Unnamed prospect";

    const { data, error } = await supabase
      .from("calls")
      .insert({ prospect })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error("Create call failed:", error.message);
    res.status(500).json({ error: "Could not create call." });
  }
});

// Save or update a stage of a call.
app.post("/api/calls/:id/stages", async (req, res) => {
  try {
    const callId = Number(req.params.id);
    const stage = Number(req.body.stage);
    const selectedResponse = req.body.selected_response ?? null;
    const prospectWords = req.body.prospect_words ?? "";

    if (!Number.isSafeInteger(callId) || callId <= 0) {
      return res.status(400).json({ error: "Invalid call ID." });
    }

    if (!Number.isInteger(stage) || stage < 1 || stage > 8) {
      return res.status(400).json({ error: "Stage must be between 1 and 8." });
    }

    if (
      typeof prospectWords !== "string" ||
      (selectedResponse !== null && typeof selectedResponse !== "string")
    ) {
      return res.status(400).json({ error: "Invalid stage data." });
    }

    const stageNames = [
      "Opening",
      "Purpose",
      "Permission",
      "Their business",
      "Their need",
      "Objection",
      "Next step",
      "Close",
    ];

    const { data: existingCall, error: callError } = await supabase
      .from("calls")
      .select("id")
      .eq("id", callId)
      .maybeSingle();

    if (callError) throw callError;

    if (!existingCall) {
      return res.status(404).json({ error: "Call not found." });
    }

    const { data, error } = await supabase
      .from("call_stages")
      .upsert(
        {
          call_id: callId,
          stage,
          stage_name: stageNames[stage - 1],
          selected_response: selectedResponse,
          prospect_words: prospectWords.trim(),
          saved_at: new Date().toISOString(),
        },
        { onConflict: "call_id,stage" }
      )
      .select()
      .single();

    if (error) throw error;

    const { error: updateError } = await supabase
      .from("calls")
      .update({ current_stage: stage })
      .eq("id", callId);

    if (updateError) throw updateError;

    res.json(data);
  } catch (error) {
    console.error("Save stage failed:", error.message);
    res.status(500).json({ error: "Could not save call stage." });
  }
});

// Finish a call.
app.post("/api/calls/:id/close", async (req, res) => {
  try {
    const callId = Number(req.params.id);
    const { outcome, next_step } = req.body;

    if (!Number.isSafeInteger(callId) || callId <= 0) {
      return res.status(400).json({ error: "Invalid call ID." });
    }

    const { data, error } = await supabase
      .from("calls")
      .update({
        outcome:
          typeof outcome === "string" && outcome.trim()
            ? outcome.trim()
            : "Call ended",
        next_step:
          typeof next_step === "string" ? next_step.trim() : "",
        ended_at: new Date().toISOString(),
      })
      .eq("id", callId)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: "Call not found." });
    }

    res.json(data);
  } catch (error) {
    console.error("Finish call failed:", error.message);
    res.status(500).json({ error: "Could not finish call." });
  }
});

// Retrieve calls and their saved stage details.
app.get("/api/calls", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("calls")
      .select("*, call_stages(*)")
      .order("started_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Load calls failed:", error.message);
    res.status(500).json({ error: "Could not load call history." });
  }
});

app.post("/api/coach", async (req, res) => {
  try {
    const { stage, stagePurpose, prospectWords } = req.body;

    if (!stage || !stagePurpose || !prospectWords?.trim()) {
      return res.status(400).json({
        error: "Stage, purpose, and prospect words are required.",
      });
    }

    if (!process.env.OLLAMA_API_KEY) {
      return res.status(503).json({
        error: "Ollama API key is not configured.",
      });
    }

    const prompt = `
You are CallPilot, a concise cold-call coaching assistant.

Stage: ${String(stage).slice(0, 100)}
Purpose: ${String(stagePurpose).slice(0, 500)}
Prospect's actual words: ${String(prospectWords).slice(0, 1500)}

Provide:
1. Suggested response: one natural sentence.
2. Next question: one relevant question.
3. Coaching tip: one practical tip.

Respect refusals and requests not to be contacted.
Never invent facts. Keep the response under 120 words.
`;

    const response = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
      },
      body: JSON.stringify({
        // Change this to a model available to your account.
        model: "gpt-oss:20b",
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Ollama API error:", response.status, data);
      return res.status(502).json({
        error: "Ollama could not generate a response. Check model access and usage limits.",
      });
    }

    const suggestion = data.message?.content?.trim();

    if (!suggestion) {
      return res.status(502).json({
        error: "Ollama returned an empty response.",
      });
    }

    return res.json({ suggestion });
  } catch (error) {
    console.error("Ollama coach error:", error.message);
    return res.status(500).json({
      error: "Unable to reach Ollama.",
    });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
