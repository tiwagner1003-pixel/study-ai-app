"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Flashcard = {
  question: string;
  answer: string;
};

type Analysis = {
  id?: string;
  file_name?: string;
  created_at?: string;
  summary: string;
  takeaways: string[];
  open_questions: string[];
  flashcards: Flashcard[];
};

type SavedAnalysisRow = {
  id: string;
  summary: string;
  takeaways: string[];
  open_questions: string[];
  created_at: string;
  documents: { file_name: string } | { file_name: string }[] | null;
  flashcards: Flashcard[];
};

const FREE_MONTHLY_LIMIT = 3;

function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function getFileName(documents: SavedAnalysisRow["documents"]) {
  if (Array.isArray(documents)) return documents[0]?.file_name || "PDF";
  return documents?.file_name || "PDF";
}

function countThisMonth(analyses: Analysis[]) {
  const monthStart = getMonthStart();
  return analyses.filter((item) => item.created_at && item.created_at >= monthStart).length;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<Analysis[]>([]);
  const [usedThisMonth, setUsedThisMonth] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [knownCards, setKnownCards] = useState(0);
  const [reviewCards, setReviewCards] = useState(0);

  const remainingAnalyses = Math.max(FREE_MONTHLY_LIMIT - usedThisMonth, 0);
  const activeCard = analysis?.flashcards[currentCardIndex];
  const totalCards = analysis?.flashcards.length || 0;
  const answeredCards = knownCards + reviewCards;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setSavedAnalyses([]);
      setUsedThisMonth(0);
      return;
    }

    loadAnalyses();
  }, [session]);

  useEffect(() => {
    resetCardSession();
  }, [analysis?.id]);

  async function loadAnalyses() {
    const { data, error } = await supabase
      .from("analyses")
      .select(
        `
        id,
        summary,
        takeaways,
        open_questions,
        created_at,
        documents(file_name),
        flashcards(question, answer)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    const rows = (data || []) as SavedAnalysisRow[];
    const analyses = rows.map((row) => ({
      id: row.id,
      file_name: getFileName(row.documents),
      created_at: row.created_at,
      summary: row.summary,
      takeaways: row.takeaways,
      open_questions: row.open_questions,
      flashcards: row.flashcards || [],
    }));

    setSavedAnalyses(analyses);
    setAnalysis((current) => {
      if (!current?.id) return analyses[0] || null;
      return analyses.find((item) => item.id === current.id) || analyses[0] || null;
    });
    setUsedThisMonth(countThisMonth(analyses));
  }

  async function signUp() {
    setMessage("");
    const { error } = await supabase.auth.signUp({ email, password });
    setMessage(error ? error.message : "Account erstellt. Du kannst dich jetzt einloggen.");
  }

  async function signIn() {
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setAnalysis(null);
    setSavedAnalyses([]);
    setUsedThisMonth(0);
  }

  async function analyzePdf() {
    if (!file || !session) return;

    setLoading(true);
    setMessage("");
    setAnalysis(null);

    const formData = new FormData();
    formData.append("pdf", file);

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(data.error || "Die Analyse ist fehlgeschlagen.");
      return;
    }

    setAnalysis(data.analysis);
    setSavedAnalyses((current) => [data.analysis, ...current]);
    setUsedThisMonth(data.usage?.used || usedThisMonth + 1);
  }

  function resetCardSession() {
    setCurrentCardIndex(0);
    setIsAnswerVisible(false);
    setKnownCards(0);
    setReviewCards(0);
  }

  function answerCard(result: "known" | "review") {
    if (!analysis || totalCards === 0) return;

    if (result === "known") {
      setKnownCards((current) => current + 1);
    } else {
      setReviewCards((current) => current + 1);
    }

    setIsAnswerVisible(false);
    setCurrentCardIndex((current) => Math.min(current + 1, totalCards));
  }

  async function deleteAnalysis(id: string) {
    if (!session) return;

    const confirmed = window.confirm("Diese Analyse wirklich loeschen?");
    if (!confirmed) return;

    setDeletingId(id);
    setMessage("");

    const response = await fetch(`/api/analyses/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = await response.json();
    setDeletingId(null);

    if (!response.ok) {
      setMessage(data.error || "Die Analyse konnte nicht geloescht werden.");
      return;
    }

    setSavedAnalyses((current) => {
      const next = current.filter((item) => item.id !== id);
      setUsedThisMonth(countThisMonth(next));
      setAnalysis((selected) => {
        if (selected?.id !== id) return selected;
        return next[0] || null;
      });
      return next;
    });
  }

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <div className="brand">Study AI</div>
          <p className="muted">PDFs in Zusammenfassungen, Fragen und Lernkarten verwandeln.</p>
        </div>
        {session && <button onClick={signOut}>Ausloggen</button>}
      </div>

      {!session ? (
        <section className="panel stack">
          <h1>Einloggen</h1>
          <p className="muted">Erstelle einen Account oder logge dich ein.</p>
          <div className="stack">
            <input
              type="email"
              placeholder="E-Mail"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              type="password"
              placeholder="Passwort"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="actions">
              <button onClick={signIn}>Einloggen</button>
              <button onClick={signUp}>Registrieren</button>
            </div>
          </div>
          {message && <p className="error">{message}</p>}
        </section>
      ) : (
        <div className="dashboard">
          <section className="stats">
            <div className="stat">
              <span>Gespeicherte Analysen</span>
              <strong>{savedAnalyses.length}</strong>
            </div>
            <div className="stat">
              <span>Diesen Monat genutzt</span>
              <strong>
                {usedThisMonth}/{FREE_MONTHLY_LIMIT}
              </strong>
            </div>
            <div className="stat">
              <span>Verbleibend</span>
              <strong>{remainingAnalyses}</strong>
            </div>
          </section>

          <div className="dashboard-grid">
            <aside className="sidebar">
              <section className="panel stack">
                <div>
                  <h1>Neues PDF</h1>
                  <p className="muted">Lade ein Skript, Paper oder Vorlesungs-PDF hoch.</p>
                </div>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
                <button disabled={!file || loading || remainingAnalyses === 0} onClick={analyzePdf}>
                  {loading ? "Analyse laeuft..." : "PDF analysieren"}
                </button>
                {remainingAnalyses === 0 && (
                  <p className="muted">Das kostenlose Monatslimit ist erreicht.</p>
                )}
                {message && <p className="error">{message}</p>}
              </section>

              <section className="panel history">
                <div>
                  <h2>Dokumente</h2>
                  <p className="muted">Deine gespeicherten Lernunterlagen.</p>
                </div>
                {savedAnalyses.length === 0 ? (
                  <div className="empty-state">
                    <strong>Noch keine Dokumente</strong>
                    <p>Lade dein erstes PDF hoch, sobald OpenAI-Guthaben aktiv ist.</p>
                  </div>
                ) : (
                  <div className="history-list">
                    {savedAnalyses.map((item) => (
                      <button
                        className={`history-item ${analysis?.id === item.id ? "active" : ""}`}
                        key={item.id}
                        onClick={() => setAnalysis(item)}
                        type="button"
                      >
                        <span>{item.file_name}</span>
                        <small>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString("de-DE") : ""}
                        </small>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </aside>

            <section className="panel result">
            {!analysis ? (
              <div className="empty-state large">
                <strong>Kein Dokument ausgewaehlt</strong>
                <p>Waehle links eine gespeicherte Analyse oder lade ein neues PDF hoch.</p>
              </div>
            ) : (
              <>
                <div className="detail-header">
                  <div>
                    <p className="eyebrow">{analysis.file_name || "Aktuelle Analyse"}</p>
                    {analysis.created_at && (
                      <p className="muted">
                        Erstellt am {new Date(analysis.created_at).toLocaleDateString("de-DE")}
                      </p>
                    )}
                  </div>
                  {analysis.id && (
                    <button
                      className="danger-button"
                      disabled={deletingId === analysis.id}
                      onClick={() => deleteAnalysis(analysis.id as string)}
                      type="button"
                    >
                      {deletingId === analysis.id ? "Loescht..." : "Loeschen"}
                    </button>
                  )}
                </div>

                <div>
                  <h2>Zusammenfassung</h2>
                  <p>{analysis.summary}</p>
                </div>

                <div>
                  <h2>Key Takeaways</h2>
                  <ul className="list">
                    {analysis.takeaways.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h2>Offene Fragen</h2>
                  <ul className="list">
                    {analysis.open_questions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h2>Lernkarten</h2>
                  {totalCards === 0 ? (
                    <div className="empty-state">
                      <strong>Keine Lernkarten vorhanden</strong>
                      <p>Diese Analyse enthaelt noch keine Lernkarten.</p>
                    </div>
                  ) : (
                    <div className="study-mode">
                      <div className="study-progress">
                        <span>
                          Karte {Math.min(currentCardIndex + 1, totalCards)} von {totalCards}
                        </span>
                        <span>
                          Gewusst: {knownCards} | Nochmal: {reviewCards}
                        </span>
                      </div>

                      <div className="progress-bar" aria-hidden="true">
                        <div
                          style={{
                            width: `${Math.round((answeredCards / totalCards) * 100)}%`,
                          }}
                        />
                      </div>

                      {currentCardIndex >= totalCards ? (
                        <div className="flashcard complete">
                          <strong>Lernrunde abgeschlossen</strong>
                          <p>
                            Du hast {knownCards} Karten gewusst und {reviewCards} Karten zum Wiederholen markiert.
                          </p>
                          <button onClick={resetCardSession} type="button">
                            Noch einmal lernen
                          </button>
                        </div>
                      ) : (
                        <div className="flashcard study-card">
                          <span className="card-label">Frage</span>
                          <strong>{activeCard?.question}</strong>

                          {isAnswerVisible ? (
                            <div className="answer">
                              <span className="card-label">Antwort</span>
                              <p>{activeCard?.answer}</p>
                              <div className="actions">
                                <button onClick={() => answerCard("known")} type="button">
                                  Gewusst
                                </button>
                                <button className="secondary-button" onClick={() => answerCard("review")} type="button">
                                  Nochmal ueben
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setIsAnswerVisible(true)} type="button">
                              Antwort anzeigen
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
