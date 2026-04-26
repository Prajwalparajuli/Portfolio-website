import { corsHeaders, getServiceClient, json, requireAdminUser } from '../_shared/common.ts'
import { extractJobPostingFromUrl, type JobUrlMetadata } from '../_shared/job-search.ts'

type JobRow = Record<string, unknown> & {
  id: string
  fit_notes?: string
}

type ApplicationRow = Record<string, unknown> & {
  id: string
}

type IntakeBody = {
  jobUrl?: string
  job_url?: string
  createApplication?: boolean
  create_application?: boolean
}

function shouldCreateApplication(body: IntakeBody) {
  if (typeof body.createApplication === 'boolean') return body.createApplication
  if (typeof body.create_application === 'boolean') return body.create_application
  return true
}

function buildJobPayload(metadata: JobUrlMetadata) {
  return {
    source: 'manual',
    external_id: metadata.external_id,
    watchlist_id: null,
    saved_job_search_id: null,
    query_label: 'URL intake',
    title: metadata.title,
    company: metadata.company,
    location: metadata.location,
    remote_type: metadata.remote_type,
    employment_type: metadata.employment_type,
    salary_range: metadata.salary_range,
    job_url: metadata.job_url,
    description: metadata.description,
    fit_notes: '',
    discovery_status: 'discovered',
    source_text: 'job_url_intake',
    embedding_updated_at: null,
    archived_at: null,
  }
}

async function findExistingJob(
  service: ReturnType<typeof getServiceClient>,
  metadata: JobUrlMetadata,
) {
  const byUrl = await service
    .from('job_postings')
    .select('*')
    .eq('job_url', metadata.job_url)
    .maybeSingle()

  if (byUrl.error) throw byUrl.error
  if (byUrl.data) return byUrl.data as JobRow

  if (!metadata.external_id) return null

  const byExternalId = await service
    .from('job_postings')
    .select('*')
    .eq('source', 'manual')
    .eq('external_id', metadata.external_id)
    .maybeSingle()

  if (byExternalId.error) throw byExternalId.error
  return (byExternalId.data ?? null) as JobRow | null
}

async function upsertJob(
  service: ReturnType<typeof getServiceClient>,
  metadata: JobUrlMetadata,
) {
  const payload = buildJobPayload(metadata)
  const existing = await findExistingJob(service, metadata)

  if (existing) {
    const { data, error } = await service
      .from('job_postings')
      .update({
        ...payload,
        source: existing.source ?? payload.source,
        external_id: existing.external_id || payload.external_id,
        watchlist_id: existing.watchlist_id ?? payload.watchlist_id,
        saved_job_search_id: existing.saved_job_search_id ?? payload.saved_job_search_id,
        query_label: existing.query_label || payload.query_label,
        source_text: existing.source_text || payload.source_text,
        fit_notes: existing.fit_notes ?? '',
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) throw error
    return { job: data as JobRow, created: false }
  }

  const { data, error } = await service
    .from('job_postings')
    .insert(payload)
    .select('*')
    .single()

  if (error) throw error
  return { job: data as JobRow, created: true }
}

async function createOrGetApplication(
  service: ReturnType<typeof getServiceClient>,
  jobId: string,
) {
  const existing = await service
    .from('applications')
    .select('*')
    .eq('job_posting_id', jobId)
    .maybeSingle()

  if (existing.error) throw existing.error
  if (existing.data) return { application: existing.data as ApplicationRow, created: false }

  const primaryVariant = await service
    .from('resume_variants')
    .select('id')
    .eq('is_primary', true)
    .limit(1)
    .maybeSingle()

  if (primaryVariant.error) throw primaryVariant.error

  const { data, error } = await service
    .from('applications')
    .insert({
      job_posting_id: jobId,
      resume_variant_id: primaryVariant.data?.id ?? null,
      status: 'saved',
      follow_up_at: null,
      applied_at: null,
      notes: '',
      cover_letter: '',
    })
    .select('*')
    .single()

  if (error) throw error
  return { application: data as ApplicationRow, created: true }
}

async function refreshJobMatch(jobId: string, token: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey || !token) {
    return { skipped: true, jobsProcessed: 0, matchesUpdated: 0 }
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/jobs-match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jobIds: [jobId] }),
    })

    if (!response.ok) {
      return { skipped: true, jobsProcessed: 0, matchesUpdated: 0 }
    }

    const payload = await response.json().catch(() => null) as {
      data?: { jobsProcessed?: number; matchesUpdated?: number }
    } | null
    return {
      skipped: false,
      jobsProcessed: payload?.data?.jobsProcessed ?? 0,
      matchesUpdated: payload?.data?.matchesUpdated ?? 0,
    }
  } catch {
    return { skipped: true, jobsProcessed: 0, matchesUpdated: 0 }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' })
  }

  const auth = await requireAdminUser(req)
  if (!auth.user) {
    if (auth.reason === 'admin-table-missing') {
      return json(503, {
        error: 'Admin access is not configured yet. Run the admin hardening SQL migration and add your email to public.admin_users.',
      })
    }
    return json(403, { error: 'Authenticated admin access required.' })
  }

  try {
    const body = await req.json().catch(() => ({})) as IntakeBody
    const jobUrl = (body.jobUrl || body.job_url || '').trim()
    if (!jobUrl) return json(400, { error: 'jobUrl is required.' })

    const metadata = await extractJobPostingFromUrl(jobUrl)
    const service = getServiceClient()
    const { job, created: createdJob } = await upsertJob(service, metadata)
    const applicationResult = shouldCreateApplication(body)
      ? await createOrGetApplication(service, job.id)
      : { application: null as ApplicationRow | null, created: false }
    const matchRefresh = await refreshJobMatch(job.id, auth.token)

    return json(200, {
      data: {
        job,
        application: applicationResult.application,
        createdJob,
        createdApplication: applicationResult.created,
        matchRefresh,
      },
    })
  } catch (error) {
    console.error('job-url-intake error', error)
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return json(500, { error: message })
  }
})
