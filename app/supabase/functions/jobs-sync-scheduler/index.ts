import { corsHeaders, getServiceClient, json, requireAdminOrScheduler } from '../_shared/common.ts'
import { discoverCareerSource, handleSearch, SearchRequest } from '../_shared/job-search.ts'

type WatchlistRow = {
  id: string
  company_name: string
  careers_url: string
  source_hint: 'auto' | 'greenhouse' | 'lever' | 'generic'
  board_or_site: string
  preferred_query: string
  location_hint: string
  priority: 'high' | 'medium' | 'low'
  is_enabled: boolean
  last_discovery_at: string | null
  last_sync_at: string | null
  last_error: string
}

type ImportedJobPayload = {
  source: 'greenhouse' | 'lever' | 'usajobs' | 'manual'
  external_id: string
  watchlist_id: string
  title: string
  company: string
  location: string
  remote_type: 'remote' | 'hybrid' | 'onsite' | 'unknown'
  employment_type: string
  salary_range: string
  job_url: string
  description: string
  fit_notes: string
  discovery_status: 'discovered' | 'snapshot'
  source_text: string
}

function chicagoNowParts() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(new Date())
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    date: `${lookup.year}-${lookup.month}-${lookup.day}`,
    hour: Number(lookup.hour ?? '0'),
  }
}

function isDue(watchlist: WatchlistRow) {
  const now = chicagoNowParts()
  if (now.hour < 8) return false
  if (!watchlist.last_sync_at) return true
  return !watchlist.last_sync_at.startsWith(now.date)
}

function normalizeRequest(watchlist: WatchlistRow, sourceHint: 'greenhouse' | 'lever'): Required<SearchRequest> {
  return {
    source: sourceHint,
    boardOrSite: watchlist.board_or_site,
    query: watchlist.preferred_query,
    location: watchlist.location_hint,
    remoteOnly: false,
    limit: 20,
  }
}

function getErrorMessage(error: unknown, fallback = 'Unexpected error.') {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return fallback
}

