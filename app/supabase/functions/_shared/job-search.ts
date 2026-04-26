export type SearchSource =
  | 'greenhouse'
  | 'lever'
  | 'usajobs'
  | 'workday'
  | 'ashby'
  | 'smartrecruiters'
  | 'icims'
  | 'workable'
  | 'jobvite'
  | 'adzuna'
  | 'google_jobs'
export type RemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown'
type ConnectorSource = Exclude<SearchSource, 'usajobs' | 'adzuna' | 'google_jobs'>
type WatchlistSourceHint = ConnectorSource | 'generic'

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

export type JobUrlMetadata = {
  external_id: string
  title: string
  company: string
  location: string
  remote_type: RemoteType
  employment_type: string
  salary_range: string
  job_url: string
  description: string
  source_label: string
}

export type WatchlistDiscovery = {
  sourceHint: WatchlistSourceHint
  boardOrSite: string
  snapshotJobs: Array<{ title: string; url: string; location: string }>
  notes: string
}

const CONNECTOR_SOURCES = [
  'greenhouse',
  'lever',
  'workday',
  'ashby',
  'smartrecruiters',
  'icims',
  'workable',
  'jobvite',
] as const satisfies readonly ConnectorSource[]

const SEARCH_SOURCES = [...CONNECTOR_SOURCES, 'usajobs', 'adzuna', 'google_jobs'] as const satisfies readonly SearchSource[]
const DEFAULT_FETCH_TIMEOUT_MS = 12000

