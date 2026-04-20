-- Saved job sources/searches so connector search can feel curated instead of manual.

CREATE TABLE IF NOT EXISTS public.saved_job_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL
        CHECK (source IN ('greenhouse', 'lever', 'usajobs')),
    board_or_site TEXT NOT NULL DEFAULT '',
    query TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    remote_only BOOLEAN NOT NULL DEFAULT false,
    result_limit INTEGER NOT NULL DEFAULT 20
        CHECK (result_limit >= 1 AND result_limit <= 50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_job_searches_updated
    ON public.saved_job_searches (updated_at DESC);

ALTER TABLE public.saved_job_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin users can manage saved job searches" ON public.saved_job_searches;
CREATE POLICY "Admin users can manage saved job searches"
    ON public.saved_job_searches FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP TRIGGER IF EXISTS update_saved_job_searches_updated_at ON public.saved_job_searches;
CREATE TRIGGER update_saved_job_searches_updated_at
    BEFORE UPDATE ON public.saved_job_searches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
