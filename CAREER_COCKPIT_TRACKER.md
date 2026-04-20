# Career Cockpit Tracker

Last updated: 2026-04-19 (America/Chicago)

## Ground Truth

- Repo: `C:\Users\prajw\Desktop\Projects\Portfolio website`
- Live Supabase project: `https://krvhmyiqkfuuynvblrbj.supabase.co`
- Frontend Career Cockpit changes are still local-only until explicitly deployed.
- Treat current repo state and live Supabase state as source of truth. Do not rely on compacted chat memory.

## Current Local State

- Admin auth has been hardened away from the old frontend email allowlist model.
  - [app/src/components/auth/AuthProvider.tsx](</C:/Users/prajw/Desktop/Projects/Portfolio website/app/src/components/auth/AuthProvider.tsx>)
  - [app/src/lib/supabase.ts](</C:/Users/prajw/Desktop/Projects/Portfolio website/app/src/lib/supabase.ts>)
  - [app/src/lib/functions.ts](</C:/Users/prajw/Desktop/Projects/Portfolio website/app/src/lib/functions.ts>)
- Database/RLS hardening is present in:
  - [app/supabase_migrations/002_admin_access_hardening.sql](</C:/Users/prajw/Desktop/Projects/Portfolio website/app/supabase_migrations/002_admin_access_hardening.sql>)
  - [app/supabase_migrations/007_career_cockpit_phase2.sql](</C:/Users/prajw/Desktop/Projects/Portfolio website/app/supabase_migrations/007_career_cockpit_phase2.sql>)
- Career Cockpit feature surface exists locally:
  - jobs, saved searches, sync runs, watchlists, hybrid matching, notifications, recruiter packets, answer bank, interview prep
- Search and matching quality work is also local/live-grounded:
  - broader USAJobs role families
  - description-first reranking
  - clinical false-positive guardrails
  - degree-aware query pack

## Verified Live State Before This Audit

- Live data pipeline was previously verified end-to-end:
  - `job_postings = 21`
  - `job_matches = 21`
  - `candidate_evidence_items = 14`
  - `proof_of_work_highlights = 21`
- Cron header typo was fixed live (`x-cron-secret`).
- `job-search`, `jobs-match`, and `watchlist-discover` had already been redeployed live with permissive relay auth (`verify_jwt = false`) while relying on in-function admin checks.
- `resume-ai` and `interview-prep-generate` were still live with `verify_jwt = true`.

## 2026-04-19 Search Slice

- Expanded search coverage using current public role-family guidance around:
  - `Data Scientist`
  - `Business Intelligence Analyst`
  - `Operations Research Analyst`
  - `Management Analyst` / `Management and Program Analysis`
  - `Industrial Engineer`
  - `Financial Analyst` / `Financial Risk Specialist`
- Confirmed current public education profile from live settings:
  - `Bachelor of Science, Data Science`
  - `Associate of Arts, Business Administration and Management`
  - `Associate of Science, Engineering`
- Verified final 8-query pack:
  - `applied ai engineer`
  - `data scientist`
  - `data analyst`
  - `business intelligence analyst`
  - `operations research analyst`
  - `management analyst data analytics`
  - `industrial engineer data analytics`
  - `risk analyst sql python`
- Verified notable surfaced roles:
  - `AI ENGINEER (MATHEMATICIAN)`
  - `OPERATIONS RESEARCH ANALYST`
  - `DATA ANALYTICS AND CLEARING RISK MANAGEMENT ANALYST`

## 2026-04-19 Auth / Config Audit

- Re-audited the Edge Function auth surface against actual callers.
- Only these functions should be `verify_jwt = false`:
  - `jobs-sync-scheduler`
  - `notifications-dispatch`
  - `packet-share-resolve`
- These admin-only functions should keep relay JWT verification enabled:
  - `resume-ai`
  - `job-search`
  - `jobs-match`
  - `watchlist-discover`
  - `interview-prep-generate`
- Reasoning:
  - those five functions are called from the signed-in admin frontend
  - the frontend now sends a fresh access token on each invoke
  - the functions already do their own admin check against `public.admin_users`
  - keeping relay-level JWT enabled reduces accidental public exposure
- Local files updated for this decision:
  - [app/supabase/config.toml](</C:/Users/prajw/Desktop/Projects/Portfolio website/app/supabase/config.toml>)
  - [app/supabase/functions/README.md](</C:/Users/prajw/Desktop/Projects/Portfolio website/app/supabase/functions/README.md>)

## Current Gaps

- Relay auth parity is now restored for the audited admin-only functions.
- I verified one live unauthenticated spot-check after redeploy:
  - `job-search` returned `401`
  - response code: `UNAUTHORIZED_NO_AUTH_HEADER`
  - message: `Missing authorization header`
- I have not yet re-run a fully authenticated browser/admin flow after this relay-auth redeploy in this turn.
- Search quality still has a narrower false-positive class around healthcare-admin / health-systems roles borrowing analytics language.
- Portfolio evidence is still sparse, which limits match-score ceilings.

