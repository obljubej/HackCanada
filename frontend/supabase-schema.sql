-- ============================================================
-- RelAI Dashboard – Supabase Database Schema
-- Run this in your Supabase project's SQL editor.
-- ============================================================

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
  project_id  uuid references projects(id) on delete cascade,
  title       text not null,
  start_time  timestamptz,
  attendees   uuid[] default '{}'
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

-- ── RLS: Turn off for local dev, enable in production ─────────
-- alter table employees enable row level security;
-- alter table projects enable row level security;
-- etc.
