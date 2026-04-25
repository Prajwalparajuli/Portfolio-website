-- Phase 5: relationship CRM and company intelligence.
-- Extends company watchlists into dossier records, adds canonical career contacts,
-- and enriches touchpoints/notifications with contact-aware follow-up data.

ALTER TABLE public.company_watchlists
    ADD COLUMN IF NOT EXISTS why_this_company TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS research_notes TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS recent_news TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS competitors TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS salary_notes TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS last_researched_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.career_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_watchlist_id UUID REFERENCES public.company_watchlists(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL DEFAULT '',
    role_title TEXT NOT NULL DEFAULT '',
    organization_name TEXT NOT NULL DEFAULT '',
    relationship_kind TEXT NOT NULL DEFAULT 'networking'
        CHECK (relationship_kind IN ('recruiter', 'hiring_manager', 'employee', 'alumni', 'referral', 'networking', 'other')),
    email TEXT NOT NULL DEFAULT '',
    linkedin_url TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    introduced_by TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    next_follow_up_at TIMESTAMPTZ,
    last_contact_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_contacts_company_follow_up
    ON public.career_contacts (company_watchlist_id, next_follow_up_at ASC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_career_contacts_relationship
    ON public.career_contacts (relationship_kind, updated_at DESC);

ALTER TABLE public.notification_items
    ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.career_contacts(id) ON DELETE SET NULL;

ALTER TABLE public.notification_items
    DROP CONSTRAINT IF EXISTS notification_items_type_check;

ALTER TABLE public.notification_items
    ADD CONSTRAINT notification_items_type_check
        CHECK (type IN ('strong_match', 'sync_failure', 'follow_up_due', 'contact_follow_up', 'stale_application', 'system'));

CREATE INDEX IF NOT EXISTS idx_notification_items_contact_due
    ON public.notification_items (contact_id, due_at ASC, created_at DESC);

ALTER TABLE public.contact_touchpoints
    ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.career_contacts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS company_watchlist_id UUID REFERENCES public.company_watchlists(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS touchpoint_kind TEXT NOT NULL DEFAULT 'note'
        CHECK (touchpoint_kind IN ('outreach', 'reply', 'meeting', 'informational_interview', 'referral', 'recruiter_screen', 'thank_you', 'note')),
    ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'outbound'
        CHECK (direction IN ('outbound', 'inbound')),
    ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contact_touchpoints_contact_occurred
    ON public.contact_touchpoints (contact_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_touchpoints_company_occurred
    ON public.contact_touchpoints (company_watchlist_id, occurred_at DESC);

ALTER TABLE public.career_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin users can manage career contacts" ON public.career_contacts;
CREATE POLICY "Admin users can manage career contacts"
    ON public.career_contacts FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP TRIGGER IF EXISTS update_career_contacts_updated_at ON public.career_contacts;
CREATE TRIGGER update_career_contacts_updated_at
    BEFORE UPDATE ON public.career_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