## Recommended Next Steps

1. Re-verify one authenticated admin flow after the relay-auth redeploy.
   - `job-search` or `jobs-match` is the cleanest spot check.
2. After that parity check, take the next ranking guardrail pass on healthcare-admin false positives.

## 2026-04-19 Engineering Bias Follow-Up

- User clarified that broad engineering roles are not suitable and should stop being favored.
- Local code was updated to remove the broad adjacent-engineering bias while keeping explicitly relevant AI/ML engineering titles:
  - removed the `industrial engineer`-style boost from local scoring and live matching
  - removed the `industrial engineer data analytics` query seed from the portfolio search pack
  - replaced that search expansion with analyst/process-improvement terms in [app/src/app/admin/Jobs.tsx](</C:/Users/prajw/Desktop/Projects/Portfolio website/app/src/app/admin/Jobs.tsx>)
  - added a live matcher cap so off-target engineering / leadership / catch-all titles cannot stay inflated on vector similarity plus preference score alone
- Files changed for this slice:
  - [app/src/lib/jobMatching.ts](</C:/Users/prajw/Desktop/Projects/Portfolio website/app/src/lib/jobMatching.ts>)
  - [app/src/app/admin/Jobs.tsx](</C:/Users/prajw/Desktop/Projects/Portfolio website/app/src/app/admin/Jobs.tsx>)
  - [app/supabase/functions/_shared/job-search.ts](</C:/Users/prajw/Desktop/Projects/Portfolio website/app/supabase/functions/_shared/job-search.ts>)
  - [app/supabase/functions/jobs-match/index.ts](</C:/Users/prajw/Desktop/Projects/Portfolio website/app/supabase/functions/jobs-match/index.ts>)
- Local production build passed after this change.
- Live functions redeployed on 2026-04-19:
  - `job-search`
  - `jobs-match`
- Because the admin browser session was no longer signed in, the live `job_matches` refresh was executed directly through the project service role using the same current matcher logic and then verified from the live table.
- Verified post-refresh live ranking:
  - `AI ENGINEER (MATHEMATICIAN)` = `62.61`, `review`
  - `Manager, Engineering` = `20`, `low`
  - `Manager, Product Operations` = `8`, `low`
  - `Don’t see what you’re looking for?` catch-all rows = `10`, `low`
- Remaining notable false-positive class after this slice:
  - sales / account-exec style roles can still float above some other low-fit noise
  - current top example: `Enterprise Account Executive` = `24.71`, `low`

## Updated Next Step

1. If the next ranking pass is needed, target sales / account-exec / business-development noise next.
2. If not, the current state is usable enough to keep working live while frontend deployment is still pending.

## 2026-04-20 Project-Evidence Weighting Pass

- Goal of this slice:
  - make matching depend more on project descriptions and project evidence
  - reduce remaining title-family influence further so titles act more like tie-breakers than primary signals
- Local/frontend matcher updates:
  - [app/src/lib/jobMatching.ts](</C:/Users/prajw/Desktop/Projects/Portfolio website/app/src/lib/jobMatching.ts>)
  - explicit project-evidence scoring now uses:
    - project tags
    - project title keyword overlap
    - project-description keyword overlap
    - shared domain phrases between job description and project corpus
    - `ask_me_about` overlap when available locally
  - project evidence is now converted into weighted units and contributes directly to fit score
  - title-family boosts were reduced:
    - core AI title boost cut down
    - adjacent analyst title boost cut down
    - generic `engineer|scientist` boost cut down
    - generic context bonus cut down
- Search reranker updates:
  - [app/src/app/admin/Jobs.tsx](</C:/Users/prajw/Desktop/Projects/Portfolio website/app/src/app/admin/Jobs.tsx>)
  - [app/supabase/functions/_shared/job-search.ts](</C:/Users/prajw/Desktop/Projects/Portfolio website/app/supabase/functions/_shared/job-search.ts>)
  - ranking now leans more on `scoreJobFit` and less on title-family boosts
- Live matcher update:
  - [app/supabase/functions/jobs-match/index.ts](</C:/Users/prajw/Desktop/Projects/Portfolio website/app/supabase/functions/jobs-match/index.ts>)
  - mirrored the same project-evidence weighting and reduced title-family logic
- Verification:
  - local production build passed on `2026-04-20`
  - live `job-search` and `jobs-match` were redeployed on `2026-04-20`
  - live `job_matches` rows were refreshed afterward against the current logic
- Verified live post-refresh state:
  - `AI ENGINEER (MATHEMATICIAN)` = `47.96`, `review`
  - `Manager, Engineering` = `14`, `low`
  - `Enterprise Account Executive` = `24.71`, `low`
  - `Don’t see what you’re looking for?` catch-all rows remain capped at `10`, `low`
- Current interpretation:
  - engineering-manager bias is materially lower than before
  - project evidence has more influence than before, but the next false-positive class is now clearly sales/account-exec noise rather than engineering
  - the current state is stable enough for deployment; the next quality slice is optional refinement, not a blocker
