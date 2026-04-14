-- Restrict admin capabilities to an explicit email allowlist.
-- Run this in Supabase SQL editor after creating your intended admin user.

CREATE TABLE IF NOT EXISTS public.admin_users (
    email TEXT PRIMARY KEY CHECK (email = lower(email)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT lower(COALESCE(auth.jwt() ->> 'email', ''));
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE email = public.current_user_email()
    );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_email() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO anon, authenticated;

DROP POLICY IF EXISTS "Users can read own admin allowlist row" ON public.admin_users;
CREATE POLICY "Users can read own admin allowlist row"
    ON public.admin_users FOR SELECT
    TO authenticated
    USING (email = public.current_user_email());

DROP POLICY IF EXISTS "Authenticated users can manage projects" ON public.projects;
CREATE POLICY "Authenticated users can manage projects"
    ON public.projects FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Authenticated users can manage skills" ON public.skills;
CREATE POLICY "Authenticated users can manage skills"
    ON public.skills FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Authenticated users can manage settings" ON public.settings;
CREATE POLICY "Authenticated users can manage settings"
    ON public.settings FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Authenticated users can manage project images" ON public.project_images;
CREATE POLICY "Authenticated users can manage project images"
    ON public.project_images FOR ALL
    TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Authenticated users can insert activity" ON public.admin_activity;
CREATE POLICY "Authenticated users can insert activity"
    ON public.admin_activity FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Authenticated users can read activity" ON public.admin_activity;
CREATE POLICY "Authenticated users can read activity"
    ON public.admin_activity FOR SELECT
    TO authenticated
    USING (public.is_admin_user());

DROP POLICY IF EXISTS "Authenticated users can read contact messages" ON public.contact_messages;
CREATE POLICY "Authenticated users can read contact messages"
    ON public.contact_messages FOR SELECT
    TO authenticated
    USING (public.is_admin_user());

DROP POLICY IF EXISTS "Authenticated users can upload project covers" ON storage.objects;
CREATE POLICY "Authenticated users can upload project covers"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'project-covers' AND public.is_admin_user());

DROP POLICY IF EXISTS "Authenticated users can upload project gallery" ON storage.objects;
CREATE POLICY "Authenticated users can upload project gallery"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'project-gallery' AND public.is_admin_user());

DROP POLICY IF EXISTS "Authenticated users can upload resume" ON storage.objects;
CREATE POLICY "Authenticated users can upload resume"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'resume' AND public.is_admin_user());

DROP POLICY IF EXISTS "Authenticated users can delete project covers" ON storage.objects;
CREATE POLICY "Authenticated users can delete project covers"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'project-covers' AND public.is_admin_user());

DROP POLICY IF EXISTS "Authenticated users can delete project gallery" ON storage.objects;
CREATE POLICY "Authenticated users can delete project gallery"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'project-gallery' AND public.is_admin_user());

DROP POLICY IF EXISTS "Authenticated users can delete resume" ON storage.objects;
CREATE POLICY "Authenticated users can delete resume"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'resume' AND public.is_admin_user());
