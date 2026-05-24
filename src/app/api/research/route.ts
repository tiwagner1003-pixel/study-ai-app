import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { cleanJson, toStringArray } from "@/lib/ai";
import { createAdminClient } from "@/lib/supabase";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const RESEARCH_MODES = ["earnings_call", "pdf_compare", "investment_memo", "dd_analysis", "kpi_extraction"];

type ResearchReport = {
  title: string;
  executive_summary: string;
  findings: string[];
  kpis: { metric: string; value: string; note: string }[];
  risks: string[];
  next_steps: string[];
};

function validateResearchReport(data: unknown): ResearchReport {
  const value = data as ResearchReport;

  if (
    !value ||
    typeof value.title !== "string" ||
    typeof value.executive_summary !== "string" ||
    !Array.isArray(value.findings) ||
    !Array.isArray(value.kpis) ||
    !Array.isArray(value.risks) ||
    !Array.isArray(value.next_steps)
  ) {
    throw new Error("OpenAI response had an unexpected format.");
  }

  return {
    title: value.title,
    executive_summary: value.executive_summary,
    findings: toStringArray(value.findings).slice(0, 8),
    kpis: value.kpis
      .filter((item) => item && typeof item.metric === "string")
      .map((item) => ({
        metric: item.metric,
        value: typeof item.value === "string" ? item.value : "",
        note: typeof item.note === "string" ? item.note : "",
      }))
      .slice(0, 10),
    risks: toStringArray(value.risks).slice(0, 8),
    next_steps: toStringArray(value.next_steps).slice(0, 8),
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
      .from("research_reports")
      .select("id, mode, title, executive_summary, findings, kpis, risks, next_steps, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ reports: data || [] });
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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Der OpenAI API-Key fehlt." }, { status: 500 });
    }

    const formData = await request.formData();
    const mode = String(formData.get("mode") || "investment_memo");
    const brief = String(formData.get("brief") || "").trim();
    const analysisIdValue = formData.get("analysis_id");
    const analysisId = typeof analysisIdValue === "string" && analysisIdValue ? analysisIdValue : null;
    const files = formData.getAll("pdfs").filter((item): item is File => item instanceof File);

    if (!RESEARCH_MODES.includes(mode)) {
      return NextResponse.json({ error: "Dieser Research-Modus wird noch nicht unterstützt." }, { status: 400 });
    }

    if (brief.length < 10 && files.length === 0 && !analysisId) {
      return NextResponse.json(
        { error: "Bitte gib einen kurzen Research-Auftrag ein oder füge Kontext hinzu." },
        { status: 400 },
      );
    }

    if (files.length > 2) {
      return NextResponse.json({ error: "Bitte lade maximal zwei PDFs hoch." }, { status: 400 });
    }

    for (const file of files) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        return NextResponse.json({ error: "Bitte lade nur PDF-Dateien hoch." }, { status: 400 });
      }

      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json({ error: "Ein PDF ist zu groß. Bitte lade maximal 10 MB pro Datei hoch." }, { status: 413 });
      }
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

    const content: OpenAI.Responses.ResponseInputContent[] = [];

    for (const file of files) {
      const pdfBytes = Buffer.from(await file.arrayBuffer());
      content.push({
        type: "input_file",
        filename: file.name,
        file_data: `data:application/pdf;base64,${pdfBytes.toString("base64")}`,
      });
    }

    content.push({
      type: "input_text",
      text: `
Du bist ein deutschsprachiger Finance- und Consulting-Research-Assistant.
Research-Modus: ${mode}
Auftrag:
${brief || "Nutze den bereitgestellten Dokumentkontext."}

Kontext aus Study-AI-Analyse:
${analysisContext || "Keine gespeicherte Analyse ausgewählt."}

Arbeite nüchtern, zahlennah und memo-tauglich. Kennzeichne Unsicherheiten klar.
Antworte nur als gültiges JSON:
{
  "title": "Kurzer Report-Titel",
  "executive_summary": "5 bis 8 Sätze",
  "findings": ["Befund 1", "Befund 2", "Befund 3"],
  "kpis": [
    { "metric": "Kennzahl", "value": "Wert oder n/a", "note": "Kurze Einordnung" }
  ],
  "risks": ["Risiko 1", "Risiko 2"],
  "next_steps": ["Nächster Schritt 1", "Nächster Schritt 2"]
}
      `.trim(),
    });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: "gpt-5-nano",
      input: [
        {
          role: "user",
          content,
        },
      ],
    });

    const parsed = validateResearchReport(JSON.parse(cleanJson(response.output_text)));

    const { data, error } = await supabase
      .from("research_reports")
      .insert({
        user_id: user.id,
        analysis_id: analysisId,
        mode,
        title: parsed.title,
        executive_summary: parsed.executive_summary,
        findings: parsed.findings,
        kpis: parsed.kpis,
        risks: parsed.risks,
        next_steps: parsed.next_steps,
      })
      .select("id, mode, title, executive_summary, findings, kpis, risks, next_steps, created_at")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Research-Report konnte nicht gespeichert werden.");
    }

    return NextResponse.json({ report: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
