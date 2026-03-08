-- ============================================================
-- RelAI – Full Schema Migration
-- Run this in Supabase Dashboard → SQL Editor
-- Safe to run multiple times (uses CREATE TABLE IF NOT EXISTS)
-- ============================================================

-- ── Employees (Removed: Now using profiles table directly) ────
-- See profiles table for base users.

-- ── Projects ─────────────────────────────────────────────────
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  status      text default 'planning',  -- planning | active | on_hold | completed
  manager_id  uuid references profiles(id) on delete set null,
  notion_url  text,
  created_at  timestamptz default now()
);

-- ── Project Assignments ───────────────────────────────────────
create table if not exists project_assignments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  employee_id uuid references profiles(id) on delete cascade,
  role        text,
  unique(project_id, employee_id)
);

-- ── Tasks ────────────────────────────────────────────────────
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  title       text not null,
  status      text default 'todo',      -- todo | in_progress | done
  assigned_to uuid references profiles(id) on delete set null,
  due_date    date,
  priority    text default 'medium',    -- low | medium | high
  created_at  timestamptz default now()
);

-- ── Notifications ─────────────────────────────────────────────
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  type        text,
  message     text,
  read        boolean default false,
  created_at  timestamptz default now()
);

-- Add meetings reference to projects (if meetings table exists)
alter table if exists meetings
  add column if not exists project_id uuid references projects(id) on delete set null;

-- ── Disable RLS for hackathon dev ─────────────────────────────
alter table if exists projects disable row level security;
alter table if exists project_assignments disable row level security;
alter table if exists tasks disable row level security;
alter table if exists notifications disable row level security;

-- ── Sample project data ───────────────────────────────────────
insert into projects (title, description, status) values
  ('RelAI Platform', 'AI-powered team management and meeting intelligence platform', 'active'),
  ('Hackathon Demo', 'HackCanada 2026 submission – RelAI full-stack demo', 'active')
on conflict do nothing;
