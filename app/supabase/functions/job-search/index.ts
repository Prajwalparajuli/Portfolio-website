import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type SearchSource = 'greenhouse' | 'lever' | 'usajobs'
type RemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown'

type SearchRequest = {
  source: SearchSource
  query?: string
  location?: string
  boardOrSite?: string
  remoteOnly?: boolean
  limit?: number
}

type SearchResult = {
  source: SearchSource
  external_id: string
  source_label: string
  title: string
  company: string
  location: string
  remote_type: RemoteType
  employment_type: string
  salary_range: string
  job_url: string
  description: string
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function isMissingAdminTable(error: { code?: string; message?: string } | null) {
  return error?.code === '42P01' || /admin_users|relation .* does not exist/i.test(error?.message ?? '')
}

async function requireAdminUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!authHeader || !supabaseUrl || !supabaseAnonKey) {
    return { user: null, reason: 'missing-auth' as const }
  }

  const token = authHeader.replace(/^Bearer\s+/i, '')
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    return { user: null, reason: 'invalid-user' as const }
  }

  const email = data.user.email?.trim().toLowerCase()
  if (!email) {
    return { user: null, reason: 'missing-email' as const }
  }

  const rlsClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  const { data: adminRow, error: adminError } = await rlsClient
    .from('admin_users')
    .select('email')
    .eq('email', email)
    .maybeSingle()

  if (isMissingAdminTable(adminError)) {
    return { user: null, reason: 'admin-table-missing' as const }
  }

  if (adminError || !adminRow) {
    return { user: null, reason: 'not-admin' as const }
  }

  return { user: data.user, reason: null as const }
}

function parseRequest(body: unknown): Required<SearchRequest> {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body.')
  }

  const payload = body as Record<string, unknown>
  const source = payload.source
  if (source !== 'greenhouse' && source !== 'lever' && source !== 'usajobs') {
    throw new Error('Unsupported search source.')
  }

  const query = typeof payload.query === 'string' ? payload.query.trim() : ''
  const location = typeof payload.location === 'string' ? payload.location.trim() : ''
  const boardOrSite = typeof payload.boardOrSite === 'string' ? payload.boardOrSite.trim() : ''
  const remoteOnly = payload.remoteOnly === true
  const limit = Math.max(1, Math.min(50, typeof payload.limit === 'number' ? payload.limit : 20))

  if ((source === 'greenhouse' || source === 'lever') && !boardOrSite) {
    throw new Error('Board token or site name is required for this source.')
  }

  if (source === 'usajobs' && !query && !location) {
    throw new Error('USAJobs search requires at least a keyword or location.')
  }

  return {
    source,
    query,
    location,
    boardOrSite,
    remoteOnly,
    limit,
  }
}

async function handleSearch(request: Required<SearchRequest>): Promise<SearchResult[]> {
  switch (request.source) {
    case 'greenhouse':
      return searchGreenhouse(request)
    case 'lever':
      return searchLever(request)
    case 'usajobs':
      return searchUsaJobs(request)
  }
}

