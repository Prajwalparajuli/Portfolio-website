-- Add ask_me_about to projects (run if you already have the projects table)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ask_me_about TEXT;
