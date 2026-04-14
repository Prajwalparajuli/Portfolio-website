-- Foundation for candidate profile data and per-job resume variants.
-- This keeps the current settings-based flow working while enabling
-- master resumes and tailored copies for future job application features.

CREATE TABLE IF NOT EXISTS public.candidate_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_key TEXT NOT NULL UNIQUE DEFAULT 'primary',
    display_name TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    contact_email TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    linkedin_url TEXT NOT NULL DEFAULT '',
    github_url TEXT NOT NULL DEFAULT '',
    twitter_url TEXT NOT NULL DEFAULT '',
    resume_url TEXT NOT NULL DEFAULT '',
    now_line TEXT NOT NULL DEFAULT '',
    education JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.resume_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_profile_id UUID REFERENCES public.candidate_profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    variant_type TEXT NOT NULL DEFAULT 'master'
        CHECK (variant_type IN ('master', 'tailored', 'snapshot')),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    source_job_title TEXT NOT NULL DEFAULT '',
    source_job_company TEXT NOT NULL DEFAULT '',
    source_job_url TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    content JSONB NOT NULL,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_variants_single_primary
    ON public.resume_variants (is_primary)
    WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_resume_variants_active_updated
    ON public.resume_variants (updated_at DESC)
    WHERE archived_at IS NULL;

ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin users can manage candidate profiles" ON public.candidate_profiles;
CREATE POLICY "Admin users can manage candidate profiles"
    ON public.candidate_profiles FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin users can manage resume variants" ON public.resume_variants;
CREATE POLICY "Admin users can manage resume variants"
    ON public.resume_variants FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP TRIGGER IF EXISTS update_candidate_profiles_updated_at ON public.candidate_profiles;
CREATE TRIGGER update_candidate_profiles_updated_at
    BEFORE UPDATE ON public.candidate_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_resume_variants_updated_at ON public.resume_variants;
CREATE TRIGGER update_resume_variants_updated_at
    BEFORE UPDATE ON public.resume_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
