import {
  ApplicationRecord,
  CompanyWatchlist,
  JobPosting,
  JobSource,
  JobSyncRun,
  ProofOfWorkHighlight,
  SavedJobSearch,
} from '@/types'

export type AnalyticsWindow = '7d' | '30d' | '90d' | 'all'

export type AnalyticsFunnelRow = {
  id: string
  label: string
  jobs: number
  tracked: number
  applied: number
  responses: number
  interviews: number
  offers: number
  track_rate: number
  response_rate: number
  interview_rate: number
  offer_rate: number
  runs?: number
  imported?: number
  found?: number
  unattributed?: boolean
}

export type PacketAnalyticsRow = {
  id: 'incomplete' | 'core_ready' | 'polished'
  label: string
  applications: number
  applied: number
  interviews: number
  offers: number
  interview_rate: number
  offer_rate: number
}

export type AnalyticsOverviewCard = {
  id: string
  label: string
  value: string
  detail: string
}

export type AnalyticsInsight = {
  id: string
  title: string
  body: string
  surface: 'activity' | 'jobs' | 'applications'
}

export type CareerAnalytics = {
  window: AnalyticsWindow
  windowLabel: string
  overview: AnalyticsOverviewCard[]
  insights: AnalyticsInsight[]
  sourceRows: AnalyticsFunnelRow[]
  savedSearchRows: AnalyticsFunnelRow[]
  watchlistRows: AnalyticsFunnelRow[]
  queryRows: AnalyticsFunnelRow[]
  packetRows: PacketAnalyticsRow[]
  unattributedImportedJobs: number
}

type AnalyticsArgs = {
  jobs: JobPosting[]
  applications: ApplicationRecord[]
  savedSearches: SavedJobSearch[]
  syncRuns: JobSyncRun[]
  watchlists: CompanyWatchlist[]
  highlights: ProofOfWorkHighlight[]
  window: AnalyticsWindow
}

const APPLIED_OR_BEYOND = new Set<ApplicationRecord['status']>([
  'applied',
  'interview',
  'offer',
  'rejected',
  'archived',
])

const RESPONSE_STATUSES = new Set<ApplicationRecord['status']>(['interview', 'offer', 'rejected'])
const INTERVIEW_STATUSES = new Set<ApplicationRecord['status']>(['interview', 'offer'])

export function buildCareerAnalytics({
  jobs,
  applications,
  savedSearches,
  syncRuns,
  watchlists,
  highlights,
  window,
}: AnalyticsArgs): CareerAnalytics {
  const windowStart = getWindowStart(window)
  const applicationsByJobId = new Map<string, ApplicationRecord[]>()
  const highlightCountByApplicationId = new Map<string, number>()
  const watchlistById = new Map(watchlists.map((watchlist) => [watchlist.id, watchlist]))
  const savedSearchById = new Map(savedSearches.map((savedSearch) => [savedSearch.id, savedSearch]))

  for (const application of applications) {
    const existing = applicationsByJobId.get(application.job_posting_id) ?? []
    applicationsByJobId.set(application.job_posting_id, [...existing, application])
  }

  for (const highlight of highlights) {
    if (!highlight.application_id) continue
    highlightCountByApplicationId.set(
      highlight.application_id,
      (highlightCountByApplicationId.get(highlight.application_id) ?? 0) + 1
    )
  }

  const sourceRows = groupJobs(jobs, applicationsByJobId, (job) => ({
    id: job.source,
    label: humanizeJobSource(job.source),
  }))

  const savedSearchRows = savedSearches
    .map((savedSearch) => {
      const savedJobs = jobs.filter((job) => job.saved_job_search_id === savedSearch.id)
      const baseRow = summarizeJobs(savedJobs, applicationsByJobId)
      const relatedRuns = syncRuns.filter((run) => run.saved_job_search_id === savedSearch.id)
      return {
        id: savedSearch.id,
        label: savedSearch.name,
        runs: relatedRuns.length,
        found: relatedRuns.reduce((sum, run) => sum + run.result_count, 0),
        imported: relatedRuns.reduce((sum, run) => sum + run.imported_count, 0),
        ...baseRow,
      } satisfies AnalyticsFunnelRow
    })
    .sort(compareFunnelRows)

  const watchlistRows = watchlists
    .map((watchlist) => {
      const watchlistJobs = jobs.filter((job) => job.watchlist_id === watchlist.id)
      const baseRow = summarizeJobs(watchlistJobs, applicationsByJobId)
      const relatedRuns = syncRuns.filter((run) => run.watchlist_id === watchlist.id)
      return {
        id: watchlist.id,
        label: watchlist.company_name,
        runs: relatedRuns.length,
        found: relatedRuns.reduce((sum, run) => sum + run.result_count, 0),
        imported: relatedRuns.reduce((sum, run) => sum + run.imported_count, 0),
        ...baseRow,
      } satisfies AnalyticsFunnelRow
    })
    .sort(compareFunnelRows)

  const queryRows = groupJobs(jobs, applicationsByJobId, (job) => ({
    id: buildQueryKey(job, watchlistById),
    label: resolveQueryLabel(job, watchlistById),
  }))

  const packetRows = buildPacketRows(applications, highlightCountByApplicationId)

  const unattributedImportedJobs = jobs.filter(
    (job) => job.source !== 'manual' && !job.watchlist_id && !job.saved_job_search_id
  ).length

  const overview = buildOverview({
    jobs,
    applications,
    syncRuns,
    windowStart,
  })

  const insights = buildInsights({
    sourceRows,
    watchlistRows,
    savedSearchRows,
    queryRows,
    packetRows,
    unattributedImportedJobs,
  })

  return {
    window,
    windowLabel: describeWindow(window),
    overview,
    insights,
    sourceRows,
    savedSearchRows,
    watchlistRows,
    queryRows,
    packetRows,
    unattributedImportedJobs,
  }
}

