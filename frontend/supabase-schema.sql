-- ============================================================
-- RelAI Dashboard – Supabase Database Schema
-- Run this in your Supabase project's SQL editor.
-- ============================================================

-- ── Profiles (links auth.users to app roles) ──────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  user_role   text not null default 'employee', -- 'manager' | 'employee'
  created_at  timestamptz default now()
);

-- ── Employees ────────────────────────────────────────────────
create table if not exists employees (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text unique,
  role        text not null,
  department  text,
  skills      text[] default '{}',
  availability boolean default true,
  manager_id  uuid references employees(id),
  user_role   text not null default 'employee', -- 'manager' | 'employee' | 'ceo' | 'cto'
  created_at  timestamptz default now()
);

-- ── Projects ─────────────────────────────────────────────────
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  status      text default 'planning',  -- planning | active | on_hold | completed
  manager_id  uuid,
  notion_url  text,
  created_at  timestamptz default now()
);

-- ── Project Assignments ───────────────────────────────────────
create table if not exists project_assignments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  employee_id uuid references employees(id) on delete cascade,
  role        text,
  unique(project_id, employee_id)
);

-- ── Tasks ────────────────────────────────────────────────────
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  title       text not null,
  status      text default 'todo',      -- todo | in_progress | done
  assigned_to uuid references employees(id),
  due_date    date,
  priority    text default 'medium',    -- low | medium | high
  created_at  timestamptz default now()
);

-- ── Meetings ─────────────────────────────────────────────────
create table if not exists meetings (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  project_id  uuid references projects(id) on delete set null,
  host_id     uuid,                        -- user_id of meeting host
  status      text default 'scheduled',    -- scheduled | active | ended
  scheduled_at timestamptz,
  started_at  timestamptz,
  ended_at    timestamptz,
  meeting_thread_id text,                  -- Backboard AI thread for this meeting
  created_at  timestamptz default now()
);

-- ── Meeting Participants ──────────────────────────────────────
create table if not exists meeting_participants (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid references meetings(id) on delete cascade,
  employee_id uuid references employees(id) on delete cascade,
  joined_at   timestamptz,
  unique(meeting_id, employee_id)
);

-- ── Meeting Transcripts ───────────────────────────────────────
create table if not exists meeting_transcripts (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid references meetings(id) on delete cascade,
  speaker     text,                        -- 'user' | 'ai' | employee name
  message     text not null,
  created_at  timestamptz default now()
);

-- ── Meeting Summaries ─────────────────────────────────────────
create table if not exists meeting_summaries (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid references meetings(id) on delete cascade unique,
  summary_text text,
  action_items jsonb default '[]',         -- [{task, assignee, due_date}]
  key_decisions jsonb default '[]',        -- [string]
  created_at   timestamptz default now()
);


-- ── Notifications ─────────────────────────────────────────────
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  type        text,                     -- assignment | skill_gap | meeting | deadline | update
  message     text,
  read        boolean default false,
  created_at  timestamptz default now()
);

-- ── Disable RLS for local dev (enable in production) ──────────
alter table if exists profiles disable row level security;
alter table if exists employees disable row level security;
alter table if exists projects disable row level security;
alter table if exists project_assignments disable row level security;
alter table if exists tasks disable row level security;
alter table if exists meetings disable row level security;
alter table if exists notifications disable row level security;
