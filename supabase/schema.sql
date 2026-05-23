create extension if not exists "pgcrypto";

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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

alter table public.documents enable row level security;
alter table public.analyses enable row level security;
alter table public.flashcards enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists "Users can read own documents" on public.documents;
drop policy if exists "Users can read own analyses" on public.analyses;
drop policy if exists "Users can read own flashcards" on public.flashcards;
drop policy if exists "Users can read own usage events" on public.usage_events;

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
