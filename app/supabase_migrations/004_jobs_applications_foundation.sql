-- Manual jobs + application tracking foundation.
-- This keeps the first jobs phase compact and private while leaving room
-- for future ingestion connectors and match pipelines.

CREATE TABLE IF NOT EXISTS public.job_postings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'greenhouse', 'lever', 'usajobs')),
    external_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    company TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    remote_type TEXT NOT NULL DEFAULT 'unknown'
        CHECK (remote_type IN ('remote', 'hybrid', 'onsite', 'unknown')),
    employment_type TEXT NOT NULL DEFAULT '',
    salary_range TEXT NOT NULL DEFAULT '',
    job_url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    fit_notes TEXT NOT NULL DEFAULT '',
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_postings_source_external
    ON public.job_postings (source, external_id)
    WHERE external_id <> '';

CREATE INDEX IF NOT EXISTS idx_job_postings_active_updated
    ON public.job_postings (updated_at DESC)
    WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_posting_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
    resume_variant_id UUID REFERENCES public.resume_variants(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'saved'
        CHECK (status IN ('saved', 'tailoring', 'ready_to_apply', 'applied', 'interview', 'offer', 'rejected', 'archived')),
    follow_up_at DATE,
    applied_at DATE,
    notes TEXT NOT NULL DEFAULT '',
    cover_letter TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_job_posting_unique
    ON public.applications (job_posting_id);

CREATE INDEX IF NOT EXISTS idx_applications_status_updated
    ON public.applications (status, updated_at DESC);

ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin users can manage job postings" ON public.job_postings;
CREATE POLICY "Admin users can manage job postings"
    ON public.job_postings FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin users can manage applications" ON public.applications;
CREATE POLICY "Admin users can manage applications"
    ON public.applications FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP TRIGGER IF EXISTS update_job_postings_updated_at ON public.job_postings;
CREATE TRIGGER update_job_postings_updated_at
    BEFORE UPDATE ON public.job_postings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_applications_updated_at ON public.applications;
CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
