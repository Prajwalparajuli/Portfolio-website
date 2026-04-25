ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS structured_narrative JSONB;