function buildOverview({
  jobs,
  applications,
  syncRuns,
  windowStart,
}: {
  jobs: JobPosting[]
  applications: ApplicationRecord[]
  syncRuns: JobSyncRun[]
  windowStart: Date | null
}): AnalyticsOverviewCard[] {
  const jobsImported = jobs.filter((job) => isInWindow(job.created_at, windowStart)).length
  const applicationsStarted = applications.filter((application) => isInWindow(application.created_at, windowStart)).length
  const applicationsApplied = applications.filter((application) =>
    isInWindow(resolveAppliedDate(application), windowStart)
  ).length
  const runsInWindow = syncRuns.filter((run) => isInWindow(run.started_at, windowStart))
  const successfulRuns = runsInWindow.filter((run) => run.status === 'success').length
  const syncSuccessRate = runsInWindow.length > 0 ? successfulRuns / runsInWindow.length : 0

  return [
    {
      id: 'jobs',
      label: 'Jobs imported',
      value: String(jobsImported),
      detail: 'New opportunities pulled into Discover.',
    },
    {
      id: 'tracked',
      label: 'Applications started',
      value: String(applicationsStarted),
      detail: 'Jobs moved into the active pipeline.',
    },
    {
      id: 'applied',
      label: 'Applications submitted',
      value: String(applicationsApplied),
      detail: 'Submitted in the selected activity window.',
    },
    {
      id: 'sync',
      label: 'Sync success',
      value: runsInWindow.length > 0 ? `${Math.round(syncSuccessRate * 100)}%` : 'n/a',
      detail: runsInWindow.length > 0
        ? `${successfulRuns} of ${runsInWindow.length} sync runs completed successfully.`
        : 'No sync runs in this window.',
    },
  ]
}

