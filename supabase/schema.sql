create extension if not exists "pgcrypto";

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#0f766e',
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  file_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text not null,
  takeaways text[] not null default '{}',
  open_questions text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.documents
  add column if not exists subject_id uuid references public.subjects(id) on delete set null;

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  event_type text not null default 'pdf_analysis',
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  would_use text not null check (would_use in ('yes', 'maybe', 'no')),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  analysis_id uuid references public.analyses(id) on delete set null,
  item_type text not null check (item_type in ('topic', 'note', 'project', 'connection')),
  title text not null,
  content text not null,
  tags text[] not null default '{}',
  related_titles text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  task_type text not null,
  input text not null,
  output text not null,
  next_actions text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.research_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  mode text not null,
  title text not null,
  executive_summary text not null,
  findings text[] not null default '{}',
  kpis jsonb not null default '[]'::jsonb,
  risks text[] not null default '{}',
  next_steps text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;
alter table public.subjects enable row level security;
alter table public.analyses enable row level security;
alter table public.flashcards enable row level security;
alter table public.usage_events enable row level security;
alter table public.feedback enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.agent_runs enable row level security;
alter table public.research_reports enable row level security;

drop policy if exists "Users can read own subjects" on public.subjects;
drop policy if exists "Users can read own documents" on public.documents;
drop policy if exists "Users can read own analyses" on public.analyses;
drop policy if exists "Users can read own flashcards" on public.flashcards;
drop policy if exists "Users can read own usage events" on public.usage_events;
drop policy if exists "Users can read own feedback" on public.feedback;
drop policy if exists "Users can read own knowledge items" on public.knowledge_items;
drop policy if exists "Users can read own agent runs" on public.agent_runs;
drop policy if exists "Users can read own research reports" on public.research_reports;

create policy "Users can read own subjects"
  on public.subjects for select
  using (auth.uid() = user_id);

create policy "Users can read own documents"
  on public.documents for select
  using (auth.uid() = user_id);

create policy "Users can read own analyses"
  on public.analyses for select
  using (auth.uid() = user_id);

create policy "Users can read own flashcards"
  on public.flashcards for select
  using (auth.uid() = user_id);

create policy "Users can read own usage events"
  on public.usage_events for select
  using (auth.uid() = user_id);

create policy "Users can read own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);

create policy "Users can read own knowledge items"
  on public.knowledge_items for select
  using (auth.uid() = user_id);

create policy "Users can read own agent runs"
  on public.agent_runs for select
  using (auth.uid() = user_id);

create policy "Users can read own research reports"
  on public.research_reports for select
  using (auth.uid() = user_id);
