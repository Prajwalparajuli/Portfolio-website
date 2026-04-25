# Supabase Edge Functions

This repo uses Supabase Edge Functions for resume AI, external job search, hybrid matching, watchlist sync, notifications, recruiter packet resolution, and interview prep.

## Required setup

1. Install the Supabase CLI if it is not already installed.
2. From the `app/` directory, link the repo to your project:
   `supabase link --project-ref <your-project-ref>`
3. Run the database migrations through `007_career_cockpit_phase2.sql`.
4. Insert your admin email into `public.admin_users`.
5. Set the required secrets:
   `supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>`
   `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>`
   `supabase secrets set CRON_SECRET=<long-random-shared-secret>`

## Optional secrets

- `USAJOBS_API_KEY`
- `USAJOBS_USER_AGENT`
- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`
- `SERPAPI_KEY`
- `GITHUB_TOKEN` if you want higher GitHub API rate limits for project description generation
- `RESEND_API_KEY`
- `NOTIFICATION_FROM_EMAIL`
- `NOTIFICATION_TO_EMAIL`

Greenhouse and Lever do not require extra secrets in this setup.

## Deploy functions

Deploy the admin-authenticated functions. These should use in-function admin checks and run with `verify_jwt = false` in `config.toml` for projects using Supabase JWT signing keys:

- `supabase functions deploy resume-ai`
- `supabase functions deploy job-search`
- `supabase functions deploy jobs-match`
- `supabase functions deploy watchlist-discover`
- `supabase functions deploy interview-prep-generate`
- `supabase functions deploy project-describe`

Deploy the scheduler/public functions. These also run with `verify_jwt = false`:

- `supabase functions deploy jobs-sync-scheduler`
- `supabase functions deploy notifications-dispatch`
- `supabase functions deploy packet-share-resolve`

Reasoning:

- Supabase's older relay-level `verify_jwt` path is incompatible with newer JWT signing keys.
- This repo explicitly authenticates admin-only functions inside the function using Supabase Auth plus `public.admin_users`.
- Scheduler/public flows are separately protected by `x-cron-secret` or packet tokens where applicable.

## Scheduling

Two functions are intended to run on a schedule and authenticate with `CRON_SECRET` instead of a user JWT:

- `jobs-sync-scheduler`
- `notifications-dispatch`

Recommended schedule:

- hourly trigger for `jobs-sync-scheduler`
- hourly or daily trigger for `notifications-dispatch`

The scheduler function itself enforces the daily `08:00 America/Chicago` sync window for enabled watchlists and enabled saved job searches. It also asks `jobs-match` to refresh matches for jobs imported during the run. Notification dispatch deduplicates matching notification rows over a recent window so hourly triggers do not flood the inbox.

## Frontend environment

Keep only public frontend variables in GitHub Pages or local frontend env files:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_UNSPLASH_ACCESS_KEY` if you still use it
- `VITE_ADMIN_PATH`
- `VITE_CONTACT_EMAIL`

Do not use `VITE_ADMIN_ALLOWED_EMAILS`. Admin access now comes from Supabase auth plus `public.admin_users`.

## Notes

- `resume-ai`, `job-search`, `jobs-match`, `watchlist-discover`, `interview-prep-generate`, and `project-describe` require an authenticated admin user and should enforce that inside the function.
- `packet-share-resolve` is intentionally public and only accepts secret packet tokens.
- `jobs-sync-scheduler` and `notifications-dispatch` accept either an authenticated admin request or a matching `x-cron-secret` header.
