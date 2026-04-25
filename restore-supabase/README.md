# Supabase Recovery Toolkit

This folder contains checked-in helpers for restoring the Supabase project and validating whether a local backup contains the app data you need. Backup files are intentionally ignored and should stay local-only.

## Files
- `*.backup`: downloaded Supabase dashboard backups; keep these local-only
- `restore-backup.ps1`: runs the backup through `psql`
- `run-validation.ps1`: runs the validation queries after restore
- `validate.sql`: safe validation queries for public tables, storage, and auth users
- `rebuild-from-repo.ps1`: fallback path if the backup does not contain the portfolio tables/data
- `rebuild-from-repo.sql`: includes the repo schema and migration files

## Before You Start
1. Create the new Supabase project.
2. Save the project URL, anon key, project ref, and database password.
3. Install the latest PostgreSQL client tools so `psql` is available.
4. Open Supabase `Connect` and copy the session pooler connection string on port `5432`.

## Restore The Backup
You can either pass the connection string explicitly or export it first.

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
.\restore-supabase\restore-backup.ps1
```

Or:

```powershell
.\restore-supabase\restore-backup.ps1 -ConnectionString "postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
```

Expected behavior:
- `psql` may print `already exists` errors for built-in Supabase objects.
- That is normal for dashboard backups restored into a fresh Supabase project.
- Always run validation after the restore completes.

## Validate The Restore
```powershell
.\restore-supabase\run-validation.ps1
```

Review:
- public table list
- row counts for `public.projects`, `public.skills`, `public.settings`, `public.project_images`, `public.contact_messages`, `public.admin_activity`
- storage bucket/object counts
- auth user emails

## Fallback If App Tables Are Missing
If the validation output shows that the backup did not restore your portfolio tables/data, rebuild the app schema from the repo:

```powershell
.\restore-supabase\rebuild-from-repo.ps1
```

That script includes:
- `app/supabase_schema.sql`
- `app/supabase_migrations/001_add_ask_me_about.sql` through `012_google_jobs_source_expansion.sql`

After fallback rebuild, manually repopulate:
- projects
- settings
- skills
- resume content
- local copies of uploaded files

## After Database Recovery
1. Check `Authentication -> Users` in Supabase.
2. Reset the admin password or create the admin user if needed.
3. Re-upload missing storage files such as project covers and resume PDFs.
4. Update `app/.env` locally with the new Supabase URL and anon key.
5. Update GitHub `Settings -> Environments -> github-pages`:
   - set `VITE_SUPABASE_URL`
   - set `VITE_SUPABASE_ANON_KEY`
   - set `VITE_UNSPLASH_ACCESS_KEY` if still used
   - confirm `VITE_ADMIN_PATH`
   - confirm `VITE_CONTACT_EMAIL`
   - do not set `VITE_ADMIN_ALLOWED_EMAILS` or `VITE_ADMIN_SECRET_KEY`
   - do not set `VITE_GEMINI_API_KEY`; keep Gemini only in Supabase function secrets
   - keep service-role keys, cron secrets, database URLs, Resend keys, Adzuna keys, and SerpApi keys out of GitHub Pages variables
6. Redeploy GitHub Pages and test the public site plus admin CRUD.
