\echo Rebuilding the app schema from repo files...
\ir ../app/supabase_schema.sql
\ir ../app/supabase_migrations/001_add_ask_me_about.sql
\ir ../app/supabase_migrations/002_admin_access_hardening.sql
\ir ../app/supabase_migrations/003_resume_foundation.sql
\ir ../app/supabase_migrations/004_jobs_applications_foundation.sql
\ir ../app/supabase_migrations/005_saved_job_searches.sql
\ir ../app/supabase_migrations/006_job_sync_runs.sql
\ir ../app/supabase_migrations/007_career_cockpit_phase2.sql
\echo Repo schema rebuild complete.