async function saveImportedJob(
  service: ReturnType<typeof getServiceClient>,
  payload: ImportedJobPayload
) {
  if (!payload.external_id) {
    return service.from('job_postings').insert(payload)
  }

  const existing = await service
    .from('job_postings')
    .select('id')
    .eq('source', payload.source)
    .eq('external_id', payload.external_id)
    .maybeSingle()

  if (existing.error) throw existing.error

  if (existing.data?.id) {
    return service
      .from('job_postings')
      .update(payload)
      .eq('id', existing.data.id)
  }

  return service.from('job_postings').insert(payload)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' })
  }

  const auth = await requireAdminOrScheduler(req)
  if (auth.kind === 'unauthorized') {
    if (auth.reason === 'admin-table-missing') {
      return json(503, {
        error: 'Admin access is not configured yet. Run the admin hardening SQL migration and add your email to public.admin_users.',
      })
    }
    return json(403, { error: 'Authenticated admin access required.' })
  }

  try {
    const body = await req.json().catch(() => ({})) as { watchlistId?: string }
    const service = getServiceClient()
    const watchlistsQuery = typeof body.watchlistId === 'string' && body.watchlistId
      ? service.from('company_watchlists').select('*').eq('id', body.watchlistId).eq('is_enabled', true)
      : service.from('company_watchlists').select('*').eq('is_enabled', true)
    const watchlistsResponse = await watchlistsQuery
    if (watchlistsResponse.error) throw watchlistsResponse.error
    const watchlists = (watchlistsResponse.data ?? []) as WatchlistRow[]

    const dueWatchlists = typeof body.watchlistId === 'string' && body.watchlistId
      ? watchlists
      : watchlists.filter(isDue)

    const syncedIds: string[] = []
    const failures: string[] = []
    let importedJobs = 0

    for (const watchlist of dueWatchlists) {
      const startedAt = new Date().toISOString()
      const runInsert = await service
        .from('job_sync_runs')
        .insert({
          saved_job_search_id: null,
          watchlist_id: watchlist.id,
          run_mode: 'enabled_batch',
          status: 'running',
          source: 'generic',
          label: watchlist.company_name,
          board_or_site: watchlist.board_or_site,
          query: watchlist.preferred_query,
          location: watchlist.location_hint,
          discovery_status: 'starting',
          discovered_source: '',
          failure_stage: '',
          result_count: 0,
          imported_count: 0,
          error_message: '',
          metadata: {},
          started_at: startedAt,
          completed_at: null,
        })
        .select('*')
        .single()
      if (runInsert.error) throw runInsert.error
      const runId = runInsert.data.id as string

      try {
        let sourceHint = watchlist.source_hint
        let boardOrSite = watchlist.board_or_site
        let snapshotJobs: Array<{ title: string; url: string; location: string }> = []
        let discoveryNotes = ''

        if (sourceHint === 'auto' || (sourceHint === 'generic' && !boardOrSite)) {
          const discovered = await discoverCareerSource(watchlist.careers_url)
          sourceHint = discovered.sourceHint
          boardOrSite = discovered.boardOrSite
          snapshotJobs = discovered.snapshotJobs
          discoveryNotes = discovered.notes

          const watchlistUpdate = await service
            .from('company_watchlists')
            .update({
              source_hint: sourceHint,
              board_or_site: boardOrSite,
              last_discovery_at: new Date().toISOString(),
            })
            .eq('id', watchlist.id)
          if (watchlistUpdate.error) throw watchlistUpdate.error
        }

        if (sourceHint === 'greenhouse' || sourceHint === 'lever') {
          const request = normalizeRequest({ ...watchlist, source_hint: sourceHint, board_or_site: boardOrSite }, sourceHint)
          const results = await handleSearch(request)

          for (const result of results) {
            const write = await saveImportedJob(service, {
              source: result.source,
              external_id: result.external_id,
              watchlist_id: watchlist.id,
              title: result.title,
              company: result.company,
              location: result.location,
              remote_type: result.remote_type,
              employment_type: result.employment_type,
              salary_range: result.salary_range,
              job_url: result.job_url,
              description: result.description,
              fit_notes: `Imported from ${result.source_label}`,
              discovery_status: 'discovered',
              source_text: '',
            })
            if (write.error) throw write.error
          }

          importedJobs += results.length
          syncedIds.push(watchlist.id)

          const runUpdate = await service
            .from('job_sync_runs')
            .update({
              status: 'success',
              source: sourceHint,
              board_or_site: boardOrSite,
              discovery_status: 'discovered',
              discovered_source: sourceHint,
              result_count: results.length,
              imported_count: results.length,
              metadata: { discoveryNotes },
              completed_at: new Date().toISOString(),
            })
            .eq('id', runId)
          if (runUpdate.error) throw runUpdate.error
        } else {
          const snapshotPayload = snapshotJobs.map((job) => ({
            source: 'manual',
            external_id: '',
            watchlist_id: watchlist.id,
            title: job.title,
            company: watchlist.company_name,
            location: job.location,
            remote_type: 'unknown',
            employment_type: '',
            salary_range: '',
            job_url: job.url,
            description: `Snapshot from ${watchlist.careers_url}`,
            fit_notes: 'Snapshot role discovered from unsupported careers page.',
            discovery_status: 'snapshot',
            source_text: '',
          }))
          if (snapshotPayload.length > 0) {
            const insert = await service.from('job_postings').insert(snapshotPayload)
            if (insert.error) throw insert.error
            importedJobs += snapshotPayload.length
          }
          syncedIds.push(watchlist.id)

          const runUpdate = await service
            .from('job_sync_runs')
            .update({
              status: 'success',
              source: 'generic',
              discovery_status: snapshotPayload.length > 0 ? 'snapshot' : 'unsupported',
              discovered_source: 'generic',
              result_count: snapshotPayload.length,
              imported_count: snapshotPayload.length,
              metadata: { discoveryNotes, snapshotCount: snapshotPayload.length },
              completed_at: new Date().toISOString(),
            })
            .eq('id', runId)
          if (runUpdate.error) throw runUpdate.error
        }

        const watchlistSuccess = await service
          .from('company_watchlists')
          .update({
            board_or_site: boardOrSite,
            source_hint: sourceHint,
            last_sync_at: new Date().toISOString(),
            last_error: '',
          })
          .eq('id', watchlist.id)
        if (watchlistSuccess.error) throw watchlistSuccess.error
      } catch (error) {
        const message = getErrorMessage(error, 'Sync failed.')
        failures.push(`${watchlist.company_name}: ${message}`)
        const runError = await service
          .from('job_sync_runs')
          .update({
            status: 'error',
            failure_stage: 'sync',
            error_message: message,
            completed_at: new Date().toISOString(),
          })
          .eq('id', runId)
        if (runError.error) throw runError.error

        const watchlistError = await service
          .from('company_watchlists')
          .update({
            last_error: message,
          })
          .eq('id', watchlist.id)
        if (watchlistError.error) throw watchlistError.error
      }
    }

    return json(200, {
      data: {
        scheduledAt: new Date().toISOString(),
        watchlistsProcessed: dueWatchlists.length,
        watchlistsSynced: syncedIds.length,
        importedJobs,
        failures,
      },
    })
  } catch (error) {
    console.error('jobs-sync-scheduler error', error)
    const message = getErrorMessage(error)
    return json(500, { error: message })
  }
})
