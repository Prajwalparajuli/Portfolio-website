import { corsHeaders, getServiceClient, json, requireAdminOrScheduler } from '../_shared/common.ts'
import { discoverCareerSource, handleSearch, SearchRequest } from '../_shared/job-search.ts'

type SearchSource = Required<SearchRequest>['source']

type WatchlistSourceHint =
  | 'auto'
  | 'greenhouse'
  | 'lever'
  | 'workday'
  | 'ashby'
  | 'smartrecruiters'
  | 'icims'
  | 'workable'
  | 'jobvite'
  | 'generic'

type ConnectorSource = Exclude<WatchlistSourceHint, 'auto' | 'generic'>

type WatchlistRow = {
  id: string
  company_name: string
  careers_url: string
  source_hint: WatchlistSourceHint
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
  source: SearchSource | 'manual'
  external_id: string
  watchlist_id: string | null
  saved_job_search_id: string | null
  query_label: string
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

type SavedSearchRow = {
  id: string
  name: string
  source: SearchSource
  board_or_site: string
  query: string
  location: string
  remote_only: boolean
  result_limit: number
  is_enabled: boolean
  last_run_at: string | null
  last_error: string
}

type SyncBody = {
  watchlistId?: string
  savedSearchId?: string
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

function isTimestampDue(value: string | null) {
  const now = chicagoNowParts()
  if (now.hour < 8) return false
  if (!value) return true
  return !value.startsWith(now.date)
}

function isDue(watchlist: WatchlistRow) {
  return isTimestampDue(watchlist.last_sync_at)
}

function isConnectorSource(sourceHint: WatchlistSourceHint): sourceHint is ConnectorSource {
  return sourceHint !== 'auto' && sourceHint !== 'generic'
}

function normalizeRequest(watchlist: WatchlistRow, sourceHint: ConnectorSource): Required<SearchRequest> {
  return {
    source: sourceHint,
    boardOrSite: watchlist.board_or_site,
    query: watchlist.preferred_query,
    location: watchlist.location_hint,
    remoteOnly: false,
    limit: 20,
  }
}

function normalizeSavedSearchRequest(savedSearch: SavedSearchRow): Required<SearchRequest> {
  return {
    source: savedSearch.source,
    boardOrSite: savedSearch.board_or_site,
    query: savedSearch.query,
    location: savedSearch.location,
    remoteOnly: savedSearch.remote_only,
    limit: savedSearch.result_limit,
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
    return service.from('job_postings').insert(payload).select('id').single()
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
      .select('id')
      .single()
  }

  return service.from('job_postings').insert(payload).select('id').single()
}

async function refreshImportedMatches(jobIds: string[]) {
  const uniqueJobIds = [...new Set(jobIds)].filter(Boolean)
  if (uniqueJobIds.length === 0) {
    return { skipped: true, jobsProcessed: 0, matchesUpdated: 0 }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!supabaseUrl || !cronSecret) {
    return { skipped: true, jobsProcessed: 0, matchesUpdated: 0 }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/jobs-match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
      },
      body: JSON.stringify({ jobIds: uniqueJobIds }),
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => ({})) as {
      data?: { jobsProcessed?: number; matchesUpdated?: number }
      error?: string
    }

    if (!response.ok) {
      throw new Error(payload.error || `Match refresh failed with status ${response.status}.`)
    }

    return {
      skipped: false,
      jobsProcessed: Number(payload.data?.jobsProcessed ?? 0),
      matchesUpdated: Number(payload.data?.matchesUpdated ?? 0),
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Match refresh timed out after 20s.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
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
    const body = await req.json().catch(() => ({})) as SyncBody
    const requestedWatchlistId = typeof body.watchlistId === 'string' && body.watchlistId ? body.watchlistId : ''
    const requestedSavedSearchId = typeof body.savedSearchId === 'string' && body.savedSearchId ? body.savedSearchId : ''
    const service = getServiceClient()

    const watchlistsResponse = requestedSavedSearchId
      ? { data: [], error: null }
      : await (
          requestedWatchlistId
            ? service.from('company_watchlists').select('*').eq('id', requestedWatchlistId).eq('is_enabled', true)
            : service.from('company_watchlists').select('*').eq('is_enabled', true)
        )
    if (watchlistsResponse.error) throw watchlistsResponse.error
    const watchlists = (watchlistsResponse.data ?? []) as WatchlistRow[]

    const savedSearchesResponse = requestedWatchlistId
      ? { data: [], error: null }
      : await (
          requestedSavedSearchId
            ? service.from('saved_job_searches').select('*').eq('id', requestedSavedSearchId).eq('is_enabled', true)
            : service.from('saved_job_searches').select('*').eq('is_enabled', true)
        )
    if (savedSearchesResponse.error) throw savedSearchesResponse.error
    const savedSearches = (savedSearchesResponse.data ?? []) as SavedSearchRow[]

    const dueWatchlists = requestedWatchlistId
      ? watchlists
      : watchlists.filter(isDue)
    const dueSavedSearches = requestedSavedSearchId
      ? savedSearches
      : savedSearches.filter((savedSearch) => isTimestampDue(savedSearch.last_run_at))

    const syncedIds: string[] = []
    const syncedSavedSearchIds: string[] = []
    const failures: string[] = []
    const importedJobIds = new Set<string>()
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

        if (isConnectorSource(sourceHint)) {
          const request = normalizeRequest({ ...watchlist, source_hint: sourceHint, board_or_site: boardOrSite }, sourceHint)
          const results = await handleSearch(request)

          for (const result of results) {
            const write = await saveImportedJob(service, {
              source: result.source,
              external_id: result.external_id,
              watchlist_id: watchlist.id,
              saved_job_search_id: null,
              query_label: watchlist.preferred_query,
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
            if (write.data?.id) importedJobIds.add(String(write.data.id))
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
            saved_job_search_id: null,
            query_label: watchlist.preferred_query,
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
            const insert = await service.from('job_postings').insert(snapshotPayload).select('id')
            if (insert.error) throw insert.error
            for (const row of insert.data ?? []) {
              if (row.id) importedJobIds.add(String(row.id))
            }
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

    for (const savedSearch of dueSavedSearches) {
      const startedAt = new Date().toISOString()
      const runInsert = await service
        .from('job_sync_runs')
        .insert({
          saved_job_search_id: savedSearch.id,
          watchlist_id: null,
          run_mode: requestedSavedSearchId ? 'single' : 'enabled_batch',
          status: 'running',
          source: savedSearch.source,
          label: savedSearch.name,
          board_or_site: savedSearch.board_or_site,
          query: savedSearch.query,
          location: savedSearch.location,
          discovery_status: '',
          discovered_source: '',
          failure_stage: '',
          result_count: 0,
          imported_count: 0,
          error_message: '',
          metadata: { remoteOnly: savedSearch.remote_only, resultLimit: savedSearch.result_limit },
          started_at: startedAt,
          completed_at: null,
        })
        .select('*')
        .single()
      if (runInsert.error) throw runInsert.error
      const runId = runInsert.data.id as string

      try {
        const request = normalizeSavedSearchRequest(savedSearch)
        const results = await handleSearch(request)
        let importedCount = 0

        for (const result of results) {
          const write = await saveImportedJob(service, {
            source: result.source,
            external_id: result.external_id,
            watchlist_id: null,
            saved_job_search_id: savedSearch.id,
            query_label: savedSearch.query,
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
          if (write.data?.id) importedJobIds.add(String(write.data.id))
          importedCount += 1
        }

        importedJobs += importedCount
        syncedSavedSearchIds.push(savedSearch.id)
        const completedAt = new Date().toISOString()

        const runUpdate = await service
          .from('job_sync_runs')
          .update({
            status: 'success',
            result_count: results.length,
            imported_count: importedCount,
            error_message: '',
            completed_at: completedAt,
          })
          .eq('id', runId)
        if (runUpdate.error) throw runUpdate.error

        const savedSearchUpdate = await service
          .from('saved_job_searches')
          .update({
            last_run_at: completedAt,
            last_error: '',
          })
          .eq('id', savedSearch.id)
        if (savedSearchUpdate.error) throw savedSearchUpdate.error
      } catch (error) {
        const message = getErrorMessage(error, 'Saved search sync failed.')
        failures.push(`${savedSearch.name || savedSearch.source}: ${message}`)
        const completedAt = new Date().toISOString()

        const runError = await service
          .from('job_sync_runs')
          .update({
            status: 'error',
            failure_stage: 'sync',
            error_message: message,
            completed_at: completedAt,
          })
          .eq('id', runId)
        if (runError.error) throw runError.error

        const savedSearchError = await service
          .from('saved_job_searches')
          .update({
            last_run_at: completedAt,
            last_error: message,
          })
          .eq('id', savedSearch.id)
        if (savedSearchError.error) throw savedSearchError.error
      }
    }

    let matchRefresh: Awaited<ReturnType<typeof refreshImportedMatches>> | null = null
    try {
      matchRefresh = await refreshImportedMatches([...importedJobIds])
    } catch (error) {
      const message = getErrorMessage(error, 'Match refresh failed.')
      failures.push(`Match refresh: ${message}`)
      matchRefresh = { skipped: true, jobsProcessed: 0, matchesUpdated: 0 }
    }

    return json(200, {
      data: {
        scheduledAt: new Date().toISOString(),
        watchlistsProcessed: dueWatchlists.length,
        watchlistsSynced: syncedIds.length,
        savedSearchesProcessed: dueSavedSearches.length,
        savedSearchesSynced: syncedSavedSearchIds.length,
        importedJobs,
        matchRefresh,
        failures,
      },
    })
  } catch (error) {
    console.error('jobs-sync-scheduler error', error)
    const message = getErrorMessage(error)
    return json(500, { error: message })
  }
})
