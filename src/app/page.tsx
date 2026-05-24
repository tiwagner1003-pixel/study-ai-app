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
  subject_id?: string | null;
  subject_name?: string | null;
  subject_color?: string | null;
  summary: string;
  takeaways: string[];
  open_questions: string[];
  flashcards: Flashcard[];
};

type Subject = {
  id: string;
  name: string;
  color: string;
  created_at?: string;
};

type SavedAnalysisRow = {
  id: string;
  summary: string;
  takeaways: string[];
  open_questions: string[];
  created_at: string;
  documents:
    | {
        file_name: string;
        subject_id: string | null;
        subjects: { name: string; color: string } | { name: string; color: string }[] | null;
      }
    | {
        file_name: string;
        subject_id: string | null;
        subjects: { name: string; color: string } | { name: string; color: string }[] | null;
      }[]
    | null;
  flashcards: Flashcard[];
};

const FREE_MONTHLY_LIMIT = 3;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PDF_SIZE_LABEL = "10 MB";
const FEEDBACK_EMAIL = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL || "";

const FEEDBACK_OPTIONS = [
  { value: "yes", label: "Ja" },
  { value: "maybe", label: "Vielleicht" },
  { value: "no", label: "Nein" },
];

const SUBJECT_COLORS = ["#16796f", "#2f6fbb", "#7c5cc4", "#a15c07", "#b42318"];
const ALL_SUBJECTS = "all";

const DEMO_ANALYSIS: Analysis = {
  id: "demo-analysis",
  file_name: "Demo: Einführung in Marketing.pdf",
  subject_id: "demo-subject",
  subject_name: "Marketing",
  subject_color: "#16796f",
  created_at: new Date().toISOString(),
  summary:
    "Das Dokument erklärt die Grundlagen des Marketings und zeigt, wie Unternehmen Zielgruppen, Positionierung und Marketinginstrumente nutzen. Ein Schwerpunkt liegt auf dem Marketing-Mix mit Produkt, Preis, Distribution und Kommunikation. Zudem wird deutlich, dass Marketing nicht nur Werbung ist, sondern ein systematischer Prozess zur Schaffung von Kundennutzen. Erfolgreiches Marketing beginnt mit Marktanalyse und Segmentierung. Danach werden konkrete Strategien entwickelt, umgesetzt und kontrolliert.",
  takeaways: [
    "Marketing beginnt mit dem Verstehen von Kundenbedürfnissen.",
    "Segmentierung hilft, passende Zielgruppen klar zu definieren.",
    "Der Marketing-Mix besteht aus Produkt, Preis, Distribution und Kommunikation.",
    "Positionierung entscheidet, wie ein Angebot im Markt wahrgenommen wird.",
    "Kontrolle und Anpassung sind Teil eines professionellen Marketingprozesses.",
  ],
  open_questions: [
    "Wie unterscheidet sich Marketing in B2B- und B2C-Märkten?",
    "Welche Rolle spielen Daten bei moderner Marktsegmentierung?",
    "Wann ist eine Premium-Positionierung sinnvoll?",
  ],
  flashcards: [
    {
      question: "Was ist das Ziel von Marktsegmentierung?",
      answer: "Ein Gesamtmarkt wird in kleinere Gruppen mit ähnlichen Bedürfnissen eingeteilt.",
    },
    {
      question: "Welche vier Elemente gehören zum klassischen Marketing-Mix?",
      answer: "Produkt, Preis, Distribution und Kommunikation.",
    },
    {
      question: "Was bedeutet Positionierung?",
      answer: "Die gezielte Gestaltung der Wahrnehmung eines Angebots im Kopf der Zielgruppe.",
    },
    {
      question: "Warum ist Marketing mehr als Werbung?",
      answer: "Weil es Analyse, Strategie, Produktgestaltung, Preis, Vertrieb und Kommunikation umfasst.",
    },
    {
      question: "Warum ist Erfolgskontrolle im Marketing wichtig?",
      answer: "Sie zeigt, ob Maßnahmen wirken und wo die Strategie angepasst werden muss.",
    },
  ],
};