async function fetchWithTimeout(input: string | URL | Request, init: RequestInit = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: init.signal ?? controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Job source request timed out after ${timeoutMs / 1000}s.`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
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

const STRONG_OFF_TARGET_GTM_TITLE_PHRASES = [
  'account executive',
  'account manager',
  'business development',
  'sales development representative',
  'business development representative',
  'sales representative',
  'inside sales',
  'outside sales',
  'territory manager',
  'client success manager',
  'customer success manager',
  'client partner',
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

const STRONG_OFF_TARGET_GTM_TEXT_PHRASES = [
  'quota attainment',
  'quota carrying',
  'quota-carrying',
  'pipeline management',
  'sales pipeline',
  'sales cycle',
  'prospecting',
  'outbound prospecting',
  'lead generation',
  'lead qualification',
  'closing deals',
  'close deals',
  'go to market',
  'go-to-market',
  'new logo',
  'book of business',
  'territory planning',
  'territory management',
  'revenue growth',
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

function isSearchSource(value: unknown): value is SearchSource {
  return typeof value === 'string' && SEARCH_SOURCES.includes(value as SearchSource)
}

function requiresBoardInput(source: SearchSource) {
  return source !== 'usajobs' && source !== 'adzuna' && source !== 'google_jobs'
}

export function parseRequest(body: unknown): Required<SearchRequest> {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body.')
  }

  const payload = body as Record<string, unknown>
  const source = payload.source
  if (!isSearchSource(source)) {
    throw new Error('Unsupported search source.')
  }

  const query = typeof payload.query === 'string' ? payload.query.trim() : ''
  const location = typeof payload.location === 'string' ? payload.location.trim() : ''
  const boardOrSite = typeof payload.boardOrSite === 'string' ? payload.boardOrSite.trim() : ''
  const remoteOnly = payload.remoteOnly === true
  const requestedLimit = typeof payload.limit === 'number' ? payload.limit : 20
  const limit = source === 'usajobs' || source === 'google_jobs'
    ? Math.max(1, Math.min(200, requestedLimit))
    : Math.max(1, Math.min(50, requestedLimit))

  if (requiresBoardInput(source) && !boardOrSite) {
    throw new Error('A board token, site name, or careers URL is required for this source.')
  }

  if ((source === 'usajobs' || source === 'adzuna' || source === 'google_jobs') && !query && !location) {
    throw new Error('This search requires at least a keyword or location.')
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
    case 'workday':
      return searchWorkday(request)
    case 'ashby':
      return searchAshby(request)
    case 'smartrecruiters':
      return searchSmartRecruiters(request)
    case 'icims':
      return searchIcims(request)
    case 'workable':
      return searchWorkable(request)
    case 'jobvite':
      return searchJobvite(request)
    case 'usajobs':
      return searchUsaJobs(request)
    case 'adzuna':
      return searchAdzuna(request)
    case 'google_jobs':
      return searchGoogleJobs(request)
  }
}

export async function discoverCareerSource(careersUrl: string): Promise<WatchlistDiscovery> {
  const normalizedUrl = careersUrl.startsWith('http') ? careersUrl : `https://${careersUrl}`
  const response = await fetchWithTimeout(normalizedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CareerCockpitBot/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`Career page fetch failed with status ${response.status}.`)
  }

  const html = await response.text()
  const lower = html.toLowerCase()
  const greenhouse = extractGreenhouseBoardToken(
    findFirstUrlMatch([normalizedUrl, html], [
      /https?:\/\/boards(?:-api)?\.greenhouse\.io\/(?:v1\/boards\/)?[a-z0-9_-]+/i,
      /boards(?:-api)?\.greenhouse\.io\/(?:v1\/boards\/)?[a-z0-9_-]+/i,
    ])
  )
  if (greenhouse) {
    return {
      sourceHint: 'greenhouse',
      boardOrSite: greenhouse,
      snapshotJobs: [],
      notes: 'Detected Greenhouse board on the careers page.',
    }
  }

  const lever = extractLeverSite(
    findFirstUrlMatch([normalizedUrl, html], [
      /https?:\/\/(?:jobs|api)\.lever\.co\/(?:v0\/postings\/)?[a-z0-9_-]+/i,
      /(?:jobs|api)\.lever\.co\/(?:v0\/postings\/)?[a-z0-9_-]+/i,
    ])
  )
  if (lever) {
    return {
      sourceHint: 'lever',
      boardOrSite: lever,
      snapshotJobs: [],
      notes: 'Detected Lever site on the careers page.',
    }
  }

  const workday = extractWorkdayBoardUrl(
    findFirstUrlMatch([normalizedUrl, html], [
      /https?:\/\/[^\s"'<>]+(?:myworkdayjobs\.com|myworkdaysite\.com)[^\s"'<>]*/i,
      /https?:\/\/[^\s"'<>]+\/wday\/cxs\/[^\s"'<>]+/i,
    ]) || normalizedUrl
  )
  if (workday) {
    return {
      sourceHint: 'workday',
      boardOrSite: workday,
      snapshotJobs: [],
      notes: 'Detected Workday board on the careers page.',
    }
  }

  const ashby = extractAshbyBoardName(
    findFirstUrlMatch([normalizedUrl, html], [
      /https?:\/\/jobs\.ashbyhq\.com\/[a-z0-9_-]+/i,
      /https?:\/\/api\.ashbyhq\.com\/posting-api\/job-board\/[a-z0-9_-]+/i,
      /(?:jobs\.ashbyhq\.com|posting-api\/job-board\/)[a-z0-9_-]+/i,
    ])
  )
  if (ashby) {
    return {
      sourceHint: 'ashby',
      boardOrSite: ashby,
      snapshotJobs: [],
      notes: 'Detected Ashby job board on the careers page.',
    }
  }

  const smartRecruiters = extractSmartRecruitersCompany(
    findFirstUrlMatch([normalizedUrl, html], [
      /https?:\/\/(?:careers|jobs)\.smartrecruiters\.com\/[a-z0-9_-]+/i,
      /https?:\/\/api\.smartrecruiters\.com\/v1\/companies\/[a-z0-9_-]+\/postings/i,
      /(?:careers|jobs)\.smartrecruiters\.com\/[a-z0-9_-]+/i,
    ])
  )
  if (smartRecruiters) {
    return {
      sourceHint: 'smartrecruiters',
      boardOrSite: smartRecruiters,
      snapshotJobs: [],
      notes: 'Detected SmartRecruiters company feed on the careers page.',
    }
  }

  const workable = extractWorkableSubdomain(
    findFirstUrlMatch([normalizedUrl, html], [
      /https?:\/\/apply\.workable\.com\/[a-z0-9_-]+/i,
      /https?:\/\/www\.workable\.com\/api\/accounts\/[a-z0-9_-]+/i,
      /(?:apply\.workable\.com|api\/accounts)\/[a-z0-9_-]+/i,
    ])
  )
  if (workable) {
    return {
      sourceHint: 'workable',
      boardOrSite: workable,
      snapshotJobs: [],
      notes: 'Detected Workable public jobs feed on the careers page.',
    }
  }

  const jobvite = extractJobviteCompany(
    findFirstUrlMatch([normalizedUrl, html], [
      /https?:\/\/jobs\.jobvite\.com\/[a-z0-9_-]+[^\s"'<>]*/i,
      /jobs\.jobvite\.com\/[a-z0-9_-]+[^\s"'<>]*/i,
    ])
  )
  if (jobvite) {
    return {
      sourceHint: 'jobvite',
      boardOrSite: jobvite,
      snapshotJobs: [],
      notes: 'Detected Jobvite board on the careers page.',
    }
  }

  const icimsCandidate = findFirstUrlMatch([html, normalizedUrl], [
    /https?:\/\/[^\s"'<>]*icims[^\s"'<>]*/i,
    /https?:\/\/[^\s"'<>]+\/jobs\/search[^\s"'<>]*ss=1[^\s"'<>]*/i,
  ]) || (lower.includes('icims') ? normalizedUrl : '')
  const icims = extractIcimsBoardUrl(icimsCandidate)
  if (icims) {
    return {
      sourceHint: 'icims',
      boardOrSite: icims,
      snapshotJobs: [],
      notes: 'Detected iCIMS careers page.',
    }
  }

  const snapshotJobs = extractCareerAnchors(html, normalizedUrl)
  return {
    sourceHint: 'generic',
    boardOrSite: '',
    snapshotJobs,
    notes: containsAnySupportedAtsTerm(lower)
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
    fetchWithTimeout(`https://boards-api.greenhouse.io/v1/boards/${boardToken}`),
    fetchWithTimeout(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`),
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
  const response = await fetchWithTimeout(`https://api.lever.co/v0/postings/${site}?${params.toString()}`)

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

async function searchWorkday(request: Required<SearchRequest>): Promise<SearchResult[]> {
  const board = extractWorkdayBoardDescriptor(request.boardOrSite)
  if (!board) {
    throw new Error('Could not determine the Workday board URL.')
  }

  const pageSize = Math.min(20, Math.max(request.limit, 10))
  const maxItems = Math.max(request.limit * 3, 60)
  const collected: Array<Record<string, unknown>> = []

  for (let offset = 0; offset < maxItems; offset += pageSize) {
    const response = await fetchWithTimeout(`${board.apiBaseUrl}/jobs`, {
      method: 'POST',
      headers: buildJsonHeaders(board.origin),
      body: JSON.stringify({
        appliedFacets: {},
        limit: pageSize,
        offset,
        searchText: request.query,
      }),
    })

    if (!response.ok) {
      throw new Error(`Workday search failed with status ${response.status}.`)
    }

    const payload = (await response.json()) as {
      total?: number
      jobPostings?: Array<Record<string, unknown>>
    }
    const postings = Array.isArray(payload.jobPostings) ? payload.jobPostings : []
    collected.push(...postings)

    const total = typeof payload.total === 'number' ? payload.total : null
    if (postings.length < pageSize || (total !== null && collected.length >= total)) {
      break
    }
  }

  const normalized = collected.map((posting) => {
    const title = asString(posting.title)
    const externalPath = asString(posting.externalPath)
    const bulletFields = Array.isArray(posting.bulletFields) ? posting.bulletFields : []
    const location = asString(posting.locationsText)
    const postedOn = asString(posting.postedOn)

    return {
      source: 'workday' as const,
      external_id: firstString(bulletFields) || externalPath || title,
      source_label: `Workday / ${board.label}`,
      title,
      company: board.company,
      location,
      remote_type: guessRemoteType([location, postedOn, title]),
      employment_type: inferEmploymentType([title, ...bulletFields.map((value) => asString(value))]),
      salary_range: '',
      job_url: resolveMaybeRelativeUrl(board.browseUrl, externalPath),
      description: '',
    }
  })

  return enrichResultsFromJobPages(rankAndLimit(normalized, request))
}

async function searchAshby(request: Required<SearchRequest>): Promise<SearchResult[]> {
  const boardName = extractAshbyBoardName(request.boardOrSite)
  if (!boardName) {
    throw new Error('Could not determine the Ashby job board name.')
  }

  const response = await fetchWithTimeout(`https://api.ashbyhq.com/posting-api/job-board/${boardName}?includeCompensation=true`)
  if (!response.ok) {
    throw new Error(`Ashby search failed with status ${response.status}.`)
  }

  const payload = (await response.json()) as {
    jobs?: Array<Record<string, unknown>>
  }

  const normalized = (payload.jobs ?? [])
    .filter((job) => job.isListed !== false)
    .map((job) => {
      const title = asString(job.title)
      const description = summarizeDescription(asString(job.descriptionPlain) || asString(job.descriptionHtml))
      const location = formatAshbyLocation(job)
      const salaryRange = formatAshbyCompensation(asObject(job.compensation))

      return {
        source: 'ashby' as const,
        external_id: asString(job.id) || asString(job.jobId) || asString(job.jobUrl) || title,
        source_label: `Ashby / ${boardName}`,
        title,
        company: deriveAshbyCompany(job, boardName),
        location,
        remote_type: mapAshbyRemoteType(job, location, description),
        employment_type: humanizeEnum(asString(job.employmentType)) || inferEmploymentType([title, description]),
        salary_range: salaryRange,
        job_url: asString(job.jobUrl) || asString(job.applyUrl),
        description,
      }
    })

  return rankAndLimit(normalized, request)
}

async function searchSmartRecruiters(request: Required<SearchRequest>): Promise<SearchResult[]> {
  const companyIdentifier = extractSmartRecruitersCompany(request.boardOrSite)
  if (!companyIdentifier) {
    throw new Error('Could not determine the SmartRecruiters company identifier.')
  }

  const pageSize = Math.min(100, Math.max(request.limit * 2, 25))
  const maxItems = Math.max(request.limit * 3, 60)
  const collected: Array<Record<string, unknown>> = []

  for (let offset = 0; offset < maxItems; offset += pageSize) {
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
    })
    if (request.query) params.set('q', request.query)

    const response = await fetchWithTimeout(`https://api.smartrecruiters.com/v1/companies/${companyIdentifier}/postings?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`SmartRecruiters search failed with status ${response.status}.`)
    }

    const payload = (await response.json()) as {
      totalFound?: number
      content?: Array<Record<string, unknown>>
    }
    const postings = Array.isArray(payload.content) ? payload.content : []
    collected.push(...postings)

    const totalFound = typeof payload.totalFound === 'number' ? payload.totalFound : null
    if (postings.length < pageSize || (totalFound !== null && collected.length >= totalFound)) {
      break
    }
  }

  const normalized = collected.map((posting) => {
    const location = formatSmartRecruitersLocation(asObject(posting.location))
    const company = asString(asObject(posting.company)?.name) || humanizeToken(companyIdentifier)

    return {
      source: 'smartrecruiters' as const,
      external_id: asString(posting.id) || asString(posting.uuid) || asString(posting.ref),
      source_label: `SmartRecruiters / ${companyIdentifier}`,
      title: asString(posting.name),
      company,
      location,
      remote_type: asObject(posting.location)?.remote === true ? 'remote' : guessRemoteType([location]),
      employment_type: asString(asObject(posting.typeOfEmployment)?.label),
      salary_range: '',
      job_url: asString(posting.ref),
      description: summarizeDescription([
        asString(asObject(posting.department)?.label),
        asString(asObject(posting.function)?.label),
        asString(asObject(posting.experienceLevel)?.label),
      ].filter(Boolean).join(' | ')),
    }
  })

  const ranked = rankAndLimit(normalized, request)
  return Promise.all(ranked.map((result) => enrichSmartRecruitersResult(companyIdentifier, result)))
}

async function searchIcims(request: Required<SearchRequest>): Promise<SearchResult[]> {
  const boardUrl = extractIcimsBoardUrl(request.boardOrSite)
  if (!boardUrl) {
    throw new Error('Could not determine the iCIMS jobs URL.')
  }

  return searchCareerPageLinks(request, {
    source: 'icims',
    sourceLabel: `iCIMS / ${humanizeToken(readHostnameLabel(boardUrl))}`,
    listingUrl: boardUrl,
    company: humanizeToken(readHostnameLabel(boardUrl)),
    hrefPatterns: [/\/jobs\/\d+/i],
  })
}

async function searchWorkable(request: Required<SearchRequest>): Promise<SearchResult[]> {
  const subdomain = extractWorkableSubdomain(request.boardOrSite)
  if (!subdomain) {
    throw new Error('Could not determine the Workable account subdomain.')
  }

  const response = await fetchWithTimeout(`https://www.workable.com/api/accounts/${subdomain}?details=true`)
  if (!response.ok) {
    throw new Error(`Workable search failed with status ${response.status}.`)
  }

  const payload = (await response.json()) as {
    company?: Record<string, unknown>
    jobs?: Array<Record<string, unknown>>
  }
  const company = asString(payload.company?.name) || humanizeToken(subdomain)

  const normalized = (payload.jobs ?? []).map((job) => {
    const title = asString(job.title)
    const description = summarizeDescription(
      asString(job.description)
      || asString(job.full_description)
      || asString(job.requirements)
      || asString(job.benefits)
    )
    const location = formatWorkableLocation(job)

    return {
      source: 'workable' as const,
      external_id: asString(job.id) || asString(job.shortcode) || asString(job.url) || title,
      source_label: `Workable / ${subdomain}`,
      title,
      company,
      location,
      remote_type: mapWorkableRemoteType(job, location, description),
      employment_type: humanizeEnum(asString(job.employment_type)) || inferEmploymentType([title, description]),
      salary_range: formatWorkableSalary(job),
      job_url: asString(job.url) || buildWorkableJobUrl(subdomain, asString(job.shortcode)),
      description,
    }
  })

  return rankAndLimit(normalized, request)
}

async function searchJobvite(request: Required<SearchRequest>): Promise<SearchResult[]> {
  const company = extractJobviteCompany(request.boardOrSite)
  if (!company) {
    throw new Error('Could not determine the Jobvite company identifier.')
  }

  return searchCareerPageLinks(request, {
    source: 'jobvite',
    sourceLabel: `Jobvite / ${company}`,
    listingUrl: buildJobviteBoardUrl(request.boardOrSite),
    company: humanizeToken(company),
    hrefPatterns: [/jobvite\.com\/[^"'<>]*\/job\//i, /\/job\/[a-z0-9_-]+/i],
  })
}

async function searchGoogleJobs(request: Required<SearchRequest>): Promise<SearchResult[]> {
  const apiKey = Deno.env.get('SERPAPI_KEY')
  if (!apiKey) {
    throw new Error('SerpApi search is not configured. Run "npx supabase secrets set SERPAPI_KEY=your_key".')
  }

  const queryParts = []
  if (request.query) queryParts.push(request.query)
  if (request.location) queryParts.push(request.location)
  if (request.remoteOnly) queryParts.push('remote')

  const query = queryParts.join(' ') || 'software engineer'

  // SerpAPI google_jobs returns ~10 results per page.
  // Paginate via next_page_token to collect up to the requested limit.
  const targetCount = Math.min(request.limit, 50)
  const maxPages = Math.ceil(targetCount / 10)
  const collected = new Map<string, any>()
  let nextPageToken: string | undefined

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      engine: 'google_jobs',
      q: query,
      api_key: apiKey,
    })

    // Use lrad (radius in km) when a location is provided to widen the net
    if (request.location) {
      params.set('lrad', '80')
    }

    if (nextPageToken) {
      params.set('next_page_token', nextPageToken)
    }

    const response = await fetchWithTimeout(`https://serpapi.com/search.json?${params.toString()}`)
    if (!response.ok) {
      // If first page fails, throw. Otherwise return what we have.
      if (page === 0) {
        throw new Error(`Google Jobs search failed with status ${response.status}`)
      }
      break
    }

    const data = await response.json()
    const pageResults: any[] = data.jobs_results || []

    for (const job of pageResults) {
      const jobId = job.job_id || `${job.title}_${job.company_name}`
      if (!collected.has(jobId)) {
        collected.set(jobId, job)
      }
    }

    // Check for next page token
    nextPageToken = data.serpapi_pagination?.next_page_token
    if (!nextPageToken || collected.size >= targetCount) {
      break
    }
  }

  const results = Array.from(collected.values()).slice(0, targetCount)

  return results.map((job) => {
    let remoteType: RemoteType = 'unknown'
    const titleLower = job.title?.toLowerCase() || ''
    const descLower = job.description?.toLowerCase() || ''
    const locationLower = job.location?.toLowerCase() || ''

    if (titleLower.includes('remote') || descLower.includes('remote') || locationLower.includes('anywhere')) {
      remoteType = 'remote'
    } else if (titleLower.includes('hybrid') || descLower.includes('hybrid')) {
      remoteType = 'hybrid'
    }

    const extensions = job.detected_extensions || {}
    const employmentType = extensions.schedule_type || 'Full-time'
    const salaryRange = extensions.salary || ''

    // Prefer apply_options link (direct apply URL) over share_link (Google's viewer)
    const applyUrl = Array.isArray(job.apply_options) && job.apply_options.length > 0
      ? job.apply_options[0].link
      : ''

    return {
      source: 'google_jobs' as const,
      external_id: `gjobs_${job.job_id}`,
      source_label: 'Google Jobs',
      title: job.title || 'Unknown Title',
      company: job.company_name || 'Unknown Company',
      location: job.location || 'Remote',
      remote_type: remoteType,
      employment_type: employmentType,
      salary_range: salaryRange,
      job_url: applyUrl || job.related_links?.[0]?.link || job.share_link || '',
      description: job.description || 'No description provided.',
    }
  })
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

    const response = await fetchWithTimeout(`https://data.usajobs.gov/api/search?${params.toString()}`, {
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

function extractCareerAnchors(
  html: string,
  baseUrl: string,
  options: { hrefPatterns?: RegExp[]; maxItems?: number } = {},
) {
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
    if (options.hrefPatterns?.length && !options.hrefPatterns.some((pattern) => pattern.test(url))) {
      continue
    }
    unique.set(url, {
      title: text.slice(0, 120),
      url,
      location: '',
    })
    if (unique.size >= (options.maxItems ?? 12)) break
  }

  return [...unique.values()]
}

type WorkdayBoardDescriptor = {
  apiBaseUrl: string
  browseUrl: string
  origin: string
  tenant: string
  site: string
  company: string
  label: string
}

type CareerPageSearchOptions = {
  source: ConnectorSource
  sourceLabel: string
  listingUrl: string
  company: string
  hrefPatterns: RegExp[]
}

type JobPageMetadata = {
  external_id?: string
  title?: string
  company?: string
  location?: string
  remote_type?: RemoteType
  employment_type?: string
  salary_range?: string
  job_url?: string
  description?: string
}

function buildJsonHeaders(origin?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; CareerCockpitBot/1.0)',
  }
  if (origin) headers.Origin = origin
  return headers
}

function containsAnySupportedAtsTerm(lower: string): boolean {
  return [
    'greenhouse',
    'lever',
    'workday',
    'ashby',
    'smartrecruiters',
    'icims',
    'workable',
    'jobvite',
  ].some((term) => lower.includes(term))
}

function findFirstUrlMatch(values: string[], patterns: RegExp[]): string {
  for (const value of values) {
    if (!value) continue
    for (const pattern of patterns) {
      const match = value.match(pattern)
      if (match?.[0]) return match[0]
    }
  }
  return ''
}

function readHostnameLabel(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    const labels = parsed.hostname.split('.').filter(Boolean)
    return labels.find((label) => label !== 'www') ?? labels[0] ?? ''
  } catch {
    return sanitizeToken(url.split('/')[0] ?? '')
  }
}

export function extractWorkdayBoardUrl(input: string): string {
  return extractWorkdayBoardDescriptor(input)?.apiBaseUrl ?? ''
}

function extractWorkdayBoardDescriptor(input: string): WorkdayBoardDescriptor | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const parts = url.pathname.split('/').filter(Boolean)
    const isWorkdayHost = /(?:myworkdayjobs\.com|myworkdaysite\.com)$/i.test(url.hostname)
    const isWorkdayPath = (parts[0] === 'wday' && parts[1] === 'cxs') || parts[0] === 'recruiting'
    if (!isWorkdayHost && !isWorkdayPath) return null

    const tenantFromHost = sanitizeToken(url.hostname.split('.')[0] ?? '')
    let tenant = ''
    let site = ''

    if (parts[0] === 'wday' && parts[1] === 'cxs') {
      tenant = sanitizeToken(parts[2] ?? tenantFromHost)
      site = sanitizeToken(parts[3] ?? '')
    } else if (parts[0] === 'recruiting') {
      tenant = sanitizeToken(parts[1] ?? tenantFromHost)
      site = sanitizeToken(parts[2] ?? '')
    } else {
      const withoutLocale = parts.filter((part, index) => !(index === 0 && /^[a-z]{2}(?:-[a-z]{2})?$/i.test(part)))
      tenant = tenantFromHost
      site = sanitizeToken(withoutLocale.at(-1) ?? '')
    }

    if (!tenant || !site) return null

    const origin = `${url.protocol}//${url.host}`
    const browseUrl = `${origin}/${parts.join('/') || site}`

    return {
      apiBaseUrl: `${origin}/wday/cxs/${tenant}/${site}`,
      browseUrl,
      origin,
      tenant,
      site,
      company: humanizeToken(tenantFromHost || tenant || site),
      label: `${tenant}/${site}`,
    }
  } catch {
    return null
  }
}

function extractAshbyBoardName(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (!trimmed.includes('/')) return sanitizeToken(trimmed)

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const parts = url.pathname.split('/').filter(Boolean)

    if (url.hostname.includes('api.ashbyhq.com')) {
      const index = parts.findIndex((part) => part === 'job-board')
      return sanitizeToken(index >= 0 ? parts[index + 1] ?? '' : '')
    }

    if (url.hostname.includes('ashbyhq.com')) {
      return sanitizeToken(parts[0] ?? '')
    }
  } catch {
    return ''
  }

  return ''
}

function extractSmartRecruitersCompany(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (!trimmed.includes('/')) return sanitizeToken(trimmed)

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const parts = url.pathname.split('/').filter(Boolean)

    if (url.hostname.includes('api.smartrecruiters.com')) {
      const index = parts.findIndex((part) => part === 'companies')
      return sanitizeToken(index >= 0 ? parts[index + 1] ?? '' : '')
    }

    if (url.hostname.includes('smartrecruiters.com')) {
      return sanitizeToken(parts[0] ?? '')
    }
  } catch {
    return ''
  }

  return ''
}

function extractIcimsBoardUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (!trimmed.includes('/')) return ''

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const looksLikeIcims = /icims/i.test(url.hostname)
      || /icims/i.test(url.pathname)
      || /\/jobs\/search/i.test(url.pathname)
      || /\/jobs\/\d+/i.test(url.pathname)
      || /(?:^|&)ss=1(?:&|$)/i.test(url.search.replace(/^\?/, ''))
    if (!looksLikeIcims) return ''

    if (/\/jobs\/\d+/i.test(url.pathname)) {
      url.pathname = url.pathname.replace(/\/jobs\/\d+[^/]*\/.*/i, '/jobs/search')
    }

    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

function extractWorkableSubdomain(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (!trimmed.includes('/')) return sanitizeToken(trimmed)

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const parts = url.pathname.split('/').filter(Boolean)

    if (url.hostname.includes('apply.workable.com')) {
      return sanitizeToken(parts[0] ?? '')
    }

    if (url.hostname.includes('workable.com')) {
      const index = parts.findIndex((part) => part === 'accounts')
      return sanitizeToken(index >= 0 ? parts[index + 1] ?? '' : '')
    }
  } catch {
    return ''
  }

  return ''
}

