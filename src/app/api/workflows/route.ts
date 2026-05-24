import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { cleanJson, toStringArray } from "@/lib/ai";
import { createAdminClient } from "@/lib/supabase";

const TASK_TYPES = [
  "seminararbeit",
  "literatur",
  "bewerbung",
  "email",
  "meeting",
  "priorisierung",
];

type WorkflowResult = {
  output: string;
  next_actions: string[];
};

function validateWorkflowResult(data: unknown): WorkflowResult {
  const value = data as WorkflowResult;

  if (!value || typeof value.output !== "string" || !Array.isArray(value.next_actions)) {
    throw new Error("OpenAI response had an unexpected format.");
  }

  return {
    output: value.output,
    next_actions: toStringArray(value.next_actions).slice(0, 8),
  };
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Bitte zuerst einloggen." }, { status: 401 });
    }

    const supabase = createAdminClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Login konnte nicht geprüft werden." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("agent_runs")
      .select("id, task_type, input, output, next_actions, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ runs: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Bitte zuerst einloggen." }, { status: 401 });
    }

    const supabase = createAdminClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Login konnte nicht geprüft werden." }, { status: 401 });
    }

    const body = await request.json();
    const taskType = String(body.taskType || "seminararbeit");
    const input = String(body.input || "").trim();
    const analysisId = body.analysisId ? String(body.analysisId) : null;

    if (!TASK_TYPES.includes(taskType)) {
      return NextResponse.json({ error: "Diese Aufgabe wird noch nicht unterstützt." }, { status: 400 });
    }

    if (input.length < 10) {
      return NextResponse.json({ error: "Bitte beschreibe kurz, was der Agent tun soll." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Der OpenAI API-Key fehlt." }, { status: 500 });
    }

    let analysisContext = "";

    if (analysisId) {
      const { data: analysis, error: analysisError } = await supabase
        .from("analyses")
        .select("summary, takeaways, open_questions")
        .eq("id", analysisId)
        .eq("user_id", user.id)
        .single();

      if (analysisError || !analysis) {
        return NextResponse.json({ error: "Die Analyse wurde nicht gefunden." }, { status: 404 });
      }

      analysisContext = [
        `Zusammenfassung: ${analysis.summary}`,
        `Takeaways: ${(analysis.takeaways || []).join("; ")}`,
        `Offene Fragen: ${(analysis.open_questions || []).join("; ")}`,
      ].join("\n");
    }

    const { data: knowledgeItems } = await supabase
      .from("knowledge_items")
      .select("title, item_type, content, tags")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12);

    const knowledgeContext = (knowledgeItems || [])
      .map((item) => `- ${item.title} (${item.item_type}): ${item.content}`)
      .join("\n");

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: "gpt-5-nano",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
Du bist ein deutschsprachiger Workflow-Agent für Studierende und Berufseinsteiger.
Aufgabentyp: ${taskType}
Nutzerauftrag:
${input}

Kontext aus ausgewählter Analyse:
${analysisContext || "Kein einzelnes Dokument ausgewählt."}

Wissenssystem:
${knowledgeContext || "Noch keine gespeicherten Wissenseinträge."}

Antworte nur als gültiges JSON:
{
  "output": "Konkretes, direkt nutzbares Ergebnis in Markdown. Keine Einleitung.",
  "next_actions": ["Nächster Schritt 1", "Nächster Schritt 2", "Nächster Schritt 3"]
}
              `.trim(),
            },
          ],
        },
      ],
    });

    const parsed = validateWorkflowResult(JSON.parse(cleanJson(response.output_text)));

    const { data, error } = await supabase
      .from("agent_runs")
      .insert({
        user_id: user.id,
        analysis_id: analysisId,
        task_type: taskType,
        input,
        output: parsed.output,
        next_actions: parsed.next_actions,
      })
      .select("id, task_type, input, output, next_actions, created_at")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Agent-Ergebnis konnte nicht gespeichert werden.");
    }

    return NextResponse.json({ run: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
