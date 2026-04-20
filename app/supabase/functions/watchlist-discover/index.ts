import { corsHeaders, getServiceClient, json, requireAdminOrScheduler } from '../_shared/common.ts'
import { discoverCareerSource } from '../_shared/job-search.ts'

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
    const body = await req.json().catch(() => ({})) as { watchlistId?: string; careersUrl?: string }
    const service = getServiceClient()

    let watchlistId = typeof body.watchlistId === 'string' ? body.watchlistId : ''
    let careersUrl = typeof body.careersUrl === 'string' ? body.careersUrl.trim() : ''

    if (watchlistId && !careersUrl) {
      const watchlistQuery = await service
        .from('company_watchlists')
        .select('id,careers_url')
        .eq('id', watchlistId)
        .single()
      if (watchlistQuery.error) throw watchlistQuery.error
      careersUrl = watchlistQuery.data.careers_url
    }

    if (!careersUrl) {
      throw new Error('A careers URL is required for watchlist discovery.')
    }

    const discovered = await discoverCareerSource(careersUrl)
    const now = new Date().toISOString()

    if (watchlistId) {
      const update = await service
        .from('company_watchlists')
        .update({
          source_hint: discovered.sourceHint,
          board_or_site: discovered.boardOrSite,
          last_discovery_at: now,
          last_error: '',
        })
        .eq('id', watchlistId)
      if (update.error) throw update.error
    }

    return json(200, {
      data: {
        watchlistId: watchlistId || null,
        sourceHint: discovered.sourceHint,
        boardOrSite: discovered.boardOrSite,
        snapshotJobs: discovered.snapshotJobs,
        notes: discovered.notes,
        discoveredAt: now,
      },
    })
  } catch (error) {
    console.error('watchlist-discover error', error)
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return json(500, { error: message })
  }
})
