# Supabase Edge Functions

This repo now routes resume AI and connector-based job search through Supabase Edge Functions instead of exposing keys or cross-origin board calls in the browser.

## What you need to do

1. Install the Supabase CLI if it is not already installed.
2. From the `app/` directory, initialize Supabase locally once:
   `supabase init`
3. Link the repo to your project:
   `supabase link --project-ref <your-project-ref>`
4. Run the admin hardening SQL migration and insert your admin email into `public.admin_users`.
5. Set the Gemini secret in Supabase:
   `supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>`
6. Deploy the functions:
   `supabase functions deploy resume-ai`
   `supabase functions deploy job-search`

## Optional secrets for job search

- `USAJOBS_API_KEY`
- `USAJOBS_USER_AGENT`

Greenhouse and Lever search do not require extra secrets in this setup. USAJobs does.

## After deployment

- Remove `VITE_GEMINI_API_KEY` from any local frontend env file.
- Do not add a Gemini key to GitHub Pages secrets.
- Keep only public frontend variables in GitHub Pages:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_UNSPLASH_ACCESS_KEY` if you still use it
  - `VITE_ADMIN_PATH`
  - `VITE_ADMIN_ALLOWED_EMAILS`
  - `VITE_CONTACT_EMAIL`

## Notes

- The function requires an authenticated Supabase user whose email exists in `public.admin_users`.
- Model names are hardcoded in the function code per task.
- The current implementation uses one Gemini model for all resume tasks as the secure Phase 0 baseline.