function extractJobviteCompany(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (!trimmed.includes('/')) return sanitizeToken(trimmed)

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const parts = url.pathname.split('/').filter(Boolean)
    if (url.hostname.includes('jobvite.com')) {
      return sanitizeToken(parts[0] ?? '')
    }
  } catch {
    return ''
  }

  return ''
}

function buildWorkableJobUrl(subdomain: string, shortcode: string): string {
  return shortcode ? `https://apply.workable.com/${subdomain}/j/${shortcode}` : ''
}

function buildJobviteBoardUrl(input: string): string {
  const company = extractJobviteCompany(input)
  return company ? `https://jobs.jobvite.com/${company}` : input.trim()
}

function humanizeEnum(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
}

function formatAshbyLocation(job: Record<string, unknown>): string {
  const primary = asString(job.location)
  if (primary) return primary

  const postalAddress = asObject(asObject(job.address)?.postalAddress)
  return [
    asString(postalAddress?.addressLocality),
    asString(postalAddress?.addressRegion),
    asString(postalAddress?.addressCountry),
  ].filter(Boolean).join(', ')
}

function deriveAshbyCompany(job: Record<string, unknown>, boardName: string): string {
  return asString(job.companyName)
    || asString(asObject(job.organization)?.name)
    || humanizeToken(boardName)
}

