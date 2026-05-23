import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

const MAX_TEXT_LENGTH = 1200;

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
    const rating = Number(body.rating);
    const wouldUse = String(body.wouldUse || "");
    const message = String(body.message || "").trim();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Bitte wähle eine Bewertung von 1 bis 5." }, { status: 400 });
    }

    if (!["yes", "maybe", "no"].includes(wouldUse)) {
      return NextResponse.json({ error: "Bitte wähle aus, ob du Study AI nutzen würdest." }, { status: 400 });
    }

    if (message.length < 10) {
      return NextResponse.json({ error: "Bitte schreibe mindestens 10 Zeichen Feedback." }, { status: 400 });
    }

    if (message.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: "Das Feedback ist zu lang." }, { status: 400 });
    }

    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      rating,
      would_use: wouldUse,
      message,
    });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
