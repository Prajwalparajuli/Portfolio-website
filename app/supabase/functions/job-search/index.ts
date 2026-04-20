import { corsHeaders, json, requireAdminUser } from '../_shared/common.ts'
import { handleSearch, parseRequest, SearchRequest } from '../_shared/job-search.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' })
  }

  const authResult = await requireAdminUser(req)
  if (!authResult.user) {
    if (authResult.reason === 'admin-table-missing') {
      return json(503, {
        error: 'Admin access is not configured yet. Run the admin hardening SQL migration and add your email to public.admin_users.',
      })
    }

    return json(403, { error: 'Authenticated admin access required.' })
  }

  try {
    const request = parseRequest(await req.json() as SearchRequest)
    const results = await handleSearch(request)
    return json(200, { data: { results } })
  } catch (error) {
    console.error('job-search error', error)
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return json(500, { error: message })
  }
})