function mapAshbyRemoteType(
  job: Record<string, unknown>,
  location: string,
  description: string,
): RemoteType {
  const workplaceType = normalizeText(asString(job.workplaceType))
  if (job.isRemote === true || workplaceType === 'remote') return 'remote'
  if (workplaceType === 'hybrid') return 'hybrid'
  if (workplaceType === 'on site' || workplaceType === 'onsite') return 'onsite'
  return guessRemoteType([location, description])
}

function formatAshbyCompensation(value: Record<string, unknown> | null): string {
  if (!value) return ''
  return asString(value.scrapeableCompensationSalarySummary)
    || asString(value.compensationTierSummary)
}

function formatSmartRecruitersLocation(value: Record<string, unknown> | null): string {
  if (!value) return ''

  const parts = [
    asString(value.city),
    asString(value.region),
    asString(value.country),
  ].filter(Boolean)
  const base = parts.join(', ')
  return value.remote === true ? (base ? `${base} | Remote` : 'Remote') : base
}

async function enrichSmartRecruitersResult(
  companyIdentifier: string,
  result: SearchResult,
): Promise<SearchResult> {
  if (!result.external_id) return result

  try {
    const response = await fetchWithTimeout(`https://api.smartrecruiters.com/v1/companies/${companyIdentifier}/postings/${result.external_id}`)
    if (!response.ok) return result

    const payload = (await response.json()) as Record<string, unknown>
    const sections = asObject(asObject(payload.jobAd)?.sections)
    const description = summarizeDescription([
      asString(asObject(sections?.companyDescription)?.text),
      asString(asObject(sections?.jobDescription)?.text),
      asString(asObject(sections?.qualifications)?.text),
      asString(asObject(sections?.additionalInformation)?.text),
    ].filter(Boolean).join('\n\n'))
    const location = formatSmartRecruitersLocation(asObject(payload.location))

    return {
      ...result,
      company: asString(asObject(payload.company)?.name) || result.company,
      location: location || result.location,
      remote_type: asObject(payload.location)?.remote === true ? 'remote' : result.remote_type,
      employment_type: asString(asObject(payload.typeOfEmployment)?.label) || result.employment_type,
      job_url: asString(payload.applyUrl) || result.job_url,
      description: description || result.description,
    }
  } catch {
    return result
  }
}

