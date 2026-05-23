# Study AI App

Eine erste echte Web-App-Version fuer Studenten:

- Account erstellen und einloggen
- PDF hochladen
- PDF mit OpenAI analysieren
- Ergebnis in Supabase speichern
- Zusammenfassung, Takeaways, offene Fragen und Lernkarten anzeigen

## 1. Node.js installieren

Installiere zuerst Node.js LTS:

https://nodejs.org

Danach im Terminal pruefen:

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

1. Projekt oeffnen
2. Links auf SQL Editor
3. New query
4. Inhalt aus `supabase/schema.sql` einfuegen
5. Run klicken

## 4. Environment Variables eintragen

```bash
cp .env.local.example .env.local
```

Dann `.env.local` oeffnen und die Werte eintragen:

```bash
OPENAI_API_KEY="..."
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
```

Supabase-Werte findest du hier:

- Project Settings
- API

Wichtig: `SUPABASE_SERVICE_ROLE_KEY` und `OPENAI_API_KEY` niemals oeffentlich teilen.

## 5. App starten

```bash
npm run dev
```

Dann oeffnen:

```text
http://localhost:3000
```

## 6. Lokal pruefen

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

Danach die Befehle aus GitHub verwenden, ungefaehr so:

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
```

Die Werte sind dieselben wie in deiner lokalen `.env.local`.

## 9. Supabase Auth fuer Vercel einstellen

Wenn Vercel dir eine URL gibt, zum Beispiel:

```text
https://study-ai-app.vercel.app
```

Dann in Supabase:

1. Authentication oeffnen
2. URL Configuration oeffnen
3. Site URL auf deine Vercel-URL setzen
4. Redirect URL hinzufuegen:

```text
https://study-ai-app.vercel.app/**
```

Fuer lokale Entwicklung kannst du zusaetzlich behalten:

```text
http://localhost:3000/**
http://localhost:3001/**
http://localhost:3002/**
http://localhost:3003/**
```

## Naechste Ausbaustufen

1. PDF-Dateien in Supabase Storage speichern
2. Tester einladen
3. Feedback auswerten
4. Stripe Abo einbauen
5. Lernfortschritt dauerhaft speichern
