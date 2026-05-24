import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { toStringArray } from "@/lib/ai";

const ITEM_TYPES = ["topic", "note", "project", "connection"];
const MAX_CONTENT_LENGTH = 5000;

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
      .from("knowledge_items")
      .select("id, item_type, title, content, tags, related_titles, created_at, subjects(name, color)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ items: data || [] });
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
    const itemType = String(body.itemType || "note");
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const subjectId = body.subjectId ? String(body.subjectId) : null;
    const analysisId = body.analysisId ? String(body.analysisId) : null;
    const tags = toStringArray(body.tags);
    const relatedTitles = toStringArray(body.relatedTitles);

    if (!ITEM_TYPES.includes(itemType)) {
      return NextResponse.json({ error: "Dieser Wissens-Typ wird nicht unterstützt." }, { status: 400 });
    }

    if (title.length < 2) {
      return NextResponse.json({ error: "Bitte gib einen Titel ein." }, { status: 400 });
    }

    if (content.length < 10) {
      return NextResponse.json({ error: "Bitte ergänze mindestens 10 Zeichen Inhalt." }, { status: 400 });
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ error: "Der Wissenseintrag ist zu lang." }, { status: 400 });
    }

    if (subjectId) {
      const { data: subject, error: subjectError } = await supabase
        .from("subjects")
        .select("id")
        .eq("id", subjectId)
        .eq("user_id", user.id)
        .single();

      if (subjectError || !subject) {
        return NextResponse.json({ error: "Das ausgewählte Fach wurde nicht gefunden." }, { status: 404 });
      }
    }

    if (analysisId) {
      const { data: analysis, error: analysisError } = await supabase
        .from("analyses")
        .select("id")
        .eq("id", analysisId)
        .eq("user_id", user.id)
        .single();

      if (analysisError || !analysis) {
        return NextResponse.json({ error: "Die Analyse wurde nicht gefunden." }, { status: 404 });
      }
    }

    const { data, error } = await supabase
      .from("knowledge_items")
      .insert({
        user_id: user.id,
        subject_id: subjectId,
        analysis_id: analysisId,
        item_type: itemType,
        title,
        content,
        tags,
        related_titles: relatedTitles,
      })
      .select("id, item_type, title, content, tags, related_titles, created_at, subjects(name, color)")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Wissenseintrag konnte nicht gespeichert werden.");
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