async function searchCareerPageLinks(
  request: Required<SearchRequest>,
  options: CareerPageSearchOptions,
): Promise<SearchResult[]> {
  const response = await fetchWithTimeout(options.listingUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CareerCockpitBot/1.0)',
    },
  })
  if (!response.ok) {
    throw new Error(`${humanizeToken(options.source)} search failed with status ${response.status}.`)
  }

  const html = await response.text()
  let normalized = extractJsonLdSearchResults(
    html,
    options.listingUrl,
    options.source,
    options.sourceLabel,
    options.company,
  )

  if (normalized.length === 0) {
    const anchors = extractCareerAnchors(html, options.listingUrl, {
      hrefPatterns: options.hrefPatterns,
      maxItems: Math.max(request.limit * 4, 40),
    })
    normalized = anchors.map((job, index) => ({
      source: options.source,
      external_id: deriveExternalIdFromUrl(job.url) || `${options.source}-${index + 1}`,
      source_label: options.sourceLabel,
      title: job.title,
      company: options.company,
      location: job.location,
      remote_type: guessRemoteType([job.title, job.location]),
      employment_type: inferEmploymentType([job.title]),
      salary_range: '',
      job_url: job.url,
      description: '',
    }))
  }

  return enrichResultsFromJobPages(rankAndLimit(normalized, request))
}