function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function getDocument(documents: SavedAnalysisRow["documents"]) {
  return Array.isArray(documents) ? documents[0] : documents;
}

function getSubject(subjects: NonNullable<ReturnType<typeof getDocument>>["subjects"]) {
  return Array.isArray(subjects) ? subjects[0] : subjects;
}

function countThisMonth(analyses: Analysis[]) {
  const monthStart = getMonthStart();
  return analyses.filter((item) => item.id !== DEMO_ANALYSIS.id && item.created_at && item.created_at >= monthStart)
    .length;
}

function getFeedbackHref() {
  const subject = encodeURIComponent("Feedback zu Study AI");
  if (!FEEDBACK_EMAIL) return `mailto:?subject=${subject}`;
  return `mailto:${FEEDBACK_EMAIL}?subject=${subject}`;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<Analysis[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(ALL_SUBJECTS);
  const [uploadSubjectId, setUploadSubjectId] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectColor, setNewSubjectColor] = useState(SUBJECT_COLORS[0]);
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [usedThisMonth, setUsedThisMonth] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [knownCards, setKnownCards] = useState(0);
  const [reviewCards, setReviewCards] = useState(0);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackWouldUse, setFeedbackWouldUse] = useState("maybe");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const remainingAnalyses = Math.max(FREE_MONTHLY_LIMIT - usedThisMonth, 0);
  const activeCard = analysis?.flashcards[currentCardIndex];
  const totalCards = analysis?.flashcards.length || 0;
  const answeredCards = knownCards + reviewCards;
  const visibleAnalyses =
    selectedSubjectId === ALL_SUBJECTS
      ? savedAnalyses
      : savedAnalyses.filter((item) => item.subject_id === selectedSubjectId);

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
      setSubjects([]);
      setUsedThisMonth(0);
      return;
    }

    loadSubjects();
    loadAnalyses();
  }, [session]);

  useEffect(() => {
    resetCardSession();
  }, [analysis?.id]);

  async function loadSubjects() {
    const { data, error } = await supabase
      .from("subjects")
      .select("id, name, color, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setSubjects(data || []);
    setUploadSubjectId((current) => current || data?.[0]?.id || "");
  }

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
        documents(file_name, subject_id, subjects(name, color)),
        flashcards(question, answer)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    const rows = (data || []) as SavedAnalysisRow[];
    const analyses = rows.map((row) => {
      const document = getDocument(row.documents);
      const subject = getSubject(document?.subjects || null);

      return {
        id: row.id,
        file_name: document?.file_name || "PDF",
        subject_id: document?.subject_id || null,
        subject_name: subject?.name || null,
        subject_color: subject?.color || null,
        created_at: row.created_at,
        summary: row.summary,
        takeaways: row.takeaways,
        open_questions: row.open_questions,
        flashcards: row.flashcards || [],
      };
    });

    setSavedAnalyses(analyses);
    setAnalysis((current) => {
      if (!current?.id) return analyses[0] || null;
      return analyses.find((item) => item.id === current.id) || analyses[0] || null;
    });

    const { count: usageCount, error: usageError } = await supabase
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", getMonthStart());

    setUsedThisMonth(usageError ? countThisMonth(analyses) : usageCount || 0);
  }

  async function signUp() {
    setMessage("");
    if (!email || !password) {
      setMessage("Bitte E-Mail und Passwort eintragen.");
      return;
    }

    if (password.length < 6) {
      setMessage("Das Passwort sollte mindestens 6 Zeichen haben.");
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });
    setMessage(error ? error.message : "Account erstellt. Falls Supabase eine Mail sendet, bestätige sie kurz.");
  }

  async function signIn() {
    setMessage("");
    if (!email || !password) {
      setMessage("Bitte E-Mail und Passwort eintragen.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setAnalysis(null);
    setSavedAnalyses([]);
    setSubjects([]);
    setSelectedSubjectId(ALL_SUBJECTS);
    setUploadSubjectId("");
    setUsedThisMonth(0);
  }

  async function createSubject() {
    if (!session) return;

    setMessage("");

    if (newSubjectName.trim().length < 2) {
      setMessage("Bitte gib einen Fachnamen ein.");
      return;
    }

    setCreatingSubject(true);

    const response = await fetch("/api/subjects", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newSubjectName,
        color: newSubjectColor,
      }),
    });

    const data = await response.json();
    setCreatingSubject(false);

    if (!response.ok) {
      setMessage(data.error || "Das Fach konnte nicht erstellt werden.");
      return;
    }

    setSubjects((current) => [...current, data.subject]);
    setUploadSubjectId(data.subject.id);
    setSelectedSubjectId(data.subject.id);
    setNewSubjectName("");
    setMessage("Fach erstellt.");
  }

  async function analyzePdf() {
    if (!file || !session) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setMessage("Bitte lade eine PDF-Datei hoch.");
      return;
    }

    if (file.size > MAX_PDF_BYTES) {
      setMessage(`Das PDF ist zu groß. Bitte lade maximal ${MAX_PDF_SIZE_LABEL} hoch.`);
      return;
    }

    setLoading(true);
    setMessage("");
    setAnalysis(null);

    const formData = new FormData();
    formData.append("pdf", file);
    if (uploadSubjectId) {
      formData.append("subject_id", uploadSubjectId);
    }

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
    setSelectedSubjectId(data.analysis.subject_id || ALL_SUBJECTS);
    setUsedThisMonth(data.usage?.used || usedThisMonth + 1);
  }

  function handleFileChange(nextFile: File | null) {
    setMessage("");
    setFile(null);

    if (!nextFile) return;

    if (nextFile.type !== "application/pdf" && !nextFile.name.toLowerCase().endsWith(".pdf")) {
      setMessage("Bitte lade eine PDF-Datei hoch.");
      return;
    }

    if (nextFile.size > MAX_PDF_BYTES) {
      setMessage(`Das PDF ist zu groß. Bitte lade maximal ${MAX_PDF_SIZE_LABEL} hoch.`);
      return;
    }

    setFile(nextFile);
  }

  function loadDemoAnalysis() {
    setMessage("Demo-Analyse geladen. Sie wird nicht gespeichert und zählt nicht ins Monatslimit.");
    setSavedAnalyses((current) => {
      const withoutDemo = current.filter((item) => item.id !== DEMO_ANALYSIS.id);
      return [DEMO_ANALYSIS, ...withoutDemo];
    });
    setSelectedSubjectId(ALL_SUBJECTS);
    setAnalysis(DEMO_ANALYSIS);
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

    if (id === DEMO_ANALYSIS.id) {
      setSavedAnalyses((current) => current.filter((item) => item.id !== DEMO_ANALYSIS.id));
      setAnalysis((selected) => (selected?.id === DEMO_ANALYSIS.id ? null : selected));
      setMessage("Demo-Analyse entfernt.");
      return;
    }

    const confirmed = window.confirm("Diese Analyse wirklich löschen?");
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
      setMessage(data.error || "Die Analyse konnte nicht gelöscht werden.");
      return;
    }

    setSavedAnalyses((current) => {
      const next = current.filter((item) => item.id !== id);
      setAnalysis((selected) => {
        if (selected?.id !== id) return selected;
        return next[0] || null;
      });
      return next;
    });
  }

  async function submitFeedback() {
    if (!session) return;

    setFeedbackStatus("");

    if (feedbackMessage.trim().length < 10) {
      setFeedbackStatus("Bitte schreibe mindestens 10 Zeichen Feedback.");
      return;
    }

    setSubmittingFeedback(true);

    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rating: feedbackRating,
        wouldUse: feedbackWouldUse,
        message: feedbackMessage,
      }),
    });

    const data = await response.json();
    setSubmittingFeedback(false);

    if (!response.ok) {
      setFeedbackStatus(data.error || "Feedback konnte nicht gespeichert werden.");
      return;
    }

    setFeedbackMessage("");
    setFeedbackStatus("Danke, dein Feedback wurde gespeichert.");
  }

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <div className="brand">
            <span className="brand-mark">S</span>
            Study AI
          </div>
          <p className="muted">PDFs in Zusammenfassungen, Fragen und Lernkarten verwandeln.</p>
        </div>
        <div className="topbar-actions">
          <a className="text-link" href={getFeedbackHref()}>
            Feedback geben
          </a>
          {session && <button onClick={signOut}>Ausloggen</button>}
        </div>
      </div>

      {!session ? (
        <section className="login-layout">
          <div className="login-copy">
            <p className="eyebrow">AI Study Platform</p>
            <h1>Aus PDFs wird ein persönlicher Lernraum.</h1>
            <p className="muted">
              Study AI verwandelt Skripte, Paper und Vorlesungsfolien in klare Zusammenfassungen,
              Takeaways, offene Fragen und Lernkarten.
            </p>
            <div className="feature-list">
              <span>PDFs verstehen</span>
              <span>Wissen strukturieren</span>
              <span>Lernkarten üben</span>
            </div>

            <div className="hero-product" aria-label="Produktvorschau">
              <div className="hero-product-top">
                <span>Study AI Workspace</span>
                <strong>Live-Vorschau</strong>
              </div>
              <div className="hero-product-grid">
                <div className="preview-upload">
                  <span className="preview-icon">PDF</span>
                  <div>
                    <strong>Investition_Skript.pdf</strong>
                    <p>Analyse bereit</p>
                  </div>
                </div>
                <div className="preview-score">
                  <span>5</span>
                  <p>Lernkarten</p>
                </div>
              </div>
              <div className="preview-content">
                <p>Zusammenfassung</p>
                <strong>Kapitalwert, Risiko und Zahlungsreihe werden zu einem klaren Lernpfad.</strong>
              </div>
              <div className="preview-columns">
                <div>
                  <span>Takeaway</span>
                  <p>Entscheidungen brauchen Vergleichbarkeit.</p>
                </div>
                <div>
                  <span>Frage</span>
                  <p>Wann ist der Kapitalwert positiv?</p>
                </div>
              </div>
            </div>
          </div>

          <div className="panel auth-panel stack">
            <div className="auth-heading">
              <p className="eyebrow">Dein Workspace</p>
              <h2>Einloggen</h2>
              <p className="muted">Erstelle einen Account oder logge dich ein.</p>
            </div>
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
                <button className="secondary-button" onClick={signUp}>
                  Registrieren
                </button>
              </div>
            </div>
            {message && <p className="notice">{message}</p>}
            <div className="auth-footnote">
              <span>3 freie Analysen pro Monat</span>
              <span>PDFs werden nicht dauerhaft gespeichert</span>
            </div>
          </div>
        </section>
      ) : (
        <div className="dashboard">
          <section className="workspace-hero">
            <div>
              <p className="eyebrow">AI Study Workspace</p>
              <h1>Lernen, sortieren und wiederholen an einem Ort.</h1>
              <p className="muted">
                Organisiere deine Fächer, analysiere Unterlagen und übe direkt mit Lernkarten.
              </p>
            </div>
            <div className="stats">
              <div className="stat">
                <span>Analysen</span>
                <strong>{savedAnalyses.length}</strong>
              </div>
              <div className="stat">
                <span>Fächer</span>
                <strong>{subjects.length}</strong>
              </div>
              <div className="stat">
                <span>Monat</span>
                <strong>
                  {usedThisMonth}/{FREE_MONTHLY_LIMIT}
                </strong>
              </div>
              <div className="stat">
                <span>Frei</span>
                <strong>{remainingAnalyses}</strong>
              </div>
            </div>
          </section>

          <div className="workspace-grid">
            <aside className="control-rail">
              <section className="panel stack">
                <div>
                  <h1>Neue PDF-Datei</h1>
                  <p className="muted">Lade ein Skript, Paper oder eine Vorlesungs-PDF hoch.</p>
                </div>
                <label className="field">
                  <span>Fach</span>
                  <select value={uploadSubjectId} onChange={(event) => setUploadSubjectId(event.target.value)}>
                    <option value="">Ohne Fach</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="upload-zone">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
                  />
                  <strong>{file ? file.name : "PDF auswählen"}</strong>
                  <span>Nur PDF-Dateien bis {MAX_PDF_SIZE_LABEL}</span>
                </label>
                <button disabled={!file || loading || remainingAnalyses === 0} onClick={analyzePdf}>
                  {loading ? "Analyse läuft..." : "PDF analysieren"}
                </button>
                <button className="secondary-button" onClick={loadDemoAnalysis} type="button">
                  Demo-Analyse laden
                </button>
                {remainingAnalyses === 0 && (
                  <p className="muted">Das kostenlose Monatslimit ist erreicht.</p>
                )}
                {message && <p className="notice">{message}</p>}
                <div className="privacy-note">
                  <strong>Datenschutz-Hinweis</strong>
                  <p>PDFs werden aktuell nicht dauerhaft gespeichert. Gespeichert werden nur Analyse-Ergebnisse.</p>
                </div>
              </section>

              <section className="panel subject-card">
                <div>
                  <h2>Fächer</h2>
                  <p className="muted">Organisiere deine Unterlagen nach Modulen.</p>
                </div>
                <div className="subject-list">
                  <button
                    className={`subject-filter ${selectedSubjectId === ALL_SUBJECTS ? "active" : ""}`}
                    onClick={() => setSelectedSubjectId(ALL_SUBJECTS)}
                    type="button"
                  >
                    Alle Fächer
                    <span>{savedAnalyses.length}</span>
                  </button>
                  {subjects.map((subject) => (
                    <button
                      className={`subject-filter ${selectedSubjectId === subject.id ? "active" : ""}`}
                      key={subject.id}
                      onClick={() => setSelectedSubjectId(subject.id)}
                      type="button"
                    >
                      <span className="subject-dot" style={{ backgroundColor: subject.color }} />
                      {subject.name}
                      <span>{savedAnalyses.filter((item) => item.subject_id === subject.id).length}</span>
                    </button>
                  ))}
                </div>

                <div className="create-subject">
                  <input
                    onChange={(event) => setNewSubjectName(event.target.value)}
                    placeholder="Neues Fach, z. B. Investition"
                    value={newSubjectName}
                  />
                  <div className="color-row">
                    {SUBJECT_COLORS.map((color) => (
                      <button
                        aria-label={`Farbe ${color}`}
                        className={`color-swatch ${newSubjectColor === color ? "active" : ""}`}
                        key={color}
                        onClick={() => setNewSubjectColor(color)}
                        style={{ backgroundColor: color }}
                        type="button"
                      />
                    ))}
                  </div>
                  <button disabled={creatingSubject} onClick={createSubject} type="button">
                    {creatingSubject ? "Erstellt..." : "Fach anlegen"}
                  </button>
                </div>
              </section>

            </aside>

            <div className="workspace-main">
              <section className="panel history">
                <div>
                  <h2>Bibliothek</h2>
                  <p className="muted">Deine gespeicherten Lernunterlagen.</p>
                </div>
                {visibleAnalyses.length === 0 ? (
                  <div className="empty-state">
                    <strong>Noch keine Dokumente</strong>
                    <p>Lade eine PDF-Datei hoch oder wechsle den Fachfilter.</p>
                  </div>
                ) : (
                  <div className="history-list">
                    {visibleAnalyses.map((item) => (
                      <button
                        className={`history-item ${analysis?.id === item.id ? "active" : ""}`}
                        key={item.id}
                        onClick={() => setAnalysis(item)}
                        type="button"
                      >
                        <span>{item.file_name}</span>
                        {item.subject_name && (
                          <small className="subject-badge">
                            <span style={{ backgroundColor: item.subject_color || SUBJECT_COLORS[0] }} />
                            {item.subject_name}
                          </small>
                        )}
                        <small>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString("de-DE") : ""}
                        </small>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="panel result detail-panel">
            {!analysis ? (
              <div className="empty-state large">
                <strong>Kein Dokument ausgewählt</strong>
                <p>Wähle links eine gespeicherte Analyse oder lade eine neue PDF-Datei hoch.</p>
              </div>
            ) : (
              <>
                <div className="detail-header">
                  <div>
                    <p className="eyebrow">{analysis.file_name || "Aktuelle Analyse"}</p>
                    {analysis.subject_name && (
                      <p className="subject-badge detail-badge">
                        <span style={{ backgroundColor: analysis.subject_color || SUBJECT_COLORS[0] }} />
                        {analysis.subject_name}
                      </p>
                    )}
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
                      {analysis.id === DEMO_ANALYSIS.id
                        ? "Demo entfernen"
                        : deletingId === analysis.id
                          ? "Löscht..."
                          : "Löschen"}
                    </button>
                  )}
                </div>

                <div className="content-section">
                  <h2>Zusammenfassung</h2>
                  <p>{analysis.summary}</p>
                </div>

                <div className="content-section">
                  <h2>Key Takeaways</h2>
                  <ul className="list">
                    {analysis.takeaways.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="content-section">
                  <h2>Offene Fragen</h2>
                  <ul className="list">
                    {analysis.open_questions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="content-section">
                  <h2>Lernkarten</h2>
                  {totalCards === 0 ? (
                    <div className="empty-state">
                      <strong>Keine Lernkarten vorhanden</strong>
                      <p>Diese Analyse enthält noch keine Lernkarten.</p>
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
                                  Nochmal üben
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

          <section className="panel feedback-card feedback-wide">
            <div>
              <h2>Feedback</h2>
              <p className="muted">Hilf mit, Study AI für Studierende nützlicher zu machen.</p>
            </div>

            <label className="field">
              <span>Bewertung</span>
              <select value={feedbackRating} onChange={(event) => setFeedbackRating(Number(event.target.value))}>
                <option value={5}>5 - Sehr hilfreich</option>
                <option value={4}>4 - Hilfreich</option>
                <option value={3}>3 - Okay</option>
                <option value={2}>2 - Noch schwach</option>
                <option value={1}>1 - Nicht hilfreich</option>
              </select>
            </label>

            <fieldset className="field">
              <legend>Würdest du Study AI nutzen?</legend>
              <div className="option-row">
                {FEEDBACK_OPTIONS.map((option) => (
                  <label key={option.value}>
                    <input
                      checked={feedbackWouldUse === option.value}
                      name="would-use"
                      onChange={() => setFeedbackWouldUse(option.value)}
                      type="radio"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="field">
              <span>Was fehlt oder stört?</span>
              <textarea
                maxLength={1200}
                onChange={(event) => setFeedbackMessage(event.target.value)}
                placeholder="Zum Beispiel: Lernkarten sind hilfreich, aber ich brauche Export nach Anki..."
                value={feedbackMessage}
              />
            </label>

            <button disabled={submittingFeedback} onClick={submitFeedback} type="button">
              {submittingFeedback ? "Speichert..." : "Feedback speichern"}
            </button>
            {feedbackStatus && <p className="notice">{feedbackStatus}</p>}
          </section>
        </div>
      )}
    </main>
  );
}
