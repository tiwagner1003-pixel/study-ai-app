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

type KnowledgeItem = {
  id: string;
  item_type: string;
  title: string;
  content: string;
  tags: string[];
  related_titles: string[];
  created_at: string;
  subjects?: { name: string; color: string } | { name: string; color: string }[] | null;
};

type AgentRun = {
  id: string;
  task_type: string;
  input: string;
  output: string;
  next_actions: string[];
  created_at: string;
};

type ResearchReport = {
  id: string;
  mode: string;
  title: string;
  executive_summary: string;
  findings: string[];
  kpis: { metric: string; value: string; note: string }[];
  risks: string[];
  next_steps: string[];
  created_at: string;
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

const KNOWLEDGE_TYPES = [
  { value: "topic", label: "Thema" },
  { value: "note", label: "Notiz" },
  { value: "project", label: "Projekt" },
  { value: "connection", label: "Zusammenhang" },
];

const WORKFLOW_TYPES = [
  { value: "seminararbeit", label: "Seminararbeit" },
  { value: "literatur", label: "Literatur" },
  { value: "bewerbung", label: "Bewerbung" },
  { value: "email", label: "E-Mail" },
  { value: "meeting", label: "Meeting Notes" },
  { value: "priorisierung", label: "Priorisierung" },
];

const RESEARCH_MODES = [
  { value: "investment_memo", label: "Investment Memo" },
  { value: "earnings_call", label: "Earnings Call" },
  { value: "pdf_compare", label: "PDFs vergleichen" },
  { value: "dd_analysis", label: "DD-Analyse" },
  { value: "kpi_extraction", label: "KPI Extraction" },
];

const WORKSPACE_SECTIONS = [
  { href: "#lernen", label: "Lernen" },
  { href: "#bibliothek", label: "Bibliothek" },
  { href: "#wissen", label: "Wissen" },
  { href: "#agent", label: "Agent" },
  { href: "#research", label: "Research" },
  { href: "#feedback", label: "Feedback" },
];

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

function getKnowledgeSubject(subjects: KnowledgeItem["subjects"]) {
  return Array.isArray(subjects) ? subjects[0] : subjects;
}

function splitCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTypeLabel(options: { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label || value;
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
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [researchReports, setResearchReports] = useState<ResearchReport[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(ALL_SUBJECTS);
  const [uploadSubjectId, setUploadSubjectId] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectColor, setNewSubjectColor] = useState(SUBJECT_COLORS[0]);
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [knowledgeType, setKnowledgeType] = useState("note");
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeContent, setKnowledgeContent] = useState("");
  const [knowledgeTags, setKnowledgeTags] = useState("");
  const [knowledgeRelated, setKnowledgeRelated] = useState("");
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [workflowType, setWorkflowType] = useState("seminararbeit");
  const [workflowInput, setWorkflowInput] = useState("");
  const [runningWorkflow, setRunningWorkflow] = useState(false);
  const [researchMode, setResearchMode] = useState("investment_memo");
  const [researchBrief, setResearchBrief] = useState("");
  const [researchFiles, setResearchFiles] = useState<File[]>([]);
  const [runningResearch, setRunningResearch] = useState(false);
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
  const selectedSubjectName =
    selectedSubjectId === ALL_SUBJECTS
      ? "Alle Fächer"
      : subjects.find((subject) => subject.id === selectedSubjectId)?.name || "Ausgewähltes Fach";
  const latestAgentRun = agentRuns[0];
  const latestResearchReport = researchReports[0];
  const currentLearningFocus = analysis
    ? analysis.file_name || "Ausgewähltes Dokument"
    : savedAnalyses[0]?.file_name || "Noch kein Dokument";
  const nextStudyActions = analysis
    ? [
        `${analysis.takeaways.length} Kernpunkte wiederholen`,
        `${totalCards} Lernkarten aktiv abfragen`,
        `${analysis.open_questions.length} offene Fragen klären`,
        "Analyse ins Wissenssystem übernehmen",
      ]
    : [
        "Erste PDF hochladen",
        "Fach oder Modul anlegen",
        "Demo-Analyse testen",
        "Feedback nach dem ersten Durchlauf notieren",
      ];

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
      setKnowledgeItems([]);
      setAgentRuns([]);
      setResearchReports([]);
      setUsedThisMonth(0);
      return;
    }

    loadSubjects();
    loadAnalyses();
    loadKnowledgeItems();
    loadAgentRuns();
    loadResearchReports();
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

  async function loadKnowledgeItems() {
    if (!session) return;

    const response = await fetch("/api/knowledge", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Wissenssystem konnte nicht geladen werden.");
      return;
    }

    setKnowledgeItems(data.items || []);
  }

  async function loadAgentRuns() {
    if (!session) return;

    const response = await fetch("/api/workflows", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Agent-Verlauf konnte nicht geladen werden.");
      return;
    }

    setAgentRuns(data.runs || []);
  }

  async function loadResearchReports() {
    if (!session) return;

    const response = await fetch("/api/research", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Research-Verlauf konnte nicht geladen werden.");
      return;
    }

    setResearchReports(data.reports || []);
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
    setKnowledgeItems([]);
    setAgentRuns([]);
    setResearchReports([]);
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

  async function saveKnowledgeItem(source?: "analysis") {
    if (!session) return;

    const title =
      source === "analysis" && analysis
        ? analysis.file_name || "Analyse"
        : knowledgeTitle.trim();
    const content =
      source === "analysis" && analysis
        ? [
            analysis.summary,
            "Key Takeaways:",
            ...analysis.takeaways.map((item) => `- ${item}`),
            "Offene Fragen:",
            ...analysis.open_questions.map((item) => `- ${item}`),
          ].join("\n")
        : knowledgeContent.trim();

    setMessage("");

    if (title.length < 2 || content.length < 10) {
      setMessage("Bitte ergänze Titel und Inhalt für den Wissenseintrag.");
      return;
    }

    setSavingKnowledge(true);

    const response = await fetch("/api/knowledge", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        itemType: source === "analysis" ? "topic" : knowledgeType,
        title,
        content,
        subjectId: source === "analysis" ? analysis?.subject_id : selectedSubjectId === ALL_SUBJECTS ? null : selectedSubjectId,
        analysisId: source === "analysis" && analysis?.id !== DEMO_ANALYSIS.id ? analysis?.id : null,
        tags: source === "analysis" ? ["analyse"] : splitCommaList(knowledgeTags),
        relatedTitles: splitCommaList(knowledgeRelated),
      }),
    });

    const data = await response.json();
    setSavingKnowledge(false);

    if (!response.ok) {
      setMessage(data.error || "Wissenseintrag konnte nicht gespeichert werden.");
      return;
    }

    setKnowledgeItems((current) => [data.item, ...current]);
    if (source !== "analysis") {
      setKnowledgeTitle("");
      setKnowledgeContent("");
      setKnowledgeTags("");
      setKnowledgeRelated("");
    }
    setMessage("Wissenseintrag gespeichert.");
  }

  async function runWorkflowAgent() {
    if (!session) return;

    setMessage("");

    if (workflowInput.trim().length < 10) {
      setMessage("Bitte beschreibe kurz, was der Agent tun soll.");
      return;
    }

    setRunningWorkflow(true);

    const response = await fetch("/api/workflows", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskType: workflowType,
        input: workflowInput,
        analysisId: analysis?.id && analysis.id !== DEMO_ANALYSIS.id ? analysis.id : null,
      }),
    });

    const data = await response.json();
    setRunningWorkflow(false);

    if (!response.ok) {
      setMessage(data.error || "Workflow-Agent konnte nicht gestartet werden.");
      return;
    }

    setAgentRuns((current) => [data.run, ...current]);
    setWorkflowInput("");
  }

  function handleResearchFileChange(files: FileList | null) {
    setMessage("");
    const nextFiles = Array.from(files || []).slice(0, 2);

    for (const nextFile of nextFiles) {
      if (nextFile.type !== "application/pdf" && !nextFile.name.toLowerCase().endsWith(".pdf")) {
        setMessage("Bitte lade nur PDF-Dateien hoch.");
        return;
      }

      if (nextFile.size > MAX_PDF_BYTES) {
        setMessage(`Ein PDF ist zu groß. Bitte lade maximal ${MAX_PDF_SIZE_LABEL} pro Datei hoch.`);
        return;
      }
    }

    setResearchFiles(nextFiles);
  }

  async function runResearchAssistant() {
    if (!session) return;

    setMessage("");

    if (researchBrief.trim().length < 10 && researchFiles.length === 0 && !analysis) {
      setMessage("Bitte gib einen Research-Auftrag ein oder füge Kontext hinzu.");
      return;
    }

    setRunningResearch(true);

    const formData = new FormData();
    formData.append("mode", researchMode);
    formData.append("brief", researchBrief);
    if (analysis?.id && analysis.id !== DEMO_ANALYSIS.id) {
      formData.append("analysis_id", analysis.id);
    }
    researchFiles.forEach((researchFile) => formData.append("pdfs", researchFile));

    const response = await fetch("/api/research", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    const data = await response.json();
    setRunningResearch(false);

    if (!response.ok) {
      setMessage(data.error || "Research Assistant konnte keinen Report erstellen.");
      return;
    }

    setResearchReports((current) => [data.report, ...current]);
    setResearchBrief("");
    setResearchFiles([]);
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
        <div className="landing-page">
          <section className="login-layout landing-hero">
            <div className="login-copy">
              <p className="eyebrow">AI Study Platform</p>
              <h1>Mach aus chaotischen PDFs einen klaren Lernplan.</h1>
              <p className="muted">
                Vor der Prüfung liegen Skripte, Paper und Folien oft ungeordnet herum. Study AI
                verwandelt sie in Zusammenfassungen, Takeaways, offene Fragen und Lernkarten.
              </p>

              <div className="hero-actions">
                <a className="button-link" href="#konto">
                  Kostenlos starten
                </a>
                <a className="text-link" href="#ablauf">
                  So funktioniert es
                </a>
              </div>

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

            <div className="panel auth-panel stack" id="konto">
              <div className="auth-heading">
                <p className="eyebrow">Dein Workspace</p>
                <h2>Account erstellen</h2>
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
                  <button onClick={signUp}>Registrieren</button>
                  <button className="secondary-button" onClick={signIn}>
                    Einloggen
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

          <section className="story-section">
            <div className="story-copy">
              <p className="eyebrow">Warum Study AI?</p>
              <h2>Das Problem ist nicht das Lernen. Es ist der Start.</h2>
              <p className="muted">
                Viele Studierende verlieren Zeit damit, Unterlagen zu sortieren, Wichtiges zu erkennen
                und daraus gute Wiederholungsfragen zu bauen. Study AI nimmt dir diesen ersten schweren
                Schritt ab, damit du schneller ins aktive Lernen kommst.
              </p>
            </div>
            <div className="story-grid">
              <article>
                <span>01</span>
                <h3>Unterlagen sammeln</h3>
                <p>Skripte, Paper und Folien landen an einem Ort und werden nach Fächern geordnet.</p>
              </article>
              <article>
                <span>02</span>
                <h3>Inhalte verstehen</h3>
                <p>Aus langen PDFs entstehen kurze Zusammenfassungen, Takeaways und offene Fragen.</p>
              </article>
              <article>
                <span>03</span>
                <h3>Gezielt wiederholen</h3>
                <p>Lernkarten helfen dir, Wissen aktiv abzufragen statt nur passiv zu lesen.</p>
              </article>
            </div>
          </section>

          <section className="flow-section" id="ablauf">
            <div>
              <p className="eyebrow">Der Ablauf</p>
              <h2>Von der PDF zur Lernroutine in wenigen Minuten.</h2>
            </div>
            <div className="flow-steps">
              <div>
                <strong>Hochladen</strong>
                <p>Du wählst eine PDF aus und ordnest sie optional einem Fach zu.</p>
              </div>
              <div>
                <strong>Analysieren</strong>
                <p>Study AI erzeugt Zusammenfassung, Takeaways, offene Fragen und Lernkarten.</p>
              </div>
              <div>
                <strong>Wiederholen</strong>
                <p>Du speicherst die Analyse und lernst später direkt in deinem Workspace weiter.</p>
              </div>
            </div>
          </section>

          <section className="promise-section">
            <div>
              <p className="eyebrow">Was dein Account bringt</p>
              <h2>Ein Workspace, der mit deinem Semester wächst.</h2>
            </div>
            <div className="promise-list">
              <p>Speichere deine Analysen dauerhaft als Bibliothek.</p>
              <p>Sortiere Inhalte nach Fächern und Modulen.</p>
              <p>Greife wieder auf Lernkarten, Fragen und Zusammenfassungen zu.</p>
              <p>Teste die ersten Analysen kostenlos und gib Feedback für die nächsten Features.</p>
            </div>
          </section>

          <section className="final-cta">
            <p className="eyebrow">Bereit für den ersten Lernpfad?</p>
            <h2>Starte mit einer PDF, die du sowieso lernen musst.</h2>
            <a className="button-link" href="#konto">
              Account erstellen
            </a>
          </section>
        </div>
      ) : (
        <div className="dashboard">
          <section className="workspace-hero">
            <div>
              <p className="eyebrow">AI Study Workspace</p>
              <h1>Dein Lerncockpit für Unterlagen, Wissen und Projekte.</h1>
              <p className="muted">
                Starte mit einer PDF, arbeite aktiv mit Lernkarten und verwandle gute Notizen in ein wachsendes Wissenssystem.
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

          <nav className="workspace-nav" aria-label="Workspace Bereiche">
            {WORKSPACE_SECTIONS.map((section) => (
              <a href={section.href} key={section.href}>
                {section.label}
              </a>
            ))}
          </nav>

          <section className="study-cockpit">
            <article className="cockpit-card primary">
              <span>Aktueller Fokus</span>
              <strong>{currentLearningFocus}</strong>
              <p>{analysis ? `${selectedSubjectName} | ${totalCards} Lernkarten bereit` : "Lade ein Dokument hoch oder öffne die Demo."}</p>
            </article>
            <article className="cockpit-card">
              <span>Heute sinnvoll</span>
              <ul>
                {nextStudyActions.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article className="cockpit-card">
              <span>Workspace</span>
              <div className="cockpit-metrics">
                <div>
                  <strong>{knowledgeItems.length}</strong>
                  <small>Wissenseinträge</small>
                </div>
                <div>
                  <strong>{agentRuns.length}</strong>
                  <small>Agent-Läufe</small>
                </div>
                <div>
                  <strong>{researchReports.length}</strong>
                  <small>Reports</small>
                </div>
              </div>
            </article>
            <article className="cockpit-card">
              <span>Letzter Output</span>
              <p>
                {latestAgentRun
                  ? latestAgentRun.next_actions[0] || "Letztes Agent-Ergebnis prüfen."
                  : latestResearchReport
                    ? latestResearchReport.title
                    : "Nutze Agent oder Research für Gliederungen, Memos und Aufgabenlisten."}
              </p>
            </article>
          </section>

          <div className="workspace-grid">
            <aside className="control-rail">
              <section className="panel stack workspace-section" id="lernen">
                <div>
                  <p className="section-label">Lernstart</p>
                  <h1>Neue Unterlage analysieren</h1>
                  <p className="muted">Skripte, Paper, Folien oder Geschäftsberichte werden zu Lernmaterial.</p>
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

              <section className="panel subject-card workspace-section">
                <div>
                  <p className="section-label">Module</p>
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

              <section className="panel knowledge-card workspace-section" id="wissen">
                <div>
                  <p className="section-label">Second Brain</p>
                  <h2>Wissenssystem</h2>
                  <p className="muted">Speichere Themen, Notizen, Projekte und Zusammenhänge als wiederverwendbare Bausteine.</p>
                </div>

                <label className="field">
                  <span>Typ</span>
                  <select value={knowledgeType} onChange={(event) => setKnowledgeType(event.target.value)}>
                    {KNOWLEDGE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>

                <input
                  onChange={(event) => setKnowledgeTitle(event.target.value)}
                  placeholder="Titel, z. B. DCF Valuation"
                  value={knowledgeTitle}
                />
                <textarea
                  onChange={(event) => setKnowledgeContent(event.target.value)}
                  placeholder="Notiz, Projektidee oder Zusammenhang..."
                  value={knowledgeContent}
                />
                <input
                  onChange={(event) => setKnowledgeTags(event.target.value)}
                  placeholder="Tags, kommasepariert"
                  value={knowledgeTags}
                />
                <input
                  onChange={(event) => setKnowledgeRelated(event.target.value)}
                  placeholder="Verbindungen, z. B. Corporate Finance"
                  value={knowledgeRelated}
                />
                <div className="actions split-actions">
                  <button disabled={savingKnowledge} onClick={() => saveKnowledgeItem()} type="button">
                    {savingKnowledge ? "Speichert..." : "Speichern"}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={!analysis || savingKnowledge}
                    onClick={() => saveKnowledgeItem("analysis")}
                    type="button"
                  >
                    Analyse merken
                  </button>
                </div>

                <div className="knowledge-list">
                  {knowledgeItems.length === 0 ? (
                    <p className="muted">Noch keine Einträge gespeichert.</p>
                  ) : (
                    knowledgeItems.slice(0, 7).map((item) => {
                      const subject = getKnowledgeSubject(item.subjects || null);

                      return (
                        <article key={item.id}>
                          <span>{getTypeLabel(KNOWLEDGE_TYPES, item.item_type)}</span>
                          <strong>{item.title}</strong>
                          <p>{item.content}</p>
                          {item.tags.length > 0 && (
                            <small>{item.tags.slice(0, 3).join(" | ")}</small>
                          )}
                          {subject && (
                            <small className="subject-badge">
                              <span style={{ backgroundColor: subject.color }} />
                              {subject.name}
                            </small>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </section>

            </aside>

            <div className="workspace-main">
              <section className="panel history workspace-section" id="bibliothek">
                <div>
                  <p className="section-label">Archiv</p>
                  <h2>Bibliothek</h2>
                  <p className="muted">{selectedSubjectName}: gespeicherte Analysen und Lernunterlagen.</p>
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

              <section className="panel result detail-panel workspace-section">
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

              <section className="panel phase-panel workspace-section" id="agent">
                <div className="phase-header">
                  <div>
                    <p className="section-label">Produktiv arbeiten</p>
                    <h2>Workflow-Agent</h2>
                    <p className="muted">
                      Nutzt dein ausgewähltes Dokument und dein Wissenssystem als Arbeitskontext.
                    </p>
                  </div>
                </div>

                <div className="agent-grid">
                  <div className="agent-form">
                    <label className="field">
                      <span>Aufgabe</span>
                      <select value={workflowType} onChange={(event) => setWorkflowType(event.target.value)}>
                        {WORKFLOW_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Briefing</span>
                      <textarea
                        onChange={(event) => setWorkflowInput(event.target.value)}
                        placeholder="Zum Beispiel: Erstelle eine Gliederung für eine Seminararbeit zu Private Equity Value Creation."
                        value={workflowInput}
                      />
                    </label>
                    <button disabled={runningWorkflow} onClick={runWorkflowAgent} type="button">
                      {runningWorkflow ? "Agent arbeitet..." : "Workflow starten"}
                    </button>
                  </div>

                  <div className="agent-output">
                    {agentRuns.length === 0 ? (
                      <div className="empty-state">
                        <strong>Noch kein Agent-Ergebnis</strong>
                        <p>Starte einen Workflow, um Struktur, Entwürfe oder Prioritäten zu erzeugen.</p>
                      </div>
                    ) : (
                      <article className="run-card">
                        <span>{getTypeLabel(WORKFLOW_TYPES, agentRuns[0].task_type)}</span>
                        <pre>{agentRuns[0].output}</pre>
                        {agentRuns[0].next_actions.length > 0 && (
                          <ul className="list">
                            {agentRuns[0].next_actions.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </article>
                    )}
                  </div>
                </div>
              </section>

              <section className="panel phase-panel workspace-section" id="research">
                <div className="phase-header">
                  <div>
                    <p className="section-label">Finance & Consulting</p>
                    <h2>Research Assistant</h2>
                    <p className="muted">
                      Erstellt finance- und consulting-nahe Reports aus Briefings, PDFs und gespeicherten Analysen.
                    </p>
                  </div>
                </div>

                <div className="agent-grid">
                  <div className="agent-form">
                    <label className="field">
                      <span>Research-Modus</span>
                      <select value={researchMode} onChange={(event) => setResearchMode(event.target.value)}>
                        {RESEARCH_MODES.map((mode) => (
                          <option key={mode.value} value={mode.value}>
                            {mode.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Briefing</span>
                      <textarea
                        onChange={(event) => setResearchBrief(event.target.value)}
                        placeholder="Zum Beispiel: Extrahiere KPIs und Risiken aus dem Geschäftsbericht und formuliere ein kurzes Investment Memo."
                        value={researchBrief}
                      />
                    </label>
                    <label className="upload-zone compact-upload">
                      <input
                        accept="application/pdf"
                        multiple
                        onChange={(event) => handleResearchFileChange(event.target.files)}
                        type="file"
                      />
                      <strong>
                        {researchFiles.length > 0
                          ? researchFiles.map((researchFile) => researchFile.name).join(", ")
                          : "Optional PDFs hinzufügen"}
                      </strong>
                      <span>Maximal 2 Dateien bis je {MAX_PDF_SIZE_LABEL}</span>
                    </label>
                    <button disabled={runningResearch} onClick={runResearchAssistant} type="button">
                      {runningResearch ? "Research läuft..." : "Report erstellen"}
                    </button>
                  </div>

                  <div className="agent-output">
                    {researchReports.length === 0 ? (
                      <div className="empty-state">
                        <strong>Noch kein Research-Report</strong>
                        <p>Starte mit einem Geschäftsbericht, Earnings-Call-Transcript oder Memo-Briefing.</p>
                      </div>
                    ) : (
                      <article className="research-card">
                        <span>{getTypeLabel(RESEARCH_MODES, researchReports[0].mode)}</span>
                        <h3>{researchReports[0].title}</h3>
                        <p>{researchReports[0].executive_summary}</p>
                        {researchReports[0].kpis.length > 0 && (
                          <div className="kpi-grid">
                            {researchReports[0].kpis.slice(0, 4).map((kpi) => (
                              <div key={`${kpi.metric}-${kpi.value}`}>
                                <strong>{kpi.metric}</strong>
                                <span>{kpi.value || "n/a"}</span>
                                <small>{kpi.note}</small>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="research-columns">
                          <div>
                            <strong>Befunde</strong>
                            <ul className="list">
                              {researchReports[0].findings.slice(0, 4).map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <strong>Risiken</strong>
                            <ul className="list">
                              {researchReports[0].risks.slice(0, 4).map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </article>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>

          <section className="panel feedback-card feedback-wide workspace-section" id="feedback">
            <div>
              <p className="section-label">Produkt verbessern</p>
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