async function enrichResultsFromJobPages(results: SearchResult[]): Promise<SearchResult[]> {
  return Promise.all(results.map(async (result) => {
    if (!needsResultEnrichment(result) || !result.job_url) return result

    try {
      const response = await fetchWithTimeout(result.job_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CareerCockpitBot/1.0)',
        },
      })
      if (!response.ok) return result

      const html = await response.text()
      const metadata = extractJobPageMetadata(html, result.job_url, result.company)
      return metadata ? mergeSearchResult(result, metadata) : result
    } catch {
      return result
    }
  }))
}

function needsResultEnrichment(result: SearchResult): boolean {
  return !result.description || result.remote_type === 'unknown' || !result.location || !result.employment_type
}

function mergeSearchResult(result: SearchResult, metadata: JobPageMetadata): SearchResult {
  return {
    ...result,
    external_id: metadata.external_id || result.external_id,
    title: metadata.title || result.title,
    company: metadata.company || result.company,
    location: metadata.location || result.location,
    remote_type: metadata.remote_type || result.remote_type,
    employment_type: metadata.employment_type || result.employment_type,
    salary_range: metadata.salary_range || result.salary_range,
    job_url: metadata.job_url || result.job_url,
    description: metadata.description || result.description,
  }
}

function extractJobPageMetadata(
  html: string,
  baseUrl: string,
  fallbackCompany: string,
): JobPageMetadata | null {
  const posting = extractFirstJsonLdJobPosting(html)
  if (posting) {
    return mapJobPostingMetadata(posting, baseUrl, fallbackCompany)
  }

  const description = extractMetaContent(html, 'description') || extractMetaPropertyContent(html, 'og:description')
  if (!description) return null

  return {
    description: summarizeDescription(description),
    remote_type: guessRemoteType([description]),
  }
}