async function searchGreenhouse(request: Required<SearchRequest>): Promise<SearchResult[]> {
  const boardToken = extractGreenhouseBoardToken(request.boardOrSite)
  if (!boardToken) {
    throw new Error('Could not determine the Greenhouse board token.')
  }

  const [boardRes, jobsRes] = await Promise.all([
    fetch(`https://boards-api.greenhouse.io/v1/boards/${boardToken}`),
    fetch(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`),
  ])

  if (!jobsRes.ok) {
    throw new Error(`Greenhouse search failed with status ${jobsRes.status}.`)
  }

  const boardData = boardRes.ok
    ? (await boardRes.json().catch(() => null) as { name?: string } | null)
    : null
  const jobsPayload = (await jobsRes.json()) as { jobs?: Array<Record<string, unknown>> }
  const company = boardData?.name?.trim() || humanizeToken(boardToken)

  const normalized = (jobsPayload.jobs ?? []).map((job) => {
    const description = summarizeDescription(asString(job.content))
    const location = readGreenhouseLocation(job)
    return {
      source: 'greenhouse' as const,
      external_id: String(job.id ?? ''),
      source_label: `Greenhouse / ${boardToken}`,
      title: asString(job.title),
      company,
      location,
      remote_type: guessRemoteType([location, description]),
      employment_type: inferEmploymentType([asString(job.title), description]),
      salary_range: '',
      job_url: asString(job.absolute_url),
      description,
    }
  })

  return rankAndLimit(normalized, request)
}

async function searchLever(request: Required<SearchRequest>): Promise<SearchResult[]> {
  const site = extractLeverSite(request.boardOrSite)
  if (!site) {
    throw new Error('Could not determine the Lever site name.')
  }

  const params = new URLSearchParams({ mode: 'json' })
  if (request.location) params.set('location', request.location)
  const response = await fetch(`https://api.lever.co/v0/postings/${site}?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`Lever search failed with status ${response.status}.`)
  }

  const payload = (await response.json()) as Array<Record<string, unknown>>
  const company = humanizeToken(site)

  const normalized = payload.map((posting) => {
    const categories = asObject(posting.categories)
    const location = asString(categories?.location) || asString(posting.country) || ''
    const description = summarizeDescription(
      [asString(posting.descriptionPlain), asString(posting.additionalPlain)]
        .filter(Boolean)
        .join('\n\n')
    )
    const salaryRange = formatLeverSalaryRange(asObject(posting.salaryRange))
    const workplaceType = asString(posting.workplaceType)

    return {
      source: 'lever' as const,
      external_id: asString(posting.id),
      source_label: `Lever / ${site}`,
      title: asString(posting.text),
      company,
      location,
      remote_type: mapLeverRemoteType(workplaceType, location, description),
      employment_type: asString(categories?.commitment) || inferEmploymentType([asString(posting.text), description]),
      salary_range: salaryRange,
      job_url: asString(posting.applyUrl) || asString(posting.hostedUrl),
      description,
    }
  })

  return rankAndLimit(normalized, request)
}

async function searchUsaJobs(request: Required<SearchRequest>): Promise<SearchResult[]> {
  const apiKey = Deno.env.get('USAJOBS_API_KEY')
  const userAgent = Deno.env.get('USAJOBS_USER_AGENT')

  if (!apiKey || !userAgent) {
    throw new Error('USAJobs search is not configured. Set USAJOBS_API_KEY and USAJOBS_USER_AGENT in Supabase secrets.')
  }

  const params = new URLSearchParams({
    ResultsPerPage: String(request.limit),
    WhoMayApply: 'public',
    SortField: 'openingdate',
    SortDirection: 'Desc',
  })

  if (request.query) params.set('Keyword', request.query)
  if (request.location) params.set('LocationName', request.location)
  if (request.remoteOnly) params.set('RemoteIndicator', 'True')

  const response = await fetch(`https://data.usajobs.gov/api/search?${params.toString()}`, {
    headers: {
      Host: 'data.usajobs.gov',
      'User-Agent': userAgent,
      'Authorization-Key': apiKey,
    },
  })

  if (!response.ok) {
    throw new Error(`USAJobs search failed with status ${response.status}.`)
  }

  const payload = (await response.json()) as {
    SearchResult?: {
      SearchResultItems?: Array<{
        MatchedObjectId?: string
        MatchedObjectDescriptor?: Record<string, unknown>
      }>
    }
  }

  const normalized = (payload.SearchResult?.SearchResultItems ?? []).map((item) => {
    const descriptor = asObject(item.MatchedObjectDescriptor)
    const userArea = asObject(descriptor?.UserArea)
    const details = asObject(userArea?.Details)
    const positionRemuneration = Array.isArray(descriptor?.PositionRemuneration)
      ? descriptor.PositionRemuneration[0]
      : null
    const remuneration = asObject(positionRemuneration)
    const location = asString(descriptor?.PositionLocationDisplay)
      || readUsaJobsLocation(descriptor?.PositionLocation)
    const description = summarizeDescription(asString(details?.JobSummary))
    const applyUri = firstString(descriptor?.ApplyURI)
    const jobUri = firstString(descriptor?.PositionURI)

    return {
      source: 'usajobs' as const,
      external_id: String(item.MatchedObjectId ?? ''),
      source_label: 'USAJobs',
      title: asString(descriptor?.PositionTitle),
      company: asString(descriptor?.OrganizationName) || 'USAJobs',
      location,
      remote_type: request.remoteOnly ? 'remote' : guessRemoteType([location, description]),
      employment_type: firstString(details?.PositionSchedule) || inferEmploymentType([asString(descriptor?.PositionTitle), description]),
      salary_range: formatUsaJobsSalary(remuneration),
      job_url: applyUri || jobUri,
      description,
    }
  })

  return rankAndLimit(normalized, request)
}

function rankAndLimit(results: SearchResult[], request: Required<SearchRequest>): SearchResult[] {
  const queryTerms = tokenize(request.query)
  const locationTerms = tokenize(request.location)

  const scored = results
    .map((result) => {
      const haystack = normalizeText([
        result.title,
        result.company,
        result.location,
        result.employment_type,
        result.description,
      ].join(' '))

      let score = 0
      let queryMatches = 0

      for (const term of queryTerms) {
        if (haystack.includes(term)) {
          score += term.length > 5 ? 4 : 3
          queryMatches += 1
        }
      }

      for (const term of locationTerms) {
        if (normalizeText(result.location).includes(term)) {
          score += 3
        }
      }

      if (request.remoteOnly && result.remote_type === 'remote') score += 4
      if (result.remote_type === 'hybrid') score += 1
      if (queryTerms.length === 0) score += 1

      return { result, score, queryMatches }
    })
    .filter(({ score, queryMatches }) => {
      if (queryTerms.length === 0) return true
      if (queryTerms.length <= 2) return queryMatches >= 1
      return queryMatches >= Math.max(1, Math.ceil(queryTerms.length / 2))
    })
    .sort((left, right) => right.score - left.score || left.result.title.localeCompare(right.result.title))
    .slice(0, request.limit)

  return scored.map(({ result }) => result)
}

function extractGreenhouseBoardToken(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (!trimmed.includes('/')) return sanitizeToken(trimmed)

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const parts = url.pathname.split('/').filter(Boolean)

    if (url.hostname.includes('boards-api.greenhouse.io')) {
      const index = parts.findIndex((part) => part === 'boards')
      return sanitizeToken(index >= 0 ? parts[index + 1] ?? '' : '')
    }

    if (url.hostname.includes('greenhouse.io')) {
      return sanitizeToken(parts[0] ?? '')
    }
  } catch {
    return ''
  }

  return ''
}

function extractLeverSite(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (!trimmed.includes('/')) return sanitizeToken(trimmed)

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const parts = url.pathname.split('/').filter(Boolean)

    if (url.hostname.startsWith('api.')) {
      const index = parts.findIndex((part) => part === 'postings')
      return sanitizeToken(index >= 0 ? parts[index + 1] ?? '' : '')
    }

    if (url.hostname.includes('lever.co')) {
      return sanitizeToken(parts[0] ?? '')
    }
  } catch {
    return ''
  }

  return ''
}

