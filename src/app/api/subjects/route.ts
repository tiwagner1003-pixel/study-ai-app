import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

const SUBJECT_COLORS = ["#16796f", "#2f6fbb", "#7c5cc4", "#a15c07", "#b42318"];

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
    const name = String(body.name || "").trim();
    const color = String(body.color || SUBJECT_COLORS[0]);

    if (name.length < 2) {
      return NextResponse.json({ error: "Bitte gib einen Fachnamen ein." }, { status: 400 });
    }

    if (name.length > 80) {
      return NextResponse.json({ error: "Der Fachname ist zu lang." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("subjects")
      .insert({
        user_id: user.id,
        name,
        color: SUBJECT_COLORS.includes(color) ? color : SUBJECT_COLORS[0],
      })
      .select("id, name, color, created_at")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ subject: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
