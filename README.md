# Study AI App

Eine erste echte Web-App-Version für Studierende:

- Account erstellen und einloggen
- PDF hochladen
- PDF mit OpenAI analysieren
- Ergebnis in Supabase speichern
- Zusammenfassung, Takeaways, offene Fragen und Lernkarten anzeigen
- Demo-Analyse ohne OpenAI-Guthaben testen
- Kostenloses Monatslimit vorbereiten
- Tester-Feedback in Supabase sammeln

## 1. Node.js installieren

Installiere zuerst Node.js LTS:

https://nodejs.org

Danach im Terminal prüfen:

```bash
node -v
npm -v
```

## 2. Pakete installieren

```bash
cd study-ai-app
npm install
```

## 3. Supabase Tabellen anlegen

In Supabase:

1. Projekt öffnen
2. Links auf SQL Editor
3. New query
4. Inhalt aus `supabase/schema.sql` einfügen
5. Run klicken

## 4. Environment Variables eintragen

```bash
cp .env.local.example .env.local
```

Dann `.env.local` öffnen und die Werte eintragen:

```bash
OPENAI_API_KEY="..."
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
NEXT_PUBLIC_FEEDBACK_EMAIL=""
```

Supabase-Werte findest du hier:

- Project Settings
- API

Wichtig: `SUPABASE_SERVICE_ROLE_KEY` und `OPENAI_API_KEY` niemals öffentlich teilen.

## 5. App starten

```bash
npm run dev
```

Dann öffnen:

```text
http://localhost:3000
```

## 6. Lokal prüfen

Vor jedem Deployment:

```bash
npm run build
```

Wenn der Build erfolgreich ist, kann die App zu Vercel.

## 7. GitHub vorbereiten

Einmalig im Projektordner:

```bash
git add .
git commit -m "Initial Study AI MVP"
```

Dann in GitHub ein neues Repository erstellen, zum Beispiel:

```text
study-ai-app
```

Danach die Befehle aus GitHub verwenden, ungefähr so:

```bash
git remote add origin https://github.com/DEIN-USERNAME/study-ai-app.git
git branch -M main
git push -u origin main
```

## 8. Vercel Deployment

In Vercel:

1. Add New Project
2. GitHub Repository `study-ai-app` importieren
3. Framework Preset: Next.js
4. Build Command: `npm run build`
5. Environment Variables eintragen
6. Deploy klicken

Diese Environment Variables brauchst du in Vercel:

```bash
OPENAI_API_KEY="..."
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
NEXT_PUBLIC_FEEDBACK_EMAIL=""
```

Die Werte sind dieselben wie in deiner lokalen `.env.local`.
`NEXT_PUBLIC_FEEDBACK_EMAIL` ist optional. Wenn du eine Mailadresse einträgst,
öffnet der Feedback-Link direkt eine Mail an diese Adresse.

## 9. Supabase Auth für Vercel einstellen

Wenn Vercel dir eine URL gibt, zum Beispiel:

```text
https://study-ai-app.vercel.app
```

Dann in Supabase:

1. Authentication öffnen
2. URL Configuration öffnen
3. Site URL auf deine Vercel-URL setzen
4. Redirect URL hinzufügen:

```text
https://study-ai-app.vercel.app/**
```

Für lokale Entwicklung kannst du zusätzlich behalten:

```text
http://localhost:3000/**
http://localhost:3001/**
http://localhost:3002/**
http://localhost:3003/**
```

## 10. Wenn sich die Datenbankstruktur ändert

Die Datei `supabase/schema.sql` ist wiederholbar. Du kannst sie im Supabase SQL
Editor erneut ausführen, wenn neue Tabellen oder Policies dazukommen.

Aktuell enthält sie auch:

- `usage_events`: zählt PDF-Analysen unabhängig davon, ob ein Nutzer später eine Analyse löscht
- `feedback`: speichert Tester-Feedback aus dem Formular in der App

## Nächste Ausbaustufen

1. PDF-Dateien in Supabase Storage speichern
2. Tester einladen
3. Feedback auswerten
4. Stripe Abo einbauen
5. Lernfortschritt dauerhaft speichern