function sanitizeToken(value: string): string {
  return value.trim().replace(/[^a-z0-9_-]/gi, '')
}

function humanizeToken(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function readGreenhouseLocation(job: Record<string, unknown>): string {
  const direct = asObject(job.location)
  if (direct && asString(direct.name)) return asString(direct.name)

  const offices = Array.isArray(job.offices) ? job.offices : []
  const firstOffice = offices.find((office) => Boolean(asObject(office)?.name))
  return asString(asObject(firstOffice)?.name)
}

function readUsaJobsLocation(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value
    .map((entry) => asString(asObject(entry)?.LocationName))
    .filter(Boolean)
    .join(', ')
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function firstString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!Array.isArray(value)) return ''
  const match = value.find((entry) => typeof entry === 'string' && entry.trim())
  return typeof match === 'string' ? match.trim() : ''
}

function summarizeDescription(value: string): string {
  const normalized = stripHtml(decodeHtmlEntities(value))
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return ''
  return normalized.length > 2200 ? `${normalized.slice(0, 2200).trim()}...` : normalized
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ')
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
  }

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
}

function guessRemoteType(parts: string[]): RemoteType {
  const haystack = normalizeText(parts.join(' '))
  if (/\bremote\b/.test(haystack)) return 'remote'
  if (/\bhybrid\b/.test(haystack)) return 'hybrid'
  if (/\bonsite\b|\bon site\b/.test(haystack)) return 'onsite'
  return 'unknown'
}

function inferEmploymentType(parts: string[]): string {
  const haystack = normalizeText(parts.join(' '))
  if (/\bcontract\b/.test(haystack)) return 'Contract'
  if (/\bintern(ship)?\b/.test(haystack)) return 'Internship'
  if (/\bpart time\b|\bpart-time\b/.test(haystack)) return 'Part-time'
  if (/\btemporary\b/.test(haystack)) return 'Temporary'
  if (/\bfull time\b|\bfull-time\b/.test(haystack)) return 'Full-time'
  return ''
}

function mapLeverRemoteType(workplaceType: string, location: string, description: string): RemoteType {
  if (workplaceType === 'remote') return 'remote'
  if (workplaceType === 'hybrid') return 'hybrid'
  if (workplaceType === 'on-site') return 'onsite'
  return guessRemoteType([location, description])
}

function formatLeverSalaryRange(value: Record<string, unknown> | null): string {
  if (!value) return ''
  const currency = asString(value.currency)
  const interval = asString(value.interval)
  const min = typeof value.min === 'number' ? value.min : Number(value.min)
  const max = typeof value.max === 'number' ? value.max : Number(value.max)

  if (!Number.isFinite(min) || !Number.isFinite(max)) return ''

  const formatted = `${currency}${Math.round(min).toLocaleString()} - ${currency}${Math.round(max).toLocaleString()}`
  return interval ? `${formatted} / ${interval}` : formatted
}

function formatUsaJobsSalary(value: Record<string, unknown> | null): string {
  if (!value) return ''
  const min = asString(value.MinimumRange)
  const max = asString(value.MaximumRange)
  const interval = asString(value.RateIntervalCode)

  if (!min && !max) return ''
  const formatted = [min, max].filter(Boolean).join(' - ')
  return interval ? `${formatted} / ${interval}` : formatted
}

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
    const request = parseRequest(await req.json())
    const results = await handleSearch(request)
    return json(200, { data: { results } })
  } catch (error) {
    console.error('job-search error', error)
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return json(500, { error: message })
  }
})
