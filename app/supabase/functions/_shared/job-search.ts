export type SearchSource = 'greenhouse' | 'lever' | 'usajobs'
export type RemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown'

export type SearchRequest = {
  source: SearchSource
  query?: string
  location?: string
  boardOrSite?: string
  remoteOnly?: boolean
  limit?: number
}

export type SearchResult = {
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

export type WatchlistDiscovery = {
  sourceHint: 'greenhouse' | 'lever' | 'generic'
  boardOrSite: string
  snapshotJobs: Array<{ title: string; url: string; location: string }>
  notes: string
}

const TECHNICAL_QUERY_TERMS = [
  'ai',
  'analyst',
  'analysis',
  'analytics',
  'business intelligence',
  'computer vision',
  'data',
  'deep learning',
  'engineer',
  'forecasting',
  'intelligence',
  'learning',
  'logistics',
  'machine',
  'ml',
  'nlp',
  'operations',
  'optimization',
  'python',
  'pytorch',
  'research',
  'risk',
  'scientist',
  'sql',
  'supply chain',
  'tableau',
  'tensorflow',
  'power bi',
]

const CORE_TECH_TITLE_PHRASES = [
  'ai engineer',
  'applied scientist',
  'computer vision',
  'data scientist',
  'decision scientist',
  'machine learning engineer',
  'nlp',
  'research scientist',
]

const ADJACENT_ANALYST_TITLE_PHRASES = [
  'data analyst',
  'business intelligence analyst',
  'bi analyst',
  'analytics analyst',
  'operations research analyst',
  'operations analyst',
  'management analyst',
  'management and program analyst',
  'program analyst',
  'business systems analyst',
  'systems analyst',
  'supply chain analyst',
  'logistics analyst',
  'risk analyst',
  'financial analyst',
  'fraud analyst',
  'reporting analyst',
  'process improvement analyst',
  'quality analyst',
  'research analyst',
  'market analyst',
  'economic analyst',
  'quantitative analyst',
]

const OFF_TARGET_ENGINEERING_TITLE_PHRASES = [
  'industrial engineer',
  'process engineer',
  'quality engineer',
  'systems engineer',
  'operations engineer',
  'manufacturing engineer',
  'reliability engineer',
]

const OFF_TARGET_TITLE_PHRASES = [
  'accounting',
  'accounts payable',
  'accounts receivable',
  'auditor',
  'audit',
  'benefits',
  'bookkeeper',
  'bookkeeping',
  'budget',
  'compensation',
  'customer success',
  'fp a',
  'human resources',
  'marketing',
  'payroll',
  'recruit',
  'sales',
  'success manager',
  'talent',
  'tax',
]

const GENERIC_CATCHALL_TITLE_PHRASES = [
  "don't see what you're looking for",
  'dont see what youre looking for',
  'general interest',
  'future opportunities',
  'join our talent community',
  'talent community',
]

const TARGET_TECH_CONTEXT_PHRASES = [
  'artificial intelligence',
  'machine learning',
  'deep learning',
  'data science',
  'data analytics',
  'analytics',
  'business intelligence',
  'computer vision',
  'nlp',
  'language model',
  'model development',
  'algorithm',
  'algorithms',
  'sql',
  'python',
  'statistics',
  'statistical modeling',
  'predictive modeling',
  'forecasting',
  'optimization',
  'operations research',
  'decision support',
  'dashboard',
  'reporting',
  'tableau',
  'power bi',
  'looker',
  'supply chain',
  'logistics',
  'risk',
  'risk modeling',
  'fraud',
  'process improvement',
  'quality improvement',
  'simulation',
  'linear programming',
  'regression',
  'systems engineering',
  'process engineering',
]

const INDIVIDUAL_CONTRIBUTOR_TECH_PHRASES = [
  'artificial intelligence',
  'machine learning',
  'deep learning',
  'data science',
  'data analytics',
  'sql',
  'python',
  'statistical modeling',
  'predictive modeling',
  'model development',
  'forecasting',
  'optimization',
  'operations research',
  'algorithms',
  'experimentation',
  'data pipeline',
]

const OFF_TARGET_DOMAIN_TITLE_PHRASES = [
  'clinical laboratory',
  'laboratory scientist',
  'clinical scientist',
  'health scientist',
  'public health',
  'medical technologist',
  'medical laboratory',
  'biomedical scientist',
  'environmental health',
  'epidemiologist',
]

const OFF_TARGET_DOMAIN_TEXT_PHRASES = [
  'accounts payable',
  'accounts receivable',
  'bank reconciliation',
  'benefits administration',
  'clinical',
  'demand generation',
  'laboratory',
  'diagnosis',
  'diagnostic',
  'general ledger',
  'patient',
  'patients',
  'hospital',
  'healthcare',
  'journal entry',
  'public health',
  'medical',
  'biomedical',
  'pathology',
  'payroll processing',
  'pipeline generation',
  'sales quota',
  'sourcing candidates',
  'specimen',
  'disease',
  'epidemiology',
  'tax return',
]

const OFF_TARGET_LEADERSHIP_TITLE_PHRASES = [
  'engineering manager',
  'manager engineering',
  'product operations',
  'product ops',
  'product manager',
  'program manager',
  'technical program manager',
  'operations manager',
]

export function parseRequest(body: unknown): Required<SearchRequest> {
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
  const requestedLimit = typeof payload.limit === 'number' ? payload.limit : 20
  const limit = source === 'usajobs'
    ? Math.max(1, Math.min(200, requestedLimit))
    : Math.max(1, Math.min(50, requestedLimit))

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

export async function handleSearch(request: Required<SearchRequest>): Promise<SearchResult[]> {
  switch (request.source) {
    case 'greenhouse':
      return searchGreenhouse(request)
    case 'lever':
      return searchLever(request)
    case 'usajobs':
      return searchUsaJobs(request)
  }
}

export async function discoverCareerSource(careersUrl: string): Promise<WatchlistDiscovery> {
  const normalizedUrl = careersUrl.startsWith('http') ? careersUrl : `https://${careersUrl}`
  const response = await fetch(normalizedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CareerCockpitBot/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`Career page fetch failed with status ${response.status}.`)
  }

  const html = await response.text()
  const lower = html.toLowerCase()
  const greenhouse = html.match(/boards\.greenhouse\.io\/([a-z0-9_-]+)/i)
    ?? html.match(/boards-api\.greenhouse\.io\/v1\/boards\/([a-z0-9_-]+)/i)
  if (greenhouse?.[1]) {
    return {
      sourceHint: 'greenhouse',
      boardOrSite: greenhouse[1],
      snapshotJobs: [],
      notes: 'Detected Greenhouse board on the careers page.',
    }
  }

  const lever = html.match(/jobs\.lever\.co\/([a-z0-9_-]+)/i)
    ?? html.match(/api\.lever\.co\/v0\/postings\/([a-z0-9_-]+)/i)
  if (lever?.[1]) {
    return {
      sourceHint: 'lever',
      boardOrSite: lever[1],
      snapshotJobs: [],
      notes: 'Detected Lever site on the careers page.',
    }
  }

  const snapshotJobs = extractCareerAnchors(html, normalizedUrl)
  return {
    sourceHint: 'generic',
    boardOrSite: '',
    snapshotJobs,
    notes: lower.includes('greenhouse') || lower.includes('lever')
      ? 'Career page referenced known ATS terms, but a stable board/site token was not detected.'
      : 'No supported ATS board was detected. Stored a generic careers-page snapshot instead.',
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

  const pageSize = Math.min(100, request.limit)
  const maxPages = Math.max(1, Math.ceil(request.limit / pageSize))
  const collectedItems: Array<{
    MatchedObjectId?: string
    MatchedObjectDescriptor?: Record<string, unknown>
  }> = []

  for (let page = 1; page <= maxPages; page += 1) {
    const params = new URLSearchParams({
      ResultsPerPage: String(pageSize),
      Page: String(page),
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

    const items = payload.SearchResult?.SearchResultItems ?? []
    collectedItems.push(...items)

    if (items.length < pageSize) {
      break
    }
  }

  const normalized = collectedItems.map((item) => {
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

function extractCareerAnchors(html: string, baseUrl: string) {
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  const unique = new Map<string, { title: string; url: string; location: string }>()

  for (const match of matches) {
    const href = decodeHtmlEntities(match[1] ?? '').trim()
    const text = summarizeDescription(match[2] ?? '').replace(/\s+/g, ' ').trim()
    if (!href || !text) continue
    if (!/job|career|opening|role|position|team/i.test(text) && !/job|career|opening|position/i.test(href)) {
      continue
    }

    const url = resolveMaybeRelativeUrl(baseUrl, href)
    unique.set(url, {
      title: text.slice(0, 120),
      url,
      location: '',
    })
    if (unique.size >= 12) break
  }

  return [...unique.values()]
}

function rankAndLimit(results: SearchResult[], request: Required<SearchRequest>): SearchResult[] {
  const queryTerms = tokenize(request.query)
  const locationTerms = tokenize(request.location)
  const normalizedQuery = normalizeText(request.query)
  const technicalSearch = isTechnicalSearch(queryTerms, normalizedQuery)

  const scored = results
    .map((result) => {
      const title = normalizeText(result.title)
      const company = normalizeText(result.company)
      const location = normalizeText(result.location)
      const description = normalizeText(result.description)
      const haystack = normalizeText([
        result.title,
        result.company,
        result.location,
        result.employment_type,
        result.description,
      ].join(' '))

      let score = 0
      let titleMatches = 0
      let bodyMatches = 0

      if (normalizedQuery && title.includes(normalizedQuery)) {
        score += 18
      } else if (normalizedQuery && description.includes(normalizedQuery)) {
        score += 12
      } else if (normalizedQuery && haystack.includes(normalizedQuery)) {
        score += 8
      }

      for (const term of queryTerms) {
        if (title.includes(term)) {
          score += term.length > 5 ? 8 : 6
          titleMatches += 1
          continue
        }

        if (description.includes(term)) {
          score += technicalSearch ? (term.length > 5 ? 5 : 4) : (term.length > 5 ? 3 : 2)
          bodyMatches += 1
          continue
        }

        if (company.includes(term)) {
          score += 1
          bodyMatches += 1
        }
      }

      for (const term of locationTerms) {
        if (location.includes(term)) {
          score += 3
        }
      }

      score += computeTechnicalTitleAdjustment(title, description, technicalSearch)

      if (request.remoteOnly && result.remote_type === 'remote') score += 4
      if (result.remote_type === 'hybrid') score += 1
      if (queryTerms.length === 0) score += 1

      return { result, score, titleMatches, bodyMatches }
    })
    .filter(({ titleMatches, bodyMatches }) => {
      if (queryTerms.length === 0) return true
      if (queryTerms.length <= 2) return titleMatches + bodyMatches >= 1
      return titleMatches >= 1 || titleMatches + bodyMatches >= Math.max(1, Math.ceil(queryTerms.length / 2))
    })
    .sort((left, right) => right.score - left.score || left.result.title.localeCompare(right.result.title))
    .slice(0, request.limit)

  return scored.map(({ result }) => result)
}

function isTechnicalSearch(queryTerms: string[], normalizedQuery: string): boolean {
  return TECHNICAL_QUERY_TERMS.some((term) => {
    const normalizedTerm = normalizeText(term)
    return normalizedQuery.includes(normalizedTerm) || queryTerms.includes(normalizedTerm)
  })
}

function computeTechnicalTitleAdjustment(title: string, description: string, technicalSearch: boolean): number {
  if (!technicalSearch) return 0

  let score = 0
  const jobText = normalizeText(`${title} ${description}`)
  const targetContextHits = countPhraseMatches(jobText, TARGET_TECH_CONTEXT_PHRASES)
  const icSignalHits = countPhraseMatches(jobText, INDIVIDUAL_CONTRIBUTOR_TECH_PHRASES)
  const offTargetDomainHits = countPhraseMatches(jobText, OFF_TARGET_DOMAIN_TEXT_PHRASES)
  const offTargetLeadershipTitleHits = countPhraseMatches(title, OFF_TARGET_LEADERSHIP_TITLE_PHRASES)

  if (containsAnyPhrase(title, CORE_TECH_TITLE_PHRASES)) {
    score += targetContextHits >= 2 ? 10 : 6
  }

  if (containsAnyPhrase(title, ADJACENT_ANALYST_TITLE_PHRASES)) {
    score += targetContextHits >= 2 ? 6 : 1
  }

  if (/\banalyst\b/.test(title) && targetContextHits >= 3) {
    score += 3
  } else if (
    /\b(engineer|scientist)\b/.test(title) &&
    offTargetLeadershipTitleHits === 0 &&
    !containsAnyPhrase(title, OFF_TARGET_ENGINEERING_TITLE_PHRASES) &&
    (targetContextHits >= 2 || icSignalHits >= 2)
  ) {
    score += 2
  }

  if (targetContextHits >= 4) {
    score += 2
  }

  if (containsAnyPhrase(title, OFF_TARGET_TITLE_PHRASES)) {
    score -= targetContextHits <= 1 ? 16 : 8
  }

  if (containsAnyPhrase(title, OFF_TARGET_ENGINEERING_TITLE_PHRASES)) {
    if (icSignalHits <= 1) {
      score -= 16
    } else if (targetContextHits <= 2) {
      score -= 10
    } else if (targetContextHits <= 4) {
      score -= 5
    }
  }

  if (containsAnyPhrase(title, OFF_TARGET_DOMAIN_TITLE_PHRASES)) {
    score -= 14
  }

  if (offTargetLeadershipTitleHits > 0 && icSignalHits <= 1) {
    score -= 16
  } else if (offTargetLeadershipTitleHits > 0 && icSignalHits <= 2) {
    score -= 10
  } else if (offTargetLeadershipTitleHits > 0 && targetContextHits <= 3) {
    score -= 5
  }

  if (offTargetDomainHits >= 3 && targetContextHits <= 1) {
    score -= 8
  } else if (offTargetDomainHits >= 2 && targetContextHits <= 2) {
    score -= 4
  }

  if (/\bscientist\b/.test(title) && containsAnyPhrase(title, OFF_TARGET_DOMAIN_TITLE_PHRASES)) {
    score -= 4
  }

  if (
    /\bmanager\b/.test(title) &&
    targetContextHits <= 1
  ) {
    score -= 4
  }

  if (containsAnyPhrase(title, GENERIC_CATCHALL_TITLE_PHRASES)) {
    score -= 22
  }

  return score
}

function containsAnyPhrase(haystack: string, phrases: string[]): boolean {
  return phrases.some((phrase) => haystack.includes(normalizeText(phrase)))
}

function countPhraseMatches(haystack: string, phrases: string[]): number {
  return phrases.filter((phrase) => haystack.includes(normalizeText(phrase))).length
}

export function extractGreenhouseBoardToken(input: string): string {
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

export function extractLeverSite(input: string): string {
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

function resolveMaybeRelativeUrl(baseUrl: string, href: string): string {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return href
  }
}
