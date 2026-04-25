-- Phase 6: decision support attribution.
-- Adds lightweight source/search attribution directly on job_postings so
-- saved-search and query analytics can roll up from the actual jobs/applications.

ALTER TABLE public.job_postings
    ADD COLUMN IF NOT EXISTS saved_job_search_id UUID REFERENCES public.saved_job_searches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS query_label TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_job_postings_saved_search_created
    ON public.job_postings (saved_job_search_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_postings_query_label_created
    ON public.job_postings (query_label, created_at DESC);

UPDATE public.job_postings AS jobs
SET query_label = COALESCE(watchlists.preferred_query, '')
FROM public.company_watchlists AS watchlists
WHERE jobs.watchlist_id = watchlists.id
  AND COALESCE(jobs.query_label, '') = '';
