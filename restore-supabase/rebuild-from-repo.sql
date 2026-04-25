\echo Rebuilding the app schema from repo files...
\ir ../app/supabase_schema.sql
\ir ../app/supabase_migrations/001_add_ask_me_about.sql
\ir ../app/supabase_migrations/002_admin_access_hardening.sql
\ir ../app/supabase_migrations/003_resume_foundation.sql
\ir ../app/supabase_migrations/004_jobs_applications_foundation.sql
\ir ../app/supabase_migrations/005_saved_job_searches.sql
\ir ../app/supabase_migrations/006_job_sync_runs.sql
\ir ../app/supabase_migrations/007_career_cockpit_phase2.sql
\ir ../app/supabase_migrations/008_source_coverage_expansion.sql
\ir ../app/supabase_migrations/009_relationship_crm_phase5.sql
\ir ../app/supabase_migrations/010_decision_support_phase6.sql
\ir ../app/supabase_migrations/011_adzuna_source_expansion.sql
\ir ../app/supabase_migrations/012_google_jobs_source_expansion.sql
\ir ../app/supabase_migrations/013_project_structured_narrative.sql
\echo Repo schema rebuild complete.
