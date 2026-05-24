import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { cleanJson } from "@/lib/ai";
import { createAdminClient } from "@/lib/supabase";

const FREE_MONTHLY_LIMIT = 3;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

type AnalysisResult = {
  summary: string;
  takeaways: string[];
  open_questions: string[];
  flashcards: { question: string; answer: string }[];
};

function validateAnalysis(data: unknown): AnalysisResult {
  const value = data as AnalysisResult;

  if (
    !value ||
    typeof value.summary !== "string" ||
    !Array.isArray(value.takeaways) ||
    !Array.isArray(value.open_questions) ||
    !Array.isArray(value.flashcards)
  ) {
    throw new Error("OpenAI response had an unexpected format.");
  }

  return value;
}

function getMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function getFriendlyError(error: unknown) {
  const apiError = error as { status?: number; code?: string; message?: string };

  if (apiError.status === 429 || apiError.code === "insufficient_quota") {
    return {
      message:
        "Dein OpenAI API-Konto hat aktuell kein verfügbares Guthaben oder kein aktives Billing.",
      status: 402,
    };
  }

  if (apiError.status === 401 || apiError.code === "invalid_api_key") {
    return {
      message: "Der OpenAI API-Key ist ungültig oder fehlt.",
      status: 401,
    };
  }

  return {
    message: error instanceof Error ? error.message : "Unbekannter Fehler.",
    status: 500,
  };
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

    const { count: usageCount, error: usageCountError } = await supabase
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", getMonthStart());

    const { count: analysisCount, error: analysisCountError } = usageCountError
      ? await supabase
          .from("analyses")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", getMonthStart())
      : { count: usageCount, error: null };

    if (analysisCountError) {
      throw new Error(analysisCountError.message);
    }

    const currentUsage = analysisCount || 0;

    if (currentUsage >= FREE_MONTHLY_LIMIT) {
      return NextResponse.json(
        {
          error: `Du hast dein kostenloses Monatslimit von ${FREE_MONTHLY_LIMIT} PDF-Analysen erreicht.`,
        },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("pdf");
    const subjectIdValue = formData.get("subject_id");
    const subjectId = typeof subjectIdValue === "string" && subjectIdValue ? subjectIdValue : null;
    let selectedSubject: { id: string; name: string; color: string } | null = null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Bitte lade eine PDF-Datei hoch." }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Bitte lade eine PDF-Datei hoch." }, { status: 400 });
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: "Das PDF ist zu groß. Bitte lade maximal 10 MB hoch." },
        { status: 413 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Der OpenAI API-Key fehlt." }, { status: 500 });
    }

    if (subjectId) {
      const { data: subject, error: subjectError } = await supabase
        .from("subjects")
        .select("id, name, color")
        .eq("id", subjectId)
        .eq("user_id", user.id)
        .single();

      if (subjectError || !subject) {
        return NextResponse.json({ error: "Das ausgewählte Fach wurde nicht gefunden." }, { status: 404 });
      }

      selectedSubject = subject;
    }

    const pdfBytes = Buffer.from(await file.arrayBuffer());
    const base64Pdf = pdfBytes.toString("base64");

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: "gpt-5-nano",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename: file.name,
              file_data: `data:application/pdf;base64,${base64Pdf}`,
            },
            {
              type: "input_text",
              text: `
Analysiere dieses PDF auf Deutsch.
Antworte nur als gültiges JSON in diesem Format:
{
  "summary": "5 bis 8 Sätze",
  "takeaways": ["Punkt 1", "Punkt 2", "Punkt 3", "Punkt 4", "Punkt 5"],
  "open_questions": ["Frage 1", "Frage 2", "Frage 3"],
  "flashcards": [
    { "question": "Frage", "answer": "Antwort" }
  ]
}
Erstelle genau 5 Lernkarten.
              `.trim(),
            },
          ],
        },
      ],
    });

    const parsed = validateAnalysis(JSON.parse(cleanJson(response.output_text)));

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        subject_id: subjectId,
        file_name: file.name,
      })
      .select("id")
      .single();

    if (documentError || !document) {
      throw new Error(documentError?.message || "Document could not be saved.");
    }

    const { data: analysis, error: analysisError } = await supabase
      .from("analyses")
      .insert({
        document_id: document.id,
        user_id: user.id,
        summary: parsed.summary,
        takeaways: parsed.takeaways,
        open_questions: parsed.open_questions,
      })
      .select("id")
      .single();

    if (analysisError || !analysis) {
      throw new Error(analysisError?.message || "Analysis could not be saved.");
    }

    const cards = parsed.flashcards.map((card) => ({
      analysis_id: analysis.id,
      user_id: user.id,
      question: card.question,
      answer: card.answer,
    }));

    const { error: flashcardError } = await supabase.from("flashcards").insert(cards);

    if (flashcardError) {
      throw new Error(flashcardError.message);
    }

    await supabase.from("usage_events").insert({
      user_id: user.id,
      analysis_id: analysis.id,
      event_type: "pdf_analysis",
    });

    return NextResponse.json({
      analysis: {
        id: analysis.id,
        file_name: file.name,
        subject_id: selectedSubject?.id || null,
        subject_name: selectedSubject?.name || null,
        subject_color: selectedSubject?.color || null,
        created_at: new Date().toISOString(),
        ...parsed,
      },
      usage: {
        used: currentUsage + 1,
        limit: FREE_MONTHLY_LIMIT,
      },
    });
  } catch (error) {
    const friendlyError = getFriendlyError(error);
    return NextResponse.json({ error: friendlyError.message }, { status: friendlyError.status });
  }
}
