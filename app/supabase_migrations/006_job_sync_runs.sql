-- Enabled saved searches plus sync history for repeatable job curation.

ALTER TABLE public.saved_job_searches
    ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_error TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.job_sync_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    saved_job_search_id UUID REFERENCES public.saved_job_searches(id) ON DELETE SET NULL,
    run_mode TEXT NOT NULL DEFAULT 'single'
        CHECK (run_mode IN ('single', 'enabled_batch')),
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'success', 'error')),
    source TEXT NOT NULL
        CHECK (source IN ('greenhouse', 'lever', 'usajobs')),
    label TEXT NOT NULL DEFAULT '',
    board_or_site TEXT NOT NULL DEFAULT '',
    query TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    result_count INTEGER NOT NULL DEFAULT 0
        CHECK (result_count >= 0),
    imported_count INTEGER NOT NULL DEFAULT 0
        CHECK (imported_count >= 0),
    error_message TEXT NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_job_sync_runs_started_at
    ON public.job_sync_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_sync_runs_saved_search_started_at
    ON public.job_sync_runs (saved_job_search_id, started_at DESC);

ALTER TABLE public.job_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin users can manage job sync runs" ON public.job_sync_runs;
CREATE POLICY "Admin users can manage job sync runs"
    ON public.job_sync_runs FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());