export async function extractJobPostingFromUrl(rawUrl: string): Promise<JobUrlMetadata> {
  const requestedUrl = normalizeJobPostingUrl(rawUrl)
  const response = await fetchWithTimeout(requestedUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; CareerCockpitBot/1.0)',
    },
  }, 15000)

  if (!response.ok) {
    throw new Error(`Job URL fetch failed with status ${response.status}.`)
  }

  const finalUrl = normalizeJobPostingUrl(response.url || requestedUrl)
  const html = await response.text()
  const fallbackCompany = readHostnameLabel(finalUrl)
  const metadata = extractJobPageMetadata(html, finalUrl, fallbackCompany) ?? {}
  const title =
    metadata.title ||
    cleanPageTitle(
      extractMetaPropertyContent(html, 'og:title') ||
      extractMetaContent(html, 'twitter:title') ||
      extractPageTitle(html)
    ) ||
    deriveTitleFromUrl(finalUrl) ||
    'Imported role'
  const description =
    metadata.description ||
    summarizeDescription(
      extractMetaContent(html, 'description') ||
      extractMetaPropertyContent(html, 'og:description')
    )
  const jobUrl = metadata.job_url ? normalizeJobPostingUrl(metadata.job_url) : finalUrl

  return {
    external_id: metadata.external_id || deriveExternalIdFromUrl(jobUrl),
    title,
    company: metadata.company || fallbackCompany,
    location: metadata.location || '',
    remote_type: metadata.remote_type || guessRemoteType([metadata.location ?? '', description]),
    employment_type: metadata.employment_type || inferEmploymentType([title, description]),
    salary_range: metadata.salary_range || '',
    job_url: jobUrl,
    description,
    source_label: 'Job URL',
  }
}

function extractJsonLdSearchResults(
  html: string,
  baseUrl: string,
  source: ConnectorSource,
  sourceLabel: string,
  fallbackCompany: string,
): SearchResult[] {
  const unique = new Map<string, SearchResult>()

  for (const posting of collectJobPostingNodes(html)) {
    const metadata = mapJobPostingMetadata(posting, baseUrl, fallbackCompany)
    if (!metadata?.title || !metadata.job_url) continue

    const externalId = metadata.external_id || deriveExternalIdFromUrl(metadata.job_url)
    if (!externalId) continue

    unique.set(externalId, {
      source,
      external_id: externalId,
      source_label: sourceLabel,
      title: metadata.title,
      company: metadata.company || fallbackCompany,
      location: metadata.location || '',
      remote_type: metadata.remote_type || 'unknown',
      employment_type: metadata.employment_type || '',
      salary_range: metadata.salary_range || '',
      job_url: metadata.job_url,
      description: metadata.description || '',
    })
  }

  return [...unique.values()]
}

function extractFirstJsonLdJobPosting(html: string): Record<string, unknown> | null {
  return collectJobPostingNodes(html)[0] ?? null
}

function collectJobPostingNodes(html: string): Record<string, unknown>[] {
  const matches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  const output: Record<string, unknown>[] = []

  for (const match of matches) {
    const content = decodeHtmlEntities(match[1] ?? '').trim()
    if (!content) continue

    try {
      const parsed = JSON.parse(content)
      collectJobPostingNodesFromValue(parsed, output)
    } catch {
      continue
    }
  }

  return output
}

function collectJobPostingNodesFromValue(value: unknown, output: Record<string, unknown>[]) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectJobPostingNodesFromValue(entry, output))
    return
  }

  const object = asObject(value)
  if (!object) return

  if (isJobPostingObject(object)) {
    output.push(object)
  }

  for (const nested of Object.values(object)) {
    if (nested && typeof nested === 'object') {
      collectJobPostingNodesFromValue(nested, output)
    }
  }
}

function isJobPostingObject(value: Record<string, unknown>): boolean {
  const type = value['@type']
  if (typeof type === 'string') return type.toLowerCase() === 'jobposting'
  if (Array.isArray(type)) {
    return type.some((entry) => typeof entry === 'string' && entry.toLowerCase() === 'jobposting')
  }
  return false
}

function mapJobPostingMetadata(
  posting: Record<string, unknown>,
  baseUrl: string,
  fallbackCompany: string,
): JobPageMetadata | null {
  const title = asString(posting.title)
  const rawUrl = asString(posting.url) || asString(posting.applyUrl)
  const jobUrl = rawUrl ? resolveMaybeRelativeUrl(baseUrl, rawUrl) : ''
  if (!title && !jobUrl) return null

  const hiringOrganization = asObject(posting.hiringOrganization)
  const location = extractJobPostingLocation(posting.jobLocation)
  const description = summarizeDescription(asString(posting.description))
  const employmentType = humanizeEnum(firstString(posting.employmentType) || asString(posting.employmentType))
  const remoteType = asString(posting.jobLocationType).toUpperCase() === 'TELECOMMUTE'
    ? 'remote'
    : guessRemoteType([location, description])

  return {
    external_id: asString(asObject(posting.identifier)?.value) || deriveExternalIdFromUrl(jobUrl),
    title: title || deriveTitleFromUrl(jobUrl),
    company: asString(hiringOrganization?.name) || fallbackCompany,
    location,
    remote_type: remoteType,
    employment_type: employmentType,
    salary_range: formatJobPostingSalary(posting.baseSalary),
    job_url: jobUrl,
    description,
  }
}

function extractJobPostingLocation(value: unknown): string {
  const locations = Array.isArray(value) ? value : [value]

  const parts = locations
    .map((entry) => {
      const address = asObject(asObject(entry)?.address)
      if (!address) return asString(asObject(entry)?.name)
      return [
        asString(address.addressLocality),
        asString(address.addressRegion),
        asString(address.addressCountry),
      ].filter(Boolean).join(', ')
    })
    .filter(Boolean)

  return parts.join(' | ')
}

