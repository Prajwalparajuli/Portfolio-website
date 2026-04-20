-- Career cockpit expansion:
-- hybrid matching, watchlists, notifications, recruiter packet sharing,
-- answer bank, CRM touchpoints, and interview prep.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.company_watchlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT NOT NULL DEFAULT '',
    careers_url TEXT NOT NULL DEFAULT '',
    source_hint TEXT NOT NULL DEFAULT 'auto'
        CHECK (source_hint IN ('auto', 'greenhouse', 'lever', 'generic')),
    board_or_site TEXT NOT NULL DEFAULT '',
    preferred_query TEXT NOT NULL DEFAULT '',
    location_hint TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('high', 'medium', 'low')),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    last_discovery_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    last_error TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_watchlists_enabled_updated
    ON public.company_watchlists (is_enabled, updated_at DESC);

ALTER TABLE public.job_postings
    ADD COLUMN IF NOT EXISTS watchlist_id UUID REFERENCES public.company_watchlists(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS discovery_status TEXT NOT NULL DEFAULT 'manual'
        CHECK (discovery_status IN ('manual', 'discovered', 'snapshot', 'unsupported', 'error')),
    ADD COLUMN IF NOT EXISTS source_text TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS embedding extensions.vector(384),
    ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

ALTER TABLE public.job_sync_runs
    DROP CONSTRAINT IF EXISTS job_sync_runs_source_check;

ALTER TABLE public.job_sync_runs
    ADD CONSTRAINT job_sync_runs_source_check
        CHECK (source IN ('greenhouse', 'lever', 'usajobs', 'generic'));

ALTER TABLE public.job_sync_runs
    ADD COLUMN IF NOT EXISTS watchlist_id UUID REFERENCES public.company_watchlists(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS discovery_status TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS discovered_source TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS failure_stage TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.candidate_evidence_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_kind TEXT NOT NULL
        CHECK (source_kind IN ('skill', 'project', 'resume_summary', 'resume_bullet', 'custom_experience')),
    source_id TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    embedding extensions.vector(384),
    embedding_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_evidence_items_source
    ON public.candidate_evidence_items (source_kind, source_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_evidence_items_source_unique
    ON public.candidate_evidence_items (source_kind, source_id);

CREATE TABLE IF NOT EXISTS public.job_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_posting_id UUID NOT NULL UNIQUE REFERENCES public.job_postings(id) ON DELETE CASCADE,
    best_evidence_item_id UUID REFERENCES public.candidate_evidence_items(id) ON DELETE SET NULL,
    semantic_score REAL NOT NULL DEFAULT 0,
    keyword_score REAL NOT NULL DEFAULT 0,
    preference_score REAL NOT NULL DEFAULT 0,
    total_score REAL NOT NULL DEFAULT 0,
    band TEXT NOT NULL DEFAULT 'low'
        CHECK (band IN ('strong', 'review', 'low')),
    reason_summary TEXT NOT NULL DEFAULT '',
    best_evidence_label TEXT NOT NULL DEFAULT '',
    matched_skill_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    matched_project_titles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    matched_keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    missing_signals TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    evidence_item_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_matches_band_score
    ON public.job_matches (band, total_score DESC, refreshed_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_key TEXT NOT NULL UNIQUE DEFAULT 'primary',
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    inbox_enabled BOOLEAN NOT NULL DEFAULT true,
    strong_match_enabled BOOLEAN NOT NULL DEFAULT true,
    sync_failure_enabled BOOLEAN NOT NULL DEFAULT true,
    follow_up_enabled BOOLEAN NOT NULL DEFAULT true,
    stale_application_enabled BOOLEAN NOT NULL DEFAULT true,
    weekly_digest_enabled BOOLEAN NOT NULL DEFAULT true,
    digest_hour SMALLINT NOT NULL DEFAULT 8 CHECK (digest_hour >= 0 AND digest_hour <= 23),
    timezone TEXT NOT NULL DEFAULT 'America/Chicago',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL
        CHECK (type IN ('strong_match', 'sync_failure', 'follow_up_due', 'stale_application', 'system')),
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    link_path TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL DEFAULT 'inbox'
        CHECK (channel IN ('inbox', 'email', 'both')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    job_posting_id UUID REFERENCES public.job_postings(id) ON DELETE CASCADE,
    company_watchlist_id UUID REFERENCES public.company_watchlists(id) ON DELETE CASCADE,
    due_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_items_unread_created
    ON public.notification_items (is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS public.application_share_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    resume_variant_id UUID REFERENCES public.resume_variants(id) ON DELETE SET NULL,
    share_token_hash TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ,
    access_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_share_links_active
    ON public.application_share_links (application_id, revoked_at, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.candidate_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_key TEXT NOT NULL UNIQUE DEFAULT '',
    label TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'general',
    answer TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_answers_category
    ON public.candidate_answers (category, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.interview_prep_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL UNIQUE REFERENCES public.applications(id) ON DELETE CASCADE,
    generated_summary TEXT NOT NULL DEFAULT '',
    talking_points JSONB NOT NULL DEFAULT '[]'::jsonb,
    technical_focus JSONB NOT NULL DEFAULT '[]'::jsonb,
    recruiter_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    tell_me_about_yourself TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contact_touchpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
    company TEXT NOT NULL DEFAULT '',
    contact_name TEXT NOT NULL DEFAULT '',
    contact_role TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL DEFAULT 'email'
        CHECK (channel IN ('email', 'linkedin', 'phone', 'referral', 'other')),
    note TEXT NOT NULL DEFAULT '',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_touchpoints_company_occurred
    ON public.contact_touchpoints (company, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.proof_of_work_highlights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    job_posting_id UUID REFERENCES public.job_postings(id) ON DELETE CASCADE,
    source_kind TEXT NOT NULL
        CHECK (source_kind IN ('project', 'resume_bullet', 'custom_experience')),
    source_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    relevance_reason TEXT NOT NULL DEFAULT '',
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proof_of_work_highlights_target
    ON public.proof_of_work_highlights (application_id, job_posting_id, display_order ASC);

CREATE OR REPLACE FUNCTION public.query_candidate_evidence(
    match_embedding extensions.vector(384),
    match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    source_kind TEXT,
    source_id TEXT,
    label TEXT,
    content TEXT,
    similarity REAL
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        candidate_evidence_items.id,
        candidate_evidence_items.source_kind,
        candidate_evidence_items.source_id,
        candidate_evidence_items.label,
        candidate_evidence_items.content,
        1 - (candidate_evidence_items.embedding <=> match_embedding) AS similarity
    FROM public.candidate_evidence_items
    WHERE candidate_evidence_items.embedding IS NOT NULL
    ORDER BY candidate_evidence_items.embedding <=> match_embedding
    LIMIT GREATEST(match_count, 1);
$$;

GRANT EXECUTE ON FUNCTION public.query_candidate_evidence(extensions.vector, INTEGER)
    TO authenticated;

ALTER TABLE public.company_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_prep_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_touchpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proof_of_work_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin users can manage company watchlists" ON public.company_watchlists;
CREATE POLICY "Admin users can manage company watchlists"
    ON public.company_watchlists FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin users can manage candidate evidence items" ON public.candidate_evidence_items;
CREATE POLICY "Admin users can manage candidate evidence items"
    ON public.candidate_evidence_items FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin users can manage job matches" ON public.job_matches;
CREATE POLICY "Admin users can manage job matches"
    ON public.job_matches FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin users can manage notification preferences" ON public.notification_preferences;
CREATE POLICY "Admin users can manage notification preferences"
    ON public.notification_preferences FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin users can manage notification items" ON public.notification_items;
CREATE POLICY "Admin users can manage notification items"
    ON public.notification_items FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin users can manage application share links" ON public.application_share_links;
CREATE POLICY "Admin users can manage application share links"
    ON public.application_share_links FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin users can manage candidate answers" ON public.candidate_answers;
CREATE POLICY "Admin users can manage candidate answers"
    ON public.candidate_answers FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin users can manage interview prep notes" ON public.interview_prep_notes;
CREATE POLICY "Admin users can manage interview prep notes"
    ON public.interview_prep_notes FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin users can manage contact touchpoints" ON public.contact_touchpoints;
CREATE POLICY "Admin users can manage contact touchpoints"
    ON public.contact_touchpoints FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin users can manage proof of work highlights" ON public.proof_of_work_highlights;
CREATE POLICY "Admin users can manage proof of work highlights"
    ON public.proof_of_work_highlights FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP TRIGGER IF EXISTS update_company_watchlists_updated_at ON public.company_watchlists;
CREATE TRIGGER update_company_watchlists_updated_at
    BEFORE UPDATE ON public.company_watchlists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidate_evidence_items_updated_at ON public.candidate_evidence_items;
CREATE TRIGGER update_candidate_evidence_items_updated_at
    BEFORE UPDATE ON public.candidate_evidence_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_matches_updated_at ON public.job_matches;
CREATE TRIGGER update_job_matches_updated_at
    BEFORE UPDATE ON public.job_matches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_items_updated_at ON public.notification_items;
CREATE TRIGGER update_notification_items_updated_at
    BEFORE UPDATE ON public.notification_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_application_share_links_updated_at ON public.application_share_links;
CREATE TRIGGER update_application_share_links_updated_at
    BEFORE UPDATE ON public.application_share_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidate_answers_updated_at ON public.candidate_answers;
CREATE TRIGGER update_candidate_answers_updated_at
    BEFORE UPDATE ON public.candidate_answers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_interview_prep_notes_updated_at ON public.interview_prep_notes;
CREATE TRIGGER update_interview_prep_notes_updated_at
    BEFORE UPDATE ON public.interview_prep_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contact_touchpoints_updated_at ON public.contact_touchpoints;
CREATE TRIGGER update_contact_touchpoints_updated_at
    BEFORE UPDATE ON public.contact_touchpoints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_proof_of_work_highlights_updated_at ON public.proof_of_work_highlights;
CREATE TRIGGER update_proof_of_work_highlights_updated_at
    BEFORE UPDATE ON public.proof_of_work_highlights
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
