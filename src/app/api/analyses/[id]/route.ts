import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
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

    const { data: analysis, error: analysisError } = await supabase
      .from("analyses")
      .select("document_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (analysisError || !analysis) {
      return NextResponse.json({ error: "Analyse wurde nicht gefunden." }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", analysis.document_id)
      .eq("user_id", user.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