function formatJobPostingSalary(value: unknown): string {
  const salary = asObject(value)
  if (!salary) return ''

  const currency = asString(asObject(salary.currency)?.name) || asString(salary.currency)
  const unit = asString(asObject(salary.unitText)?.name) || asString(salary.unitText)
  const salaryValue = asObject(salary.value)
  const minValue = toNumber(salaryValue?.minValue ?? salaryValue?.value)
  const maxValue = toNumber(salaryValue?.maxValue)

  if (!Number.isFinite(minValue) && !Number.isFinite(maxValue)) return ''

  const formatted = Number.isFinite(maxValue)
    ? `${currency}${Math.round(minValue).toLocaleString()} - ${currency}${Math.round(maxValue).toLocaleString()}`
    : `${currency}${Math.round(minValue).toLocaleString()}`
  return unit ? `${formatted} / ${unit}` : formatted
}

function extractMetaContent(html: string, name: string): string {
  const pattern = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')
  return decodeHtmlEntities(html.match(pattern)?.[1] ?? '').trim()
}

function extractMetaPropertyContent(html: string, property: string): string {
  const pattern = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')
  return decodeHtmlEntities(html.match(pattern)?.[1] ?? '').trim()
}

function extractPageTitle(html: string): string {
  return decodeHtmlEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim()
}

function cleanPageTitle(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  return trimmed
    .replace(/\s+/g, ' ')
    .split(/\s(?:-|\u2013|\u2014|\|)\s/)
    .map((part) => part.trim())
    .filter(Boolean)[0] ?? trimmed
}

function normalizeJobPostingUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) throw new Error('job_url is required.')

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const parsed = new URL(withProtocol)

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https job URLs are supported.')
  }

  const hostname = parsed.hostname.toLowerCase()
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('127.') ||
    hostname.startsWith('10.') ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    hostname === '[::1]'
  ) {
    throw new Error('Local or private network URLs are not supported.')
  }

  parsed.hash = ''
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ['ref', 'ref_src', 'source', 'trk', 'gh_src'].includes(key.toLowerCase())) {
      parsed.searchParams.delete(key)
    }
  }
  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '')
  }

  return parsed.toString()
}

function deriveExternalIdFromUrl(url: string): string {
  if (!url) return ''

  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)
    return sanitizeToken(parts.at(-1) ?? parsed.pathname)
  } catch {
    return sanitizeToken(url)
  }
}

function deriveTitleFromUrl(url: string): string {
  if (!url) return ''

  try {
    const parsed = new URL(url)
    const lastPart = parsed.pathname.split('/').filter(Boolean).at(-1) ?? ''
    return humanizeToken(lastPart.replace(/\.[a-z]+$/i, ''))
  } catch {
    return humanizeToken(url)
  }
}

function formatWorkableLocation(job: Record<string, unknown>): string {
  const location = asObject(job.location)
  return asString(location?.location_str)
    || [
      asString(location?.city),
      asString(location?.region),
      asString(location?.country),
    ].filter(Boolean).join(', ')
    || asString(job.location)
}

function mapWorkableRemoteType(
  job: Record<string, unknown>,
  location: string,
  description: string,
): RemoteType {
  const workplace = normalizeText(asString(job.workplace))
  if (job.remote === true || workplace.includes('remote')) return 'remote'
  if (workplace.includes('hybrid')) return 'hybrid'
  if (workplace.includes('on site') || workplace.includes('onsite')) return 'onsite'
  return guessRemoteType([location, description])
}

function formatWorkableSalary(job: Record<string, unknown>): string {
  const compensation = asObject(job.compensation)
  if (compensation) {
    return asString(compensation.summary)
      || asString(compensation.salary_range)
      || asString(compensation.salaryRange)
  }
  return asString(job.salary_range) || asString(job.salaryRange)
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
  const strongOffTargetGtmTitleHits = countPhraseMatches(title, STRONG_OFF_TARGET_GTM_TITLE_PHRASES)
  const strongOffTargetGtmTextHits = countPhraseMatches(jobText, STRONG_OFF_TARGET_GTM_TEXT_PHRASES)
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

  if (strongOffTargetGtmTitleHits > 0) {
    score -= targetContextHits <= 2 ? 22 : 12
  }

  if (containsAnyPhrase(title, OFF_TARGET_TITLE_PHRASES)) {
    score -= targetContextHits <= 1 ? 16 : 8
  }

  if (strongOffTargetGtmTextHits >= 2 && targetContextHits <= 2) {
    score -= 10
  } else if (strongOffTargetGtmTextHits > 0 && targetContextHits === 0) {
    score -= 6
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

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value)
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

async function searchAdzuna(request: Required<SearchRequest>): Promise<SearchResult[]> {
  const appId = Deno.env.get('ADZUNA_APP_ID')
  const appKey = Deno.env.get('ADZUNA_APP_KEY')

  if (!appId || !appKey) {
    throw new Error('Adzuna search requires ADZUNA_APP_ID and ADZUNA_APP_KEY in Supabase secrets.')
  }

  // Defaulting to US, could be enhanced later
  const country = 'us'
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(Math.min(request.limit, 50)),
  })

  if (request.query) params.set('what', request.query)
  if (request.location) params.set('where', request.location)

  const response = await fetchWithTimeout(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`Adzuna search failed with status ${response.status}.`)
  }

  const payload = (await response.json()) as { results?: Array<Record<string, unknown>> }
  const normalized = (payload.results ?? []).map((job) => {
    const title = asString(job.title)
    const company = asString(asObject(job.company)?.display_name) || 'Unknown'
    const locationObj = asObject(job.location)
    const location = locationObj ? asString(locationObj.display_name) : ''
    const description = asString(job.description)

    return {
      source: 'adzuna' as const,
      external_id: asString(job.id) || String(Math.random()),
      source_label: 'Adzuna Public Search',
      title,
      company,
      location,
      remote_type: guessRemoteType([location, title, description]),
      employment_type: asString(job.contract_type) || inferEmploymentType([title, description]),
      salary_range: '',
      job_url: asString(job.redirect_url),
      description: summarizeDescription(description),
    }
  })

  return rankAndLimit(normalized, request)
}
