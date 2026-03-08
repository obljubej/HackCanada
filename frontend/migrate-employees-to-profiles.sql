-- ============================================================
-- RelAI – Drop Employees Table Migration
-- Run this in Supabase Dashboard → SQL Editor
-- This repoints all foreign keys to the "profiles" table and drops "employees".
-- ============================================================

-- Repoint project_assignments to profiles
ALTER TABLE project_assignments DROP CONSTRAINT IF EXISTS project_assignments_employee_id_fkey;
ALTER TABLE project_assignments ADD CONSTRAINT project_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Repoint tasks to profiles
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

-- Repoint projects to profiles
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_manager_id_fkey;
ALTER TABLE projects ADD CONSTRAINT projects_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Drop the employees table completely
DROP TABLE IF EXISTS employees CASCADE;
