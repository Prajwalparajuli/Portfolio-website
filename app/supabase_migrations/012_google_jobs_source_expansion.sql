ALTER TABLE public.job_postings
    DROP CONSTRAINT IF EXISTS job_postings_source_check;

ALTER TABLE public.job_postings
    ADD CONSTRAINT job_postings_source_check
        CHECK (
            source IN (
                'manual',
                'greenhouse',
                'lever',
                'usajobs',
                'workday',
                'ashby',
                'smartrecruiters',
                'icims',
                'workable',
                'jobvite',
                'adzuna',
                'google_jobs'
            )
        );

ALTER TABLE public.saved_job_searches
    DROP CONSTRAINT IF EXISTS saved_job_searches_source_check;

ALTER TABLE public.saved_job_searches
    ADD CONSTRAINT saved_job_searches_source_check
        CHECK (
            source IN (
                'greenhouse',
                'lever',
                'usajobs',
                'workday',
                'ashby',
                'smartrecruiters',
                'icims',
                'workable',
                'jobvite',
                'adzuna',
                'google_jobs'
            )
        );

ALTER TABLE public.job_sync_runs
    DROP CONSTRAINT IF EXISTS job_sync_runs_source_check;

ALTER TABLE public.job_sync_runs
    ADD CONSTRAINT job_sync_runs_source_check
        CHECK (
            source IN (
                'greenhouse',
                'lever',
                'usajobs',
                'workday',
                'ashby',
                'smartrecruiters',
                'icims',
                'workable',
                'jobvite',
                'adzuna',
                'google_jobs',
                'generic'
            )
        );
