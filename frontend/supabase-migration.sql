-- ============================================================
-- RelAI – Full Schema Migration
-- Run this in Supabase Dashboard → SQL Editor
-- Safe to run multiple times (uses CREATE TABLE IF NOT EXISTS)
-- ============================================================

-- ── Employees ────────────────────────────────────────────────
create table if not exists employees (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text unique,
  role        text not null default 'Engineer',
  department  text,
  skills      text[] default '{}',
  availability boolean default true,
  manager_id  uuid references employees(id),
  user_role   text not null default 'employee', -- 'manager' | 'employee' | 'ceo' | 'cto'
  created_at  timestamptz default now()
);

-- Seed employees from existing profiles (safe – ignores conflicts)
insert into employees (id, name, email, role, department, user_role)
select
  p.id,
  coalesce(p.full_name, p.email),
  p.email,
  coalesce(ur.role, 'Employee'),
  null,
  coalesce(ur.role, 'employee')
from profiles p
left join user_roles ur on ur.user_id = p.id
on conflict (email) do nothing;

-- ── Projects ─────────────────────────────────────────────────
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  status      text default 'planning',  -- planning | active | on_hold | completed
  manager_id  uuid references employees(id),
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
alter table if exists employees disable row level security;
alter table if exists projects disable row level security;
alter table if exists project_assignments disable row level security;
alter table if exists tasks disable row level security;
alter table if exists notifications disable row level security;

-- ── Sample project data ───────────────────────────────────────
insert into projects (title, description, status) values
  ('RelAI Platform', 'AI-powered team management and meeting intelligence platform', 'active'),
  ('Hackathon Demo', 'HackCanada 2026 submission – RelAI full-stack demo', 'active')
on conflict do nothing;