function buildInsights({
  sourceRows,
  watchlistRows,
  savedSearchRows,
  queryRows,
  packetRows,
  unattributedImportedJobs,
}: {
  sourceRows: AnalyticsFunnelRow[]
  watchlistRows: AnalyticsFunnelRow[]
  savedSearchRows: AnalyticsFunnelRow[]
  queryRows: AnalyticsFunnelRow[]
  packetRows: PacketAnalyticsRow[]
  unattributedImportedJobs: number
}): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = []

  const bestSource = sourceRows
    .filter((row) => row.applied >= 2)
    .sort((left, right) => right.interview_rate - left.interview_rate || right.interviews - left.interviews)[0]

  if (bestSource) {
    insights.push({
      id: 'best-source',
      title: `Best source: ${bestSource.label}`,
      body: `${bestSource.interviews} interviews from ${bestSource.applied} submitted applications (${formatRate(bestSource.interview_rate)} interview rate).`,
      surface: 'jobs',
    })
  }

  const weakQuery = queryRows
    .filter((row) => row.applied >= 2 && row.interviews === 0 && row.label !== 'Unattributed')
    .sort((left, right) => right.applied - left.applied || right.jobs - left.jobs)[0]

  if (weakQuery) {
    insights.push({
      id: 'weak-query',
      title: `Weak query: ${weakQuery.label}`,
      body: `${weakQuery.applied} submitted applications have produced no interviews yet. Either tighten the search or redirect effort.`,
      surface: 'jobs',
    })
  }

  const bestWatchlist = watchlistRows
    .filter((row) => row.applied >= 1)
    .sort((left, right) => right.interviews - left.interviews || right.response_rate - left.response_rate)[0]

  if (bestWatchlist) {
    insights.push({
      id: 'best-watchlist',
      title: `Best company lane: ${bestWatchlist.label}`,
      body: `${bestWatchlist.tracked} tracked roles and ${bestWatchlist.interviews} interviews. Keep this company pipeline warm.`,
      surface: 'activity',
    })
  }

  const polishedPacket = packetRows.find((row) => row.id === 'polished')
  const incompletePacket = packetRows.find((row) => row.id === 'incomplete')
  if (polishedPacket && incompletePacket && polishedPacket.applied > 0) {
    insights.push({
      id: 'packet-effect',
      title: 'Packet quality matters',
      body: `Polished packets are converting at ${formatRate(polishedPacket.interview_rate)} interview rate versus ${formatRate(incompletePacket.interview_rate)} for incomplete packets.`,
      surface: 'applications',
    })
  }

  const bestSavedSearch = savedSearchRows
    .filter((row) => (row.imported ?? 0) > 0 || row.jobs > 0)
    .sort((left, right) => right.interviews - left.interviews || (right.imported ?? 0) - (left.imported ?? 0))[0]

  if (bestSavedSearch) {
    insights.push({
      id: 'best-saved-search',
      title: `Best saved search: ${bestSavedSearch.label}`,
      body: `${bestSavedSearch.imported ?? 0} imported roles and ${bestSavedSearch.interviews} interviews tied to this search so far.`,
      surface: 'jobs',
    })
  }

  if (unattributedImportedJobs > 0) {
    insights.push({
      id: 'unattributed',
      title: 'Attribution caveat',
      body: `${unattributedImportedJobs} older imported jobs do not yet carry saved-search attribution, so saved-search conversion rows are strongest on new data going forward.`,
      surface: 'activity',
    })
  }

  return insights
}

function buildPacketRows(
  applications: ApplicationRecord[],
  highlightCountByApplicationId: Map<string, number>
): PacketAnalyticsRow[] {
  const buckets: Record<PacketAnalyticsRow['id'], PacketAnalyticsRow> = {
    incomplete: { id: 'incomplete', label: 'Incomplete packet', applications: 0, applied: 0, interviews: 0, offers: 0, interview_rate: 0, offer_rate: 0 },
    core_ready: { id: 'core_ready', label: 'Core packet ready', applications: 0, applied: 0, interviews: 0, offers: 0, interview_rate: 0, offer_rate: 0 },
    polished: { id: 'polished', label: 'Polished packet', applications: 0, applied: 0, interviews: 0, offers: 0, interview_rate: 0, offer_rate: 0 },
  }

  for (const application of applications) {
    const highlightCount = highlightCountByApplicationId.get(application.id) ?? 0
    const bucket = resolvePacketBucket(application, highlightCount)
    buckets[bucket].applications += 1
    if (isApplied(application)) buckets[bucket].applied += 1
    if (isInterview(application)) buckets[bucket].interviews += 1
    if (application.status === 'offer') buckets[bucket].offers += 1
  }

  return (Object.values(buckets) as PacketAnalyticsRow[]).map((row) => ({
    ...row,
    interview_rate: row.applied > 0 ? row.interviews / row.applied : 0,
    offer_rate: row.applied > 0 ? row.offers / row.applied : 0,
  }))
}

function groupJobs(
  jobs: JobPosting[],
  applicationsByJobId: Map<string, ApplicationRecord[]>,
  getKey: (job: JobPosting) => { id: string; label: string }
): AnalyticsFunnelRow[] {
  const groups = new Map<string, { label: string; jobs: JobPosting[] }>()

  for (const job of jobs) {
    const group = getKey(job)
    const existing = groups.get(group.id)
    if (existing) {
      existing.jobs.push(job)
    } else {
      groups.set(group.id, { label: group.label, jobs: [job] })
    }
  }

  return Array.from(groups.entries())
    .map(([id, group]) => ({
      id,
      label: group.label,
      ...summarizeJobs(group.jobs, applicationsByJobId),
    }))
    .sort(compareFunnelRows)
}

function summarizeJobs(
  jobs: JobPosting[],
  applicationsByJobId: Map<string, ApplicationRecord[]>
): Omit<AnalyticsFunnelRow, 'id' | 'label' | 'runs' | 'imported' | 'found' | 'unattributed'> {
  const relatedApplications = jobs.flatMap((job) => applicationsByJobId.get(job.id) ?? [])
  const tracked = relatedApplications.length
  const applied = relatedApplications.filter(isApplied).length
  const responses = relatedApplications.filter(isResponse).length
  const interviews = relatedApplications.filter(isInterview).length
  const offers = relatedApplications.filter((application) => application.status === 'offer').length

  return {
    jobs: jobs.length,
    tracked,
    applied,
    responses,
    interviews,
    offers,
    track_rate: jobs.length > 0 ? tracked / jobs.length : 0,
    response_rate: applied > 0 ? responses / applied : 0,
    interview_rate: applied > 0 ? interviews / applied : 0,
    offer_rate: applied > 0 ? offers / applied : 0,
  }
}

function resolvePacketBucket(
  application: ApplicationRecord,
  highlightCount: number
): PacketAnalyticsRow['id'] {
  const coreReady = Boolean(application.resume_variant_id) && Boolean(application.cover_letter.trim())
  if (!coreReady) return 'incomplete'
  const polished = highlightCount > 0 && Boolean(application.follow_up_at)
  return polished ? 'polished' : 'core_ready'
}

function resolveQueryLabel(
  job: JobPosting,
  watchlistById: Map<string, CompanyWatchlist>
): string {
  if (job.query_label.trim()) return job.query_label.trim()
  if (job.watchlist_id) {
    const watchlistQuery = watchlistById.get(job.watchlist_id)?.preferred_query.trim()
    if (watchlistQuery) return watchlistQuery
  }
  return 'Unattributed'
}

function buildQueryKey(
  job: JobPosting,
  watchlistById: Map<string, CompanyWatchlist>
): string {
  return resolveQueryLabel(job, watchlistById).toLowerCase()
}

function isApplied(application: ApplicationRecord) {
  return Boolean(application.applied_at) || APPLIED_OR_BEYOND.has(application.status)
}

function isResponse(application: ApplicationRecord) {
  return RESPONSE_STATUSES.has(application.status)
}

function isInterview(application: ApplicationRecord) {
  return INTERVIEW_STATUSES.has(application.status)
}

function resolveAppliedDate(application: ApplicationRecord): string | null {
  if (application.applied_at) return application.applied_at
  if (isApplied(application)) return application.updated_at
  return null
}

function isInWindow(value: string | null, windowStart: Date | null) {
  if (!value) return false
  if (!windowStart) return true
  return new Date(value).getTime() >= windowStart.getTime()
}

function getWindowStart(window: AnalyticsWindow): Date | null {
  if (window === 'all') return null
  const days = window === '7d' ? 7 : window === '30d' ? 30 : 90
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function describeWindow(window: AnalyticsWindow) {
  if (window === '7d') return 'Last 7 days'
  if (window === '30d') return 'Last 30 days'
  if (window === '90d') return 'Last 90 days'
  return 'All time'
}

function compareFunnelRows(left: AnalyticsFunnelRow, right: AnalyticsFunnelRow) {
  return right.interviews - left.interviews
    || right.applied - left.applied
    || right.jobs - left.jobs
    || left.label.localeCompare(right.label)
}

function formatRate(value: number) {
  return `${Math.round(value * 100)}%`
}

function humanizeJobSource(source: JobSource) {
  if (source === 'usajobs') return 'USAJobs'
  if (source === 'smartrecruiters') return 'SmartRecruiters'
  if (source === 'icims') return 'iCIMS'
  return source.charAt(0).toUpperCase() + source.slice(1)
}
