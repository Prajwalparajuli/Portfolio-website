import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Archive,
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  Compass,
  ExternalLink,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { getAdminPath } from '@/lib/adminConfig'
import { discoverWatchlist, intakeJobUrl, refreshHybridMatches, runScheduledWatchlists } from '@/lib/careerCockpit'
import { searchExternalJobs } from '@/lib/jobSearch'
import { scoreJobFit } from '@/lib/jobMatching'
import {
  createJobPosting,
  createJobSyncRun,
  createSavedJobSearch,
  deleteSavedJobSearch,
  getAllProjects,
  getApplications,
  getCompanyWatchlists,
  getJobMatches,
  getJobPostings,
  getJobSyncRuns,
  getResumeWorkspace,
  getSavedJobSearches,
  getSkills,
  saveApplication,
  updateJobPosting,
  updateJobSyncRun,
  updateSavedJobSearch,
  upsertImportedJobPosting,
} from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type {
  ApplicationRecord,
  CandidateProfile,
  CompanyWatchlist,
  ExternalJobSearchRequest,
  ExternalJobSearchResult,
  JobFitAssessment,
  JobMatch,
  JobPosting,
  JobPostingFormData,
  JobSearchSource,
  JobSyncRun,
  JobSyncRunInput,
  Project,
  SavedJobSearch,
  SavedJobSearchInput,
  Skill,
} from '@/types'
import type { ResumeVariant } from '@/types/resume'

const EMPTY_SEARCH_FORM: ExternalJobSearchRequest = {
  source: 'google_jobs',
  query: '',
  location: '',
  boardOrSite: '',
  remoteOnly: false,
  limit: 25,
}

const EMPTY_JOB_FORM: JobPostingFormData = {
  source: 'manual',
  external_id: '',
  watchlist_id: null,
  saved_job_search_id: null,
  query_label: '',
  title: '',
  company: '',
  location: '',
  remote_type: 'unknown',
  employment_type: '',
  salary_range: '',
  job_url: '',
  description: '',
  fit_notes: '',
  discovery_status: 'manual',
  source_text: '',
  embedding_updated_at: null,
}

const SOURCE_OPTIONS: Array<{ value: JobSearchSource; label: string }> = [
  { value: 'google_jobs', label: 'Google Jobs' },
  { value: 'adzuna', label: 'Adzuna' },
  { value: 'usajobs', label: 'USAJobs' },
  { value: 'greenhouse', label: 'Greenhouse' },
  { value: 'lever', label: 'Lever' },
  { value: 'workday', label: 'Workday' },
  { value: 'ashby', label: 'Ashby' },
  { value: 'smartrecruiters', label: 'SmartRecruiters' },
  { value: 'icims', label: 'iCIMS' },
  { value: 'workable', label: 'Workable' },
  { value: 'jobvite', label: 'Jobvite' },
]

type DiscoverView = 'search' | 'imported'
type JobFilter = 'all' | 'strong' | 'review' | 'tracked'
type CareerStage = 'student' | 'early' | 'open'
type SearchCriteria = {
  careerStage: CareerStage
  requiredSkills: string
  excludeTerms: string
  onlyPortfolioAligned: boolean
}
type DiscoverSession = {
  panelMode: DiscoverView
  searchForm: ExternalJobSearchRequest
  searchResults: ExternalJobSearchResult[]
  activeFilter: JobFilter
  selectedSavedJobId: string | null
  selectedSearchKey: string | null
  searchCriteria: SearchCriteria
}

const DISCOVER_SESSION_KEY = 'career-cockpit-discover-session-v1'
const DEFAULT_SEARCH_CRITERIA: SearchCriteria = {
  careerStage: 'early',
  requiredSkills: '',
  excludeTerms: '',
  onlyPortfolioAligned: true,
}

export function AdminJobs() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSession = useMemo(() => readDiscoverSession(), [])
  const [jobs, setJobs] = useState<JobPosting[] | null>([])
  const [applications, setApplications] = useState<ApplicationRecord[] | null>([])
  const [savedSearches, setSavedSearches] = useState<SavedJobSearch[] | null>([])
  const [syncRuns, setSyncRuns] = useState<JobSyncRun[] | null>([])
  const [jobMatches, setJobMatches] = useState<JobMatch[] | null>([])
  const [watchlists, setWatchlists] = useState<CompanyWatchlist[] | null>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null)
  const [resumeVariants, setResumeVariants] = useState<ResumeVariant[]>([])
  const [searchForm, setSearchForm] = useState<ExternalJobSearchRequest>(
    initialSession?.searchForm ?? EMPTY_SEARCH_FORM
  )
  const [manualJobForm, setManualJobForm] = useState<JobPostingFormData>(EMPTY_JOB_FORM)
  const [quickJobUrl, setQuickJobUrl] = useState('')
  const [searchResults, setSearchResults] = useState<ExternalJobSearchResult[]>(
    initialSession?.searchResults ?? []
  )
  const [activeFilter, setActiveFilter] = useState<JobFilter>(initialSession?.activeFilter ?? 'all')
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>(
    initialSession?.searchCriteria ?? DEFAULT_SEARCH_CRITERIA
  )
  const [pageError, setPageError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [runningQueryPack, setRunningQueryPack] = useState(false)
  const [savingSearchId, setSavingSearchId] = useState<string | null>(null)
  const [runningSearchId, setRunningSearchId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [trackingJobId, setTrackingJobId] = useState<string | null>(null)
  const [importingKey, setImportingKey] = useState<string | null>(null)
  const [archivingJobId, setArchivingJobId] = useState<string | null>(null)
  const [refreshingJobId, setRefreshingJobId] = useState<string | null>(null)
  const [creatingManualJob, setCreatingManualJob] = useState(false)
  const [intakingJobUrl, setIntakingJobUrl] = useState(false)
  const [workingWatchlistId, setWorkingWatchlistId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<DiscoverView>(
    searchParams.get('view') === 'imported'
      ? 'imported'
      : initialSession?.panelMode ?? 'search'
  )
  const [selectedSavedJobId, setSelectedSavedJobId] = useState<string | null>(
    searchParams.get('job') ?? initialSession?.selectedSavedJobId ?? null
  )
  const [selectedSearchKey, setSelectedSearchKey] = useState<string | null>(
    searchParams.get('result') ?? initialSession?.selectedSearchKey ?? null
  )

  useEffect(() => {
    let mounted = true

    Promise.all([
      getJobPostings(),
      getApplications(),
      getSavedJobSearches(),
      getJobSyncRuns(),
      getJobMatches(),
      getCompanyWatchlists(),
      getSkills(),
      getAllProjects(),
      getResumeWorkspace(),
    ]).then(
      ([
        jobData,
        applicationData,
        savedSearchData,
        syncRunData,
        matchData,
        watchlistData,
        skillData,
        projectData,
        workspace,
      ]) => {
        if (!mounted) return
        setJobs(jobData)
        setApplications(applicationData)
        setSavedSearches(savedSearchData)
        setSyncRuns(syncRunData)
        setJobMatches(matchData)
        setWatchlists(watchlistData)
        setSkills(skillData)
        setProjects(projectData)
        setCandidateProfile(workspace.candidateProfile)
        setResumeVariants(workspace.variants)
      }
    )

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const nextMode = searchParams.get('view') === 'imported' ? 'imported' : 'search'
    const nextJobId = searchParams.get('job')
    const nextResult = searchParams.get('result')

    if (nextMode !== panelMode) setPanelMode(nextMode)
    if (nextJobId !== selectedSavedJobId) setSelectedSavedJobId(nextJobId)
    if (nextResult !== selectedSearchKey) setSelectedSearchKey(nextResult)
  }, [searchParams])

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('view', panelMode)

    if (panelMode === 'imported') {
      if (selectedSavedJobId) nextParams.set('job', selectedSavedJobId)
      else nextParams.delete('job')
      nextParams.delete('result')
    } else {
      if (selectedSearchKey) nextParams.set('result', selectedSearchKey)
      else nextParams.delete('result')
      nextParams.delete('job')
    }

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [panelMode, searchParams, selectedSavedJobId, selectedSearchKey, setSearchParams])

  useEffect(() => {
    writeDiscoverSession({
      panelMode,
      searchForm,
      searchResults,
      activeFilter,
      selectedSavedJobId,
      selectedSearchKey,
      searchCriteria,
    })
  }, [
    activeFilter,
    panelMode,
    searchCriteria,
    searchForm,
    searchResults,
    selectedSavedJobId,
    selectedSearchKey,
  ])

  const schemaReady = jobs !== null && applications !== null
  const searchesSupported = savedSearches !== null
  const syncHistorySupported = savedSearches !== null && syncRuns !== null
  const primaryVariant = useMemo(
    () => resumeVariants.find((variant) => variant.isPrimary) ?? resumeVariants[0] ?? null,
    [resumeVariants]
  )

  const jobsById = useMemo(() => new Map((jobs ?? []).map((job) => [job.id, job])), [jobs])
  const applicationsByJobId = useMemo(
    () => new Map((applications ?? []).map((application) => [application.job_posting_id, application])),
    [applications]
  )
  const applicationByExternalKey = useMemo(() => {
    const entries = new Map<string, ApplicationRecord>()

    for (const application of applications ?? []) {
      const job = jobsById.get(application.job_posting_id)
      if (!job?.external_id) continue
      entries.set(`${job.source}:${job.external_id}`, application)
    }

    return entries
  }, [applications, jobsById])
  const persistedMatchById = useMemo(
    () => new Map((jobMatches ?? []).map((match) => [match.job_posting_id, match])),
    [jobMatches]
  )

  const fitById = useMemo(() => {
    return new Map(
      (jobs ?? []).map((job) => [
        job.id,
        scoreJobFit({
          job,
          skills,
          projects,
          resumeVariant: primaryVariant,
          candidateProfile,
        }),
      ])
    )
  }, [candidateProfile, jobs, primaryVariant, projects, skills])

  const importedExternalKeys = useMemo(
    () =>
      new Set(
        (jobs ?? [])
          .filter((job) => Boolean(job.external_id))
          .map((job) => `${job.source}:${job.external_id}`)
      ),
    [jobs]
  )

  const searchFitByKey = useMemo(() => {
    return new Map(
      searchResults.map((result) => [
        `${result.source}:${result.external_id}`,
        scoreJobFit({
          job: externalResultToJob(result),
          skills,
          projects,
          resumeVariant: primaryVariant,
          candidateProfile,
        }),
      ])
    )
  }, [candidateProfile, primaryVariant, projects, searchResults, skills])

  const portfolioSkillSuggestions = useMemo(
    () => derivePortfolioSkillSuggestions(skills, projects),
    [projects, skills]
  )

  const filteredJobs = useMemo(() => {
    const source = jobs ?? []
    const next = source.filter((job) => {
      if (activeFilter === 'tracked') return applicationsByJobId.has(job.id)

      const band = persistedMatchById.get(job.id)?.band ?? fitById.get(job.id)?.band ?? 'low'
      if (activeFilter === 'strong') return band === 'strong'
      if (activeFilter === 'review') return band === 'review'
      return true
    })

    return next.sort((left, right) => {
      const leftBand = persistedMatchById.get(left.id)?.band ?? fitById.get(left.id)?.band ?? 'low'
      const rightBand = persistedMatchById.get(right.id)?.band ?? fitById.get(right.id)?.band ?? 'low'

      return (
        compareBand(rightBand) - compareBand(leftBand) ||
        Number(applicationsByJobId.has(right.id)) - Number(applicationsByJobId.has(left.id)) ||
        new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
      )
    })
  }, [activeFilter, applicationsByJobId, fitById, jobs, persistedMatchById])

  const filteredSearchResults = useMemo(() => {
    return searchResults
      .filter((result) =>
        matchesSearchCriteria(
          result,
          searchCriteria,
          searchFitByKey.get(`${result.source}:${result.external_id}`) ?? null
        )
      )
      .sort((left, right) => {
      const leftFit = searchFitByKey.get(`${left.source}:${left.external_id}`)
      const rightFit = searchFitByKey.get(`${right.source}:${right.external_id}`)
      return (rightFit?.score ?? 0) - (leftFit?.score ?? 0)
      })
  }, [searchCriteria, searchFitByKey, searchResults])

  const selectedImportedJob =
    filteredJobs.find((job) => job.id === selectedSavedJobId) ?? filteredJobs[0] ?? null
  const selectedSearchResult =
    filteredSearchResults.find((result) => `${result.source}:${result.external_id}` === selectedSearchKey) ??
    filteredSearchResults[0] ??
    null

  const selectedImportedFit = selectedImportedJob
    ? (() => {
        const persistedMatch = persistedMatchById.get(selectedImportedJob.id)
        const computedFit = fitById.get(selectedImportedJob.id) ?? null

        if (persistedMatch) {
          return {
            score: persistedMatch.total_score ?? computedFit?.score ?? 0,
            band: persistedMatch.band ?? computedFit?.band ?? 'low',
            summary: persistedMatch.reason_summary ?? computedFit?.summary ?? 'No fit notes yet.',
          }
        }

        return computedFit
      })()
    : null

  const selectedSearchFit = selectedSearchResult
    ? searchFitByKey.get(`${selectedSearchResult.source}:${selectedSearchResult.external_id}`) ?? null
    : null

  useEffect(() => {
    if (panelMode !== 'imported') return
    if (!selectedImportedJob) return
    if (selectedImportedJob.id === selectedSavedJobId) return
    setSelectedSavedJobId(selectedImportedJob.id)
  }, [panelMode, selectedImportedJob, selectedSavedJobId])

  useEffect(() => {
    if (panelMode !== 'search') return
    if (!selectedSearchResult) return
    const key = `${selectedSearchResult.source}:${selectedSearchResult.external_id}`
    if (key === selectedSearchKey) return
    setSelectedSearchKey(key)
  }, [filteredSearchResults, panelMode, selectedSearchKey, selectedSearchResult])

  const runSearch = async (request: ExternalJobSearchRequest) => {
    setPanelMode('search')
    setPageError(null)
    setIsSearching(true)

    try {
      const results = await searchExternalJobs(request)
      setSearchResults(results)
      setSelectedSearchKey(results[0] ? `${results[0].source}:${results[0].external_id}` : null)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Search failed.')
      setSearchResults([])
      setSelectedSearchKey(null)
    } finally {
      setIsSearching(false)
    }
  }

  const mergeImportedJobs = (nextJobs: JobPosting[]) => {
    if (nextJobs.length === 0) return

    setJobs((current) => {
      const map = new Map((current ?? []).map((job) => [job.id, job]))
      for (const job of nextJobs) {
        map.set(job.id, job)
      }
      return Array.from(map.values()).sort(
        (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
      )
    })
  }

  const mergeSavedSearch = (nextSearch: SavedJobSearch) => {
    setSavedSearches((current) => {
      const filtered = (current ?? []).filter((entry) => entry.id !== nextSearch.id)
      return [nextSearch, ...filtered]
    })
  }

  const mergeSyncRun = (nextRun: JobSyncRun) => {
    setSyncRuns((current) => {
      const filtered = (current ?? []).filter((entry) => entry.id !== nextRun.id)
      return [nextRun, ...filtered].sort(
        (left, right) => new Date(right.started_at).getTime() - new Date(left.started_at).getTime()
      )
    })
  }

  const importExternalResults = async (
    results: ExternalJobSearchResult[],
    attribution?: { savedJobSearchId?: string | null; queryLabel?: string }
  ) => {
    const importedJobs: JobPosting[] = []

    for (const result of results) {
      const imported = await upsertImportedJobPosting(buildImportedJobPayload(result, attribution))
      if (imported) importedJobs.push(imported)
    }

    mergeImportedJobs(importedJobs)
    return importedJobs.length
  }

  const syncSavedSearch = async (
    savedSearch: SavedJobSearch,
    options?: { runMode?: JobSyncRunInput['run_mode']; updateResults?: boolean }
  ) => {
    const request = searchRequestFromSaved(savedSearch)
    const startedAt = new Date().toISOString()
    let syncRun: JobSyncRun | null = null

    if (syncHistorySupported) {
      syncRun = await createJobSyncRun({
        saved_job_search_id: savedSearch.id,
        watchlist_id: null,
        run_mode: options?.runMode ?? 'single',
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
        metadata: {},
        started_at: startedAt,
        completed_at: null,
      })

      if (syncRun) mergeSyncRun(syncRun)
    }

    try {
      const results = await searchExternalJobs(request)
      const importedCount = await importExternalResults(results, {
        savedJobSearchId: savedSearch.id,
        queryLabel: savedSearch.query,
      })
      const completedAt = new Date().toISOString()

      if (options?.updateResults ?? true) {
        setPanelMode('search')
        setSearchForm(request)
        setSearchResults(results)
        setSelectedSearchKey(results[0] ? `${results[0].source}:${results[0].external_id}` : null)
      }

      if (syncRun) {
        const completedRun = await updateJobSyncRun(syncRun.id, {
          status: 'success',
          result_count: results.length,
          imported_count: importedCount,
          error_message: '',
          completed_at: completedAt,
        })

        if (completedRun) mergeSyncRun(completedRun)
      }

      const updatedSearch = await updateSavedJobSearch(savedSearch.id, {
        last_run_at: completedAt,
        last_error: '',
      })
      if (updatedSearch) mergeSavedSearch(updatedSearch)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed.'
      const completedAt = new Date().toISOString()

      if (syncRun) {
        const failedRun = await updateJobSyncRun(syncRun.id, {
          status: 'error',
          error_message: message,
          completed_at: completedAt,
        })

        if (failedRun) mergeSyncRun(failedRun)
      }

      const updatedSearch = await updateSavedJobSearch(savedSearch.id, {
        last_run_at: completedAt,
        last_error: message,
      })
      if (updatedSearch) mergeSavedSearch(updatedSearch)

      throw error
    }
  }

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault()
    await runSearch(searchForm)
  }

  const handleRunQueryPack = async () => {
    const requests = buildImprovedPortfolioQueryPack(
      searchForm,
      searchCriteria,
      skills,
      projects,
      primaryVariant,
      candidateProfile
    )
    if (requests.length === 0) {
      setPageError('Add a query or seed your skills and projects so the portfolio query pack has something to work from.')
      return
    }

    setPanelMode('search')
    setPageError(null)
    setRunningQueryPack(true)
    setIsSearching(true)

    try {
      const merged = new Map<string, ExternalJobSearchResult>()
      const failures: string[] = []

      for (const request of requests) {
        try {
          const results = await searchExternalJobs(request)
          for (const result of results) {
            merged.set(`${result.source}:${result.external_id}`, result)
          }
        } catch (error) {
          failures.push(error instanceof Error ? error.message : 'Query pack search failed.')
        }
      }

      const nextResults = Array.from(merged.values())
      setSearchResults(nextResults)
      setSelectedSearchKey(nextResults[0] ? `${nextResults[0].source}:${nextResults[0].external_id}` : null)
      if (failures.length > 0) {
        setPageError(failures.join(' '))
      }
    } finally {
      setRunningQueryPack(false)
      setIsSearching(false)
    }
  }

  const handleSaveCurrentSearch = async () => {
    if (!searchesSupported) return

    const suggestedName = buildSearchName(searchForm)
    const nextName = window.prompt('Name this search source', suggestedName)?.trim()
    if (!nextName) return

    const matchingSearch = (savedSearches ?? []).find(
      (entry) => entry.name.toLowerCase() === nextName.toLowerCase()
    )

    setSavingSearchId(matchingSearch?.id ?? 'new')
    try {
      const payload = savedSearchInputFromForm(searchForm, nextName)
      const saved = matchingSearch
        ? await updateSavedJobSearch(matchingSearch.id, payload)
        : await createSavedJobSearch(payload)

      if (saved) mergeSavedSearch(saved)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not save this search.')
    } finally {
      setSavingSearchId(null)
    }
  }

  const handleRunSavedSearch = async (savedSearch: SavedJobSearch) => {
    setRunningSearchId(savedSearch.id)
    setSearchForm(searchRequestFromSaved(savedSearch))

    try {
      await runSearch(searchRequestFromSaved(savedSearch))
    } finally {
      setRunningSearchId(null)
    }
  }

  const handleSyncSavedSearch = async (savedSearch: SavedJobSearch) => {
    if (!syncHistorySupported) return

    setSyncingId(savedSearch.id)
    setPageError(null)

    try {
      await syncSavedSearch(savedSearch)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Sync failed.')
    } finally {
      setSyncingId(null)
    }
  }

  const handleDeleteSavedSearch = async (id: string) => {
    if (!searchesSupported) return

    setSavingSearchId(id)
    try {
      await deleteSavedJobSearch(id)
      setSavedSearches((current) => (current ?? []).filter((entry) => entry.id !== id))
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not delete this search.')
    } finally {
      setSavingSearchId(null)
    }
  }

  const handleToggleSavedSearch = async (savedSearch: SavedJobSearch, checked: boolean) => {
    setSavingSearchId(savedSearch.id)
    try {
      const updated = await updateSavedJobSearch(savedSearch.id, { is_enabled: checked })
      if (updated) mergeSavedSearch(updated)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not update this saved search.')
    } finally {
      setSavingSearchId(null)
    }
  }

  const handleTrackImportedJob = async (job: JobPosting) => {
    setTrackingJobId(job.id)
    try {
      const saved = await saveApplication({
        job_posting_id: job.id,
        resume_variant_id: primaryVariant?.id ?? null,
        status: 'saved',
        follow_up_at: null,
        applied_at: null,
        notes: '',
        cover_letter: '',
      })

      if (!saved) return

      setApplications((current) => {
        const filtered = (current ?? []).filter((application) => application.id !== saved.id)
        return [saved, ...filtered]
      })
      navigate(`${getAdminPath('applications')}?application=${encodeURIComponent(saved.id)}`)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not add this role to Applications.')
    } finally {
      setTrackingJobId(null)
    }
  }

  const persistImportedResult = async (result: ExternalJobSearchResult) => {
    setImportingKey(`${result.source}:${result.external_id}`)

    try {
      const matchingSavedSearch = findMatchingSavedSearch(searchForm, savedSearches ?? [])
      return await upsertImportedJobPosting(
        buildImportedJobPayload(result, {
          savedJobSearchId: matchingSavedSearch?.id ?? null,
          queryLabel: matchingSavedSearch?.query ?? searchForm.query,
        })
      )
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Import failed.')
      return null
    } finally {
      setImportingKey(null)
    }
  }

  const handleImportResult = async (result: ExternalJobSearchResult) => {
    const imported = await persistImportedResult(result)
    if (!imported) return
    mergeImportedJobs([imported])
    setPanelMode('imported')
    setSelectedSavedJobId(imported.id)
  }

  const handleImportAndTailor = async (result: ExternalJobSearchResult) => {
    const imported = await persistImportedResult(result)
    if (!imported) return

    mergeImportedJobs([imported])

    const saved = await saveApplication({
      job_posting_id: imported.id,
      resume_variant_id: primaryVariant?.id ?? null,
      status: 'saved',
      follow_up_at: null,
      applied_at: null,
      notes: '',
      cover_letter: '',
    })

    if (!saved) return

    setApplications((current) => {
      const filtered = (current ?? []).filter((application) => application.id !== saved.id)
      return [saved, ...filtered]
    })
    navigate(`${getAdminPath('applications')}?application=${encodeURIComponent(saved.id)}`)
  }

  const handleArchiveJob = async (jobId: string) => {
    setArchivingJobId(jobId)
    try {
      await updateJobPosting(jobId, { archived_at: new Date().toISOString() })
      setJobs((current) => (current ?? []).filter((job) => job.id !== jobId))
      if (selectedSavedJobId === jobId) setSelectedSavedJobId(null)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not archive this job.')
    } finally {
      setArchivingJobId(null)
    }
  }

  const handleRefreshMatch = async (jobId: string) => {
    setRefreshingJobId(jobId)
    try {
      await refreshHybridMatches([jobId])
      const [nextMatches, nextJobs] = await Promise.all([getJobMatches(), getJobPostings()])
      setJobMatches(nextMatches)
      setJobs(nextJobs)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not refresh the fit score.')
    } finally {
      setRefreshingJobId(null)
    }
  }

  const handleQuickJobUrl = async (event: FormEvent) => {
    event.preventDefault()
    if (!schemaReady) return

    const jobUrl = quickJobUrl.trim()
    if (!jobUrl) return

    setIntakingJobUrl(true)
    setPageError(null)

    try {
      const result = await intakeJobUrl({ jobUrl, createApplication: true })
      mergeImportedJobs([result.job])

      if (!result.matchRefresh.skipped) {
        setJobMatches(await getJobMatches())
      }

      const application = result.application
      if (application) {
        setApplications((current) => {
          const withoutExisting = (current ?? []).filter(
            (entry) => entry.job_posting_id !== application.job_posting_id
          )
          return [application, ...withoutExisting]
        })
        setQuickJobUrl('')
        navigate(`${getAdminPath('applications')}?application=${encodeURIComponent(application.id)}`)
        return
      }

      setQuickJobUrl('')
      setPanelMode('imported')
      setSelectedSavedJobId(result.job.id)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not save this job URL.')
    } finally {
      setIntakingJobUrl(false)
    }
  }

  const handleCreateManualJob = async (event: FormEvent) => {
    event.preventDefault()
    if (!schemaReady) return

    setCreatingManualJob(true)
    try {
      const created = await createJobPosting({
        ...manualJobForm,
        title: manualJobForm.title.trim(),
        company: manualJobForm.company.trim(),
        location: manualJobForm.location.trim(),
        employment_type: manualJobForm.employment_type.trim(),
        salary_range: manualJobForm.salary_range.trim(),
        job_url: manualJobForm.job_url.trim(),
        description: manualJobForm.description.trim(),
        fit_notes: manualJobForm.fit_notes.trim(),
      })

      if (!created) return

      setJobs((current) => [created, ...(current ?? [])])
      setManualJobForm(EMPTY_JOB_FORM)
      setPanelMode('imported')
      setSelectedSavedJobId(created.id)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not create this role.')
    } finally {
      setCreatingManualJob(false)
    }
  }

  const handleDiscoverWatchlist = async (watchlistId: string) => {
    setWorkingWatchlistId(`discover:${watchlistId}`)
    try {
      await discoverWatchlist({ watchlistId })
      setWatchlists(await getCompanyWatchlists())
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not discover this watchlist.')
    } finally {
      setWorkingWatchlistId(null)
    }
  }

  const handleSyncWatchlist = async (watchlistId: string) => {
    setWorkingWatchlistId(`sync:${watchlistId}`)
    try {
      await runScheduledWatchlists(watchlistId)
      const [nextWatchlists, nextSyncRuns, nextJobs] = await Promise.all([
        getCompanyWatchlists(),
        getJobSyncRuns(),
        getJobPostings(),
      ])
      setWatchlists(nextWatchlists)
      setSyncRuns(nextSyncRuns)
      setJobs(nextJobs)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not sync this watchlist.')
    } finally {
      setWorkingWatchlistId(null)
    }
  }

  if (!schemaReady) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Discover</h1>
          <p className="mt-1 text-muted-foreground">
            Run the jobs and applications migrations first to unlock discovery.
          </p>
        </div>
        <Card className="glass">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Apply <code className="rounded bg-black/30 px-1 py-0.5">004_jobs_applications_foundation.sql</code>
            {' '}in Supabase, then reload this page.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Discover</h1>
          <p className="mt-1 text-muted-foreground">
            Search simply, import only the roles worth pursuing, and move the chosen ones into Applications.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={getAdminPath('applications')}>
            <Button variant="outline">Applications</Button>
          </Link>
          <Link to={getAdminPath('today')}>
            <Button variant="outline">Today</Button>
          </Link>
        </div>
      </div>

      <Card className="glass">
        <CardContent className="space-y-4 p-4 md:p-5">
          <form
            className="rounded-xl border border-accent/20 bg-accent/5 p-3"
            onSubmit={handleQuickJobUrl}
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
              <div className="space-y-2">
                <Label htmlFor="quick-job-url">Quick add job URL</Label>
                <Input
                  id="quick-job-url"
                  value={quickJobUrl}
                  onChange={(event) => setQuickJobUrl(event.target.value)}
                  placeholder="https://company.com/careers/job..."
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full gap-2" disabled={intakingJobUrl || !quickJobUrl.trim()}>
                  {intakingJobUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {intakingJobUrl ? 'Saving...' : 'Save + open app'}
                </Button>
              </div>
            </div>
          </form>

          <form className="space-y-4" onSubmit={handleSearch}>
            <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1.3fr)_minmax(0,1fr)_180px]">
              <div className="space-y-2">
                <Label htmlFor="discover-source">Source</Label>
                <select
                  id="discover-source"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={searchForm.source}
                  onChange={(event) =>
                    setSearchForm((current) => ({
                      ...current,
                      source: event.target.value as JobSearchSource,
                      boardOrSite: event.target.value === 'usajobs' ? '' : current.boardOrSite,
                    }))
                  }
                >
                  {SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discover-query">Job title or keywords</Label>
                <Input
                  id="discover-query"
                  value={searchForm.query}
                  onChange={(event) =>
                    setSearchForm((current) => ({ ...current, query: event.target.value }))
                  }
                  placeholder="Data analyst, ML engineer, business intelligence..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discover-location">Location</Label>
                <Input
                  id="discover-location"
                  value={searchForm.location}
                  onChange={(event) =>
                    setSearchForm((current) => ({ ...current, location: event.target.value }))
                  }
                  placeholder="Chicago, Remote, Dallas..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discover-limit">Limit</Label>
                <Input
                  id="discover-limit"
                  type="number"
                  min={5}
                  max={50}
                  value={searchForm.limit}
                  onChange={(event) =>
                    setSearchForm((current) => ({
                      ...current,
                      limit: Math.min(50, Math.max(5, Number(event.target.value) || 25)),
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-2">
                <Label htmlFor="discover-board">Company / board filter</Label>
                <Input
                  id="discover-board"
                  value={searchForm.boardOrSite}
                  disabled={searchForm.source === 'usajobs'}
                  onChange={(event) =>
                    setSearchForm((current) => ({ ...current, boardOrSite: event.target.value }))
                  }
                  placeholder={
                    searchForm.source === 'usajobs'
                      ? 'Not used for USAJobs'
                      : 'Optional company site, domain, or board identifier'
                  }
                />
              </div>

              <div className="flex items-end justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Remote only</p>
                  <p className="text-xs text-muted-foreground">
                    Keep browsing tight when location is flexible.
                  </p>
                </div>
                <Switch
                  checked={searchForm.remoteOnly}
                  onCheckedChange={(checked) =>
                    setSearchForm((current) => ({ ...current, remoteOnly: checked }))
                  }
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Meaningful search criteria</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Keep the search aligned to early-career roles, portfolio fit, and skill terms that actually matter.
                  </p>
                </div>
                <Badge variant="outline">Persistent</Badge>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_220px]">
                <FieldLabel label="Career stage">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={searchCriteria.careerStage}
                    onChange={(event) =>
                      setSearchCriteria((current) => ({
                        ...current,
                        careerStage: event.target.value as CareerStage,
                      }))
                    }
                  >
                    <option value="student">Student / new grad</option>
                    <option value="early">Early career IC</option>
                    <option value="open">Open</option>
                  </select>
                </FieldLabel>

                <FieldLabel label="Required skills in description">
                  <Input
                    value={searchCriteria.requiredSkills}
                    onChange={(event) =>
                      setSearchCriteria((current) => ({
                        ...current,
                        requiredSkills: event.target.value,
                      }))
                    }
                    placeholder="sql, python, tableau, machine learning"
                  />
                </FieldLabel>

                <FieldLabel label="Exclude terms">
                  <Input
                    value={searchCriteria.excludeTerms}
                    onChange={(event) =>
                      setSearchCriteria((current) => ({
                        ...current,
                        excludeTerms: event.target.value,
                      }))
                    }
                    placeholder="senior, staff, principal, manager"
                  />
                </FieldLabel>

                <div className="flex items-end justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Only portfolio-aligned</p>
                    <p className="text-xs text-muted-foreground">
                      Hide low-fit noise after search.
                    </p>
                  </div>
                  <Switch
                    checked={searchCriteria.onlyPortfolioAligned}
                    onCheckedChange={(checked) =>
                      setSearchCriteria((current) => ({
                        ...current,
                        onlyPortfolioAligned: checked,
                      }))
                    }
                  />
                </div>
              </div>

              {portfolioSkillSuggestions.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Portfolio skill chips
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {portfolioSkillSuggestions.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() =>
                          setSearchCriteria((current) => ({
                            ...current,
                            requiredSkills: mergeDelimitedValue(current.requiredSkills, skill),
                          }))
                        }
                      >
                        + {skill}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="gap-2" disabled={isSearching}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {isSearching ? 'Searching...' : 'Search jobs'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={runningQueryPack || isSearching}
                onClick={() => void handleRunQueryPack()}
              >
                {runningQueryPack ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {runningQueryPack ? 'Running query pack...' : 'Run portfolio query pack'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!searchesSupported || Boolean(savingSearchId)}
                onClick={() => void handleSaveCurrentSearch()}
              >
                {savingSearchId ? 'Saving...' : 'Save search'}
              </Button>
            </div>
          </form>

          {pageError && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {pageError}
            </div>
          )}

          <div className="grid gap-3 xl:grid-cols-3">
            <SupportDisclosure
              title="Saved sources"
              subtitle="Reusable searches and sync controls"
              defaultOpen
            >
              {savedSearches !== null && savedSearches.length > 0 ? (
                <div className="space-y-2">
                  {savedSearches.map((savedSearch) => (
                    <div key={savedSearch.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">{savedSearch.name}</p>
                            {!savedSearch.is_enabled && <Badge variant="outline">Paused</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[humanizeSearchSource(savedSearch.source), savedSearch.query, savedSearch.location]
                              .filter(Boolean)
                              .join(' | ')}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {savedSearch.last_run_at
                              ? `Last run ${formatRelativeTime(savedSearch.last_run_at)}`
                              : 'Not run yet'}
                            {savedSearch.last_error ? ` | ${savedSearch.last_error}` : ''}
                          </p>
                        </div>
                        <Switch
                          checked={savedSearch.is_enabled}
                          disabled={savingSearchId === savedSearch.id}
                          onCheckedChange={(checked) => void handleToggleSavedSearch(savedSearch, checked)}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSearchForm(searchRequestFromSaved(savedSearch))
                            setPanelMode('search')
                          }}
                        >
                          Load
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={runningSearchId === savedSearch.id}
                          onClick={() => void handleRunSavedSearch(savedSearch)}
                        >
                          {runningSearchId === savedSearch.id ? 'Running...' : 'Run'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!syncHistorySupported || syncingId === savedSearch.id}
                          onClick={() => void handleSyncSavedSearch(savedSearch)}
                        >
                          {syncingId === savedSearch.id ? 'Syncing...' : 'Sync'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={savingSearchId === savedSearch.id}
                          onClick={() => void handleDeleteSavedSearch(savedSearch.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Save the current query once it is useful, then reuse it instead of rebuilding it each day.
                </p>
              )}
            </SupportDisclosure>

            <SupportDisclosure title="Watchlists" subtitle="Company tracking stays secondary">
              {watchlists !== null && watchlists.length > 0 ? (
                <div className="space-y-2">
                  {watchlists.slice(0, 5).map((watchlist) => (
                    <div key={watchlist.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">
                              {watchlist.company_name}
                            </p>
                            <Badge variant="outline">{watchlist.priority}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[
                              watchlist.preferred_query || 'No role focus',
                              watchlist.location_hint || 'No location hint',
                            ].join(' | ')}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {watchlist.last_sync_at
                              ? `Last sync ${formatRelativeTime(watchlist.last_sync_at)}`
                              : 'Never synced'}
                            {watchlist.last_error ? ` | ${watchlist.last_error}` : ''}
                          </p>
                        </div>
                        <Link to={`${getAdminPath('watchlists')}?watchlist=${encodeURIComponent(watchlist.id)}`}>
                          <Button size="sm" variant="ghost">
                            Open
                          </Button>
                        </Link>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={workingWatchlistId === `discover:${watchlist.id}`}
                          onClick={() => void handleDiscoverWatchlist(watchlist.id)}
                        >
                          {workingWatchlistId === `discover:${watchlist.id}` ? 'Discovering...' : 'Discover'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={workingWatchlistId === `sync:${watchlist.id}`}
                          onClick={() => void handleSyncWatchlist(watchlist.id)}
                        >
                          {workingWatchlistId === `sync:${watchlist.id}` ? 'Syncing...' : 'Sync'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Use watchlists for target companies, but keep the daily work here in the main search flow.
                </p>
              )}
            </SupportDisclosure>

            <SupportDisclosure title="Sync history" subtitle="Recent connector runs and manual capture">
              <div className="space-y-3">
                <div className="space-y-2">
                  {(syncRuns ?? []).slice(0, 5).map((run) => (
                    <div key={run.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{run.label || humanizeSearchSource(run.source)}</p>
                        <Badge
                          className={cn(
                            'border-white/10 bg-white/5 text-foreground',
                            run.status === 'success' && 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
                            run.status === 'error' && 'border-amber-400/20 bg-amber-400/10 text-amber-100'
                          )}
                        >
                          {run.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[run.query, run.location].filter(Boolean).join(' | ') || 'No query saved'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {run.result_count} results | {run.imported_count} imported | {formatRelativeTime(run.started_at)}
                      </p>
                    </div>
                  ))}
                  {(syncRuns ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Run a saved search sync once and the recent run history will show here.
                    </p>
                  )}
                </div>

                <details className="rounded-lg border border-white/10 bg-black/20">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground">
                    Manual capture
                  </summary>
                  <form className="space-y-3 border-t border-white/10 px-4 py-4" onSubmit={handleCreateManualJob}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <FieldLabel label="Role title">
                        <Input
                          value={manualJobForm.title}
                          onChange={(event) =>
                            setManualJobForm((current) => ({ ...current, title: event.target.value }))
                          }
                          required
                        />
                      </FieldLabel>
                      <FieldLabel label="Company">
                        <Input
                          value={manualJobForm.company}
                          onChange={(event) =>
                            setManualJobForm((current) => ({ ...current, company: event.target.value }))
                          }
                          required
                        />
                      </FieldLabel>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <FieldLabel label="Location">
                        <Input
                          value={manualJobForm.location}
                          onChange={(event) =>
                            setManualJobForm((current) => ({ ...current, location: event.target.value }))
                          }
                        />
                      </FieldLabel>
                      <FieldLabel label="Posting URL">
                        <Input
                          value={manualJobForm.job_url}
                          onChange={(event) =>
                            setManualJobForm((current) => ({ ...current, job_url: event.target.value }))
                          }
                        />
                      </FieldLabel>
                    </div>
                    <FieldLabel label="Description">
                      <Textarea
                        rows={4}
                        value={manualJobForm.description}
                        onChange={(event) =>
                          setManualJobForm((current) => ({ ...current, description: event.target.value }))
                        }
                      />
                    </FieldLabel>
                    <Button type="submit" disabled={creatingManualJob} className="gap-2">
                      <Plus className="h-4 w-4" />
                      {creatingManualJob ? 'Saving...' : 'Save role'}
                    </Button>
                  </form>
                </details>
              </div>
            </SupportDisclosure>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <Card className="glass overflow-hidden">
          <CardContent className="p-0">
            <div className="border-b border-white/10 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Results</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {panelMode === 'search'
                      ? `${filteredSearchResults.length} filtered result${filteredSearchResults.length === 1 ? '' : 's'}${
                          filteredSearchResults.length !== searchResults.length
                            ? ` of ${searchResults.length}`
                            : ''
                        }`
                      : `${filteredJobs.length} imported job${filteredJobs.length === 1 ? '' : 's'}`}
                  </p>
                </div>
                <div className="flex rounded-lg border border-white/10 bg-black/20 p-1">
                  <button
                    type="button"
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm transition-colors',
                      panelMode === 'search'
                        ? 'bg-white/10 text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => setPanelMode('search')}
                  >
                    Search
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm transition-colors',
                      panelMode === 'imported'
                        ? 'bg-white/10 text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => setPanelMode('imported')}
                  >
                    Imported
                  </button>
                </div>
              </div>

              {panelMode === 'imported' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {([
                    ['all', 'All'],
                    ['strong', 'Strong'],
                    ['review', 'Review'],
                    ['tracked', 'Tracked'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs transition-colors',
                        activeFilter === value
                          ? 'border-accent/30 bg-accent/10 text-foreground'
                          : 'border-white/10 bg-black/20 text-muted-foreground hover:text-foreground'
                      )}
                      onClick={() => setActiveFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="max-h-[72vh] overflow-y-auto p-3">
              {panelMode === 'search' ? (
                filteredSearchResults.length > 0 ? (
                  <div className="space-y-2">
                    {filteredSearchResults.map((result) => {
                      const externalKey = `${result.source}:${result.external_id}`
                      const fit = searchFitByKey.get(externalKey) ?? null
                      const imported = importedExternalKeys.has(externalKey)
                      const trackedApplication = applicationByExternalKey.get(externalKey)

                      return (
                        <DenseRoleRow
                          key={externalKey}
                          selected={selectedSearchKey === externalKey}
                          title={result.title}
                          subtitle={[result.company, result.location].filter(Boolean).join(' | ')}
                          badge={fit ? <FitBadge band={fit.band} score={fit.score} /> : null}
                          meta={[
                            trackedApplication ? 'In applications' : imported ? 'Imported' : null,
                            result.source_label,
                            result.salary_range || null,
                          ]}
                          description={truncateText(result.description, 160)}
                          onSelect={() => {
                            setPanelMode('search')
                            setSelectedSearchKey(externalKey)
                          }}
                          primaryAction={
                            trackedApplication ? (
                              <Link to={`${getAdminPath('applications')}?application=${encodeURIComponent(trackedApplication.id)}`}>
                                <Button size="sm">Open app</Button>
                              </Link>
                            ) : imported ? (
                              <Button
                                size="sm"
                                disabled={trackingJobId === externalKey}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  const importedJob = (jobs ?? []).find(
                                    (job) => `${job.source}:${job.external_id}` === externalKey
                                  )
                                  if (importedJob) void handleTrackImportedJob(importedJob)
                                }}
                              >
                                Add to apps
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                disabled={importingKey === externalKey}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void handleImportAndTailor(result)
                                }}
                              >
                                {importingKey === externalKey ? 'Importing...' : 'Import + tailor'}
                              </Button>
                            )
                          }
                        />
                      )
                    })}
                  </div>
              ) : (
                <EmptyPanelState
                  icon={<Search className="h-4 w-4" />}
                  title={searchResults.length > 0 ? 'No results match the current criteria' : 'No search results yet'}
                  body={
                    searchResults.length > 0
                      ? 'Relax the career-stage, skill, or portfolio-fit filters and the hidden results will reappear.'
                      : 'Run a search or the portfolio query pack. The selected role detail opens on the right.'
                  }
                />
              )
              ) : filteredJobs.length > 0 ? (
                <div className="space-y-2">
                  {filteredJobs.map((job) => {
                    const application = applicationsByJobId.get(job.id)
                    const fit = persistedMatchById.get(job.id)
                    const fallbackFit = fitById.get(job.id) ?? null

                    return (
                      <DenseRoleRow
                        key={job.id}
                        selected={selectedImportedJob?.id === job.id}
                        title={job.title || 'Untitled role'}
                        subtitle={[job.company, job.location].filter(Boolean).join(' | ')}
                        badge={
                          fit || fallbackFit ? (
                            <FitBadge
                              band={fit?.band ?? fallbackFit?.band ?? 'low'}
                              score={Math.round(fit?.total_score ?? fallbackFit?.score ?? 0)}
                            />
                          ) : null
                        }
                        meta={[
                          application ? 'In applications' : null,
                          humanizeSearchSource(job.source),
                          job.salary_range || null,
                        ]}
                        description={truncateText(job.description, 160)}
                        onSelect={() => {
                          setPanelMode('imported')
                          setSelectedSavedJobId(job.id)
                        }}
                        primaryAction={
                          application ? (
                            <Link to={`${getAdminPath('applications')}?application=${encodeURIComponent(application.id)}`}>
                              <Button size="sm">Open app</Button>
                            </Link>
                          ) : (
                            <Button
                              size="sm"
                              disabled={trackingJobId === job.id}
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleTrackImportedJob(job)
                              }}
                            >
                              {trackingJobId === job.id ? 'Adding...' : 'Add to apps'}
                            </Button>
                          )
                        }
                      />
                    )
                  })}
                </div>
              ) : (
                <EmptyPanelState
                  icon={<BriefcaseBusiness className="h-4 w-4" />}
                  title="No imported jobs yet"
                  body="Import worthwhile roles from search, then use this lane as your shortlist before moving them into Applications."
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-5">
            {panelMode === 'search' ? (
              selectedSearchResult ? (
                <SearchResultDetail
                  result={selectedSearchResult}
                  fit={selectedSearchFit}
                  imported={importedExternalKeys.has(`${selectedSearchResult.source}:${selectedSearchResult.external_id}`)}
                  trackedApplication={
                    applicationByExternalKey.get(`${selectedSearchResult.source}:${selectedSearchResult.external_id}`) ??
                    null
                  }
                  importing={importingKey === `${selectedSearchResult.source}:${selectedSearchResult.external_id}`}
                  onImport={() => void handleImportResult(selectedSearchResult)}
                  onImportAndTailor={() => void handleImportAndTailor(selectedSearchResult)}
                />
              ) : (
                <EmptyPanelState
                  icon={<Compass className="h-5 w-5" />}
                  title="Select a role"
                  body="Search results land here with the posting details, fit summary, and import actions."
                />
              )
            ) : selectedImportedJob ? (
              <ImportedJobDetail
                job={selectedImportedJob}
                application={applicationsByJobId.get(selectedImportedJob.id) ?? null}
                fit={selectedImportedFit}
                tracking={trackingJobId === selectedImportedJob.id}
                archiving={archivingJobId === selectedImportedJob.id}
                refreshing={refreshingJobId === selectedImportedJob.id}
                onTrack={() => void handleTrackImportedJob(selectedImportedJob)}
                onArchive={() => void handleArchiveJob(selectedImportedJob.id)}
                onRefresh={() => void handleRefreshMatch(selectedImportedJob.id)}
              />
            ) : (
              <EmptyPanelState
                icon={<BriefcaseBusiness className="h-5 w-5" />}
                title="Select an imported role"
                body="Imported jobs stay here until they are either archived or moved into Applications."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SearchResultDetail({
  result,
  fit,
  imported,
  trackedApplication,
  importing,
  onImport,
  onImportAndTailor,
}: {
  result: ExternalJobSearchResult
  fit: JobFitAssessment | null
  imported: boolean
  trackedApplication: ApplicationRecord | null
  importing: boolean
  onImport: () => void
  onImportAndTailor: () => void
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold text-foreground">{result.title}</h2>
            {fit && <FitBadge band={fit.band} score={fit.score} />}
            {trackedApplication && <Badge>In applications</Badge>}
            {!trackedApplication && imported && <Badge variant="outline">Imported</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[result.company, result.location, result.source_label].filter(Boolean).join(' | ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {trackedApplication ? (
            <Link to={`${getAdminPath('applications')}?application=${encodeURIComponent(trackedApplication.id)}`}>
              <Button className="gap-2">
                <BriefcaseBusiness className="h-4 w-4" />
                Open app
              </Button>
            </Link>
          ) : (
            <Button className="gap-2" disabled={importing} onClick={onImportAndTailor}>
              <Sparkles className="h-4 w-4" />
              {importing ? 'Importing...' : 'Import + tailor'}
            </Button>
          )}
          {!trackedApplication && (
            <Button variant="outline" disabled={importing} onClick={onImport}>
              {importing ? 'Importing...' : imported ? 'Re-import' : 'Import'}
            </Button>
          )}
          <a href={result.job_url} target="_blank" rel="noreferrer">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Open posting
            </Button>
          </a>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <DetailStat label="Source" value={result.source_label} />
        <DetailStat label="Employment" value={result.employment_type || 'Not listed'} />
        <DetailStat label="Salary" value={result.salary_range || 'Not listed'} />
      </div>

      {fit && (
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <p className="text-sm font-medium text-foreground">Fit snapshot</p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{fit.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {fit.matchedSkills.slice(0, 4).map((item) => (
              <Badge key={`skill-${item}`} variant="outline">
                {item}
              </Badge>
            ))}
            {fit.matchedProjects.slice(0, 3).map((item) => (
              <Badge key={`project-${item}`} variant="outline">
                {item}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <p className="text-sm font-medium text-foreground">Posting details</p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {result.description || 'No description returned from this search source.'}
        </p>
      </div>
    </div>
  )
}

function ImportedJobDetail({
  job,
  application,
  fit,
  tracking,
  archiving,
  refreshing,
  onTrack,
  onArchive,
  onRefresh,
}: {
  job: JobPosting
  application: ApplicationRecord | null
  fit: { score: number; band: 'strong' | 'review' | 'low'; summary: string } | null
  tracking: boolean
  archiving: boolean
  refreshing: boolean
  onTrack: () => void
  onArchive: () => void
  onRefresh: () => void
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold text-foreground">{job.title || 'Untitled role'}</h2>
            {fit && <FitBadge band={fit.band} score={fit.score} />}
            {application && <Badge>In applications</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[job.company, job.location, humanizeSearchSource(job.source)].filter(Boolean).join(' | ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {application ? (
            <Link to={`${getAdminPath('applications')}?application=${encodeURIComponent(application.id)}`}>
              <Button className="gap-2">
                <BriefcaseBusiness className="h-4 w-4" />
                Open app
              </Button>
            </Link>
          ) : (
            <Button className="gap-2" disabled={tracking} onClick={onTrack}>
              <BriefcaseBusiness className="h-4 w-4" />
              {tracking ? 'Adding...' : 'Add to applications'}
            </Button>
          )}
          <a href={job.job_url} target="_blank" rel="noreferrer">
            <Button variant="outline" className="gap-2">
              <ArrowUpRight className="h-4 w-4" />
              Open posting
            </Button>
          </a>
          <Button variant="outline" className="gap-2" disabled={refreshing} onClick={onRefresh}>
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh fit
          </Button>
          <Button variant="outline" className="gap-2" disabled={archiving} onClick={onArchive}>
            <Archive className="h-4 w-4" />
            {archiving ? 'Archiving...' : 'Archive'}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <DetailStat label="Source" value={humanizeSearchSource(job.source)} />
        <DetailStat label="Query label" value={job.query_label || 'Manual / n/a'} />
        <DetailStat label="Employment" value={job.employment_type || 'Not listed'} />
        <DetailStat label="Salary" value={job.salary_range || 'Not listed'} />
      </div>

      {fit && (
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <p className="text-sm font-medium text-foreground">Fit summary</p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{fit.summary}</p>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <p className="text-sm font-medium text-foreground">Description</p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {job.description || 'No description saved for this role yet.'}
        </p>
      </div>
    </div>
  )
}

function DenseRoleRow({
  selected,
  title,
  subtitle,
  badge,
  meta,
  description,
  onSelect,
  primaryAction,
}: {
  selected: boolean
  title: string
  subtitle: string
  badge?: React.ReactNode
  meta: Array<string | null>
  description: string
  onSelect: () => void
  primaryAction: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-xl border px-3 py-3 text-left transition-colors',
        selected
          ? 'border-accent/30 bg-accent/10'
          : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{title}</p>
            {badge}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle || 'No company or location saved yet.'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.filter(Boolean).map((item) => (
              <Badge key={`${title}-${item}`} variant="outline">
                {item}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <div
          className="shrink-0"
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          {primaryAction}
        </div>
      </div>
    </button>
  )
}

function SupportDisclosure({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details open={defaultOpen} className="rounded-xl border border-white/10 bg-black/20">
      <summary className="cursor-pointer list-none px-4 py-3">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </summary>
      <div className="border-t border-white/10 px-4 py-4">{children}</div>
    </details>
  )
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  )
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}

function EmptyPanelState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 bg-black/10 p-6 text-center">
      <div className="rounded-full border border-white/10 bg-black/20 p-3 text-muted-foreground">
        {icon}
      </div>
      <div>
        <p className="text-base font-medium text-foreground">{title}</p>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}

function FitBadge({
  band,
  score,
}: {
  band: 'strong' | 'review' | 'low'
  score: number
}) {
  return (
    <Badge
      className={cn(
        band === 'strong' && 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
        band === 'review' && 'border-amber-400/20 bg-amber-400/10 text-amber-100',
        band === 'low' && 'border-white/10 bg-white/5 text-muted-foreground'
      )}
    >
      {band === 'strong' ? 'Strong' : band === 'review' ? 'Review' : 'Low'} {Math.round(score)}
    </Badge>
  )
}

function externalResultToJob(result: ExternalJobSearchResult): JobPosting {
  const now = new Date().toISOString()
  return {
    id: `${result.source}:${result.external_id}`,
    source: result.source,
    external_id: result.external_id,
    watchlist_id: null,
    saved_job_search_id: null,
    query_label: '',
    title: result.title,
    company: result.company,
    location: result.location,
    remote_type: result.remote_type,
    employment_type: result.employment_type,
    salary_range: result.salary_range,
    job_url: result.job_url,
    description: result.description,
    fit_notes: '',
    discovery_status: 'manual',
    source_text: '',
    embedding_updated_at: null,
    archived_at: null,
    created_at: now,
    updated_at: now,
  }
}

function buildImportedJobPayload(
  result: ExternalJobSearchResult,
  attribution?: { savedJobSearchId?: string | null; queryLabel?: string }
): JobPostingFormData {
  return {
    source: result.source,
    external_id: result.external_id,
    watchlist_id: null,
    saved_job_search_id: attribution?.savedJobSearchId ?? null,
    query_label: attribution?.queryLabel?.trim() ?? '',
    title: result.title,
    company: result.company,
    location: result.location,
    remote_type: result.remote_type,
    employment_type: result.employment_type,
    salary_range: result.salary_range,
    job_url: result.job_url,
    description: result.description,
    fit_notes: `Imported from ${result.source_label}`,
    discovery_status: 'manual',
    source_text: '',
    embedding_updated_at: null,
  }
}

function findMatchingSavedSearch(
  searchForm: ExternalJobSearchRequest,
  savedSearches: SavedJobSearch[]
) {
  return savedSearches.find(
    (savedSearch) =>
      savedSearch.source === searchForm.source &&
      savedSearch.board_or_site.trim() ===
        (searchForm.source === 'usajobs' ? '' : searchForm.boardOrSite.trim()) &&
      savedSearch.query.trim() === searchForm.query.trim() &&
      savedSearch.location.trim() === searchForm.location.trim() &&
      savedSearch.remote_only === searchForm.remoteOnly
  )
}

function savedSearchInputFromForm(
  searchForm: ExternalJobSearchRequest,
  name: string
): SavedJobSearchInput {
  return {
    name: name.trim(),
    source: searchForm.source,
    board_or_site: searchForm.source === 'usajobs' ? '' : searchForm.boardOrSite.trim(),
    query: searchForm.query.trim(),
    location: searchForm.location.trim(),
    remote_only: searchForm.remoteOnly,
    result_limit: searchForm.limit,
  }
}

function searchRequestFromSaved(savedSearch: SavedJobSearch): ExternalJobSearchRequest {
  return {
    source: savedSearch.source,
    boardOrSite: savedSearch.board_or_site,
    query: savedSearch.query,
    location: savedSearch.location,
    remoteOnly: savedSearch.remote_only,
    limit: savedSearch.result_limit,
  }
}

function buildSearchName(searchForm: ExternalJobSearchRequest) {
  return [humanizeSearchSource(searchForm.source), searchForm.query, searchForm.location]
    .filter(Boolean)
    .join(' · ') || `${humanizeSearchSource(searchForm.source)} search`
}

function buildPortfolioQueryPack(
  searchForm: ExternalJobSearchRequest,
  skills: Skill[],
  projects: Project[],
  primaryVariant: ResumeVariant | null,
  candidateProfile: CandidateProfile | null
): ExternalJobSearchRequest[] {
  const queries = new Set<string>()
  const trimmedQuery = searchForm.query.trim()
  if (trimmedQuery) queries.add(trimmedQuery)

  const corpus = normalizeText(
    [
      candidateProfile?.now_line ?? '',
      candidateProfile?.bio ?? '',
      primaryVariant?.sourceJobTitle ?? '',
      ...skills.map((skill) => skill.name),
      ...projects.flatMap((project) => [project.title, project.description, ...(project.tags ?? [])]),
    ].join(' ')
  )

  if (/machine learning|llm|nlp|computer vision|ai/.test(corpus)) {
    queries.add('machine learning engineer')
    queries.add('data scientist')
  }
  if (/sql|dashboard|tableau|power bi|analytics|analysis/.test(corpus)) {
    queries.add('data analyst')
    queries.add('business intelligence analyst')
  }
  if (/python|analytics|statistics|forecast|experimentation/.test(corpus)) {
    queries.add('analytics engineer')
  }

  if (queries.size === 0) return []

  return Array.from(queries)
    .slice(0, 4)
    .map((query) => ({
      ...searchForm,
      query,
    }))
}

function humanizeSearchSource(source: JobSearchSource | JobPosting['source'] | JobSyncRun['source']) {
  return SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? source.replace(/_/g, ' ')
}

function normalizeText(value: string) {
  return value.toLowerCase()
}

function compareBand(band: 'strong' | 'review' | 'low') {
  if (band === 'strong') return 3
  if (band === 'review') return 2
  return 1
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

function formatRelativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime()
  const hours = Math.round(delta / (60 * 60 * 1000))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(value).toLocaleDateString()
}

function buildImprovedPortfolioQueryPack(
  searchForm: ExternalJobSearchRequest,
  searchCriteria: SearchCriteria,
  skills: Skill[],
  projects: Project[],
  primaryVariant: ResumeVariant | null,
  candidateProfile: CandidateProfile | null
): ExternalJobSearchRequest[] {
  const queries = new Set<string>()
  const stagePrefixes =
    searchCriteria.careerStage === 'student'
      ? ['new grad', 'entry level', 'intern']
      : searchCriteria.careerStage === 'early'
        ? ['entry level', 'junior', 'associate']
        : ['']

  for (const roleQuery of deriveRoleQueries(searchForm, skills, projects, primaryVariant, candidateProfile)) {
    if (searchCriteria.careerStage === 'open') {
      queries.add(roleQuery)
    } else {
      for (const prefix of stagePrefixes.slice(0, 2)) {
        queries.add(`${prefix} ${roleQuery}`.trim())
      }
    }
  }

  const requiredSkillTerms = parseDelimitedTerms(searchCriteria.requiredSkills).slice(0, 3)
  if (requiredSkillTerms.length > 0) {
    for (const roleQuery of Array.from(queries).slice(0, 3)) {
      queries.add(`${roleQuery} ${requiredSkillTerms.join(' ')}`.trim())
    }
  }

  if (queries.size === 0) return []

  return Array.from(queries)
    .map((query) => query.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((query) => ({
      ...searchForm,
      query,
    }))
}

function deriveRoleQueries(
  searchForm: ExternalJobSearchRequest,
  skills: Skill[],
  projects: Project[],
  primaryVariant: ResumeVariant | null,
  candidateProfile: CandidateProfile | null
) {
  const queries = new Set<string>()
  const trimmedQuery = searchForm.query.trim()
  if (trimmedQuery) queries.add(trimmedQuery)

  const corpus = normalizeText(
    [
      candidateProfile?.now_line ?? '',
      candidateProfile?.bio ?? '',
      primaryVariant?.sourceJobTitle ?? '',
      ...skills.map((skill) => skill.name),
      ...projects.flatMap((project) => [
        project.title,
        project.description,
        project.ask_me_about ?? '',
        ...(project.tags ?? []),
      ]),
    ].join(' ')
  )

  if (/machine learning|llm|nlp|computer vision|ai/.test(corpus)) {
    queries.add('machine learning engineer')
    queries.add('data scientist')
    queries.add('applied ai engineer')
  }
  if (/sql|dashboard|tableau|power bi|analytics|analysis|business intelligence/.test(corpus)) {
    queries.add('data analyst')
    queries.add('business intelligence analyst')
    queries.add('analytics engineer')
  }
  if (/statistics|forecast|experimentation|python/.test(corpus)) {
    queries.add('product analyst')
    queries.add('decision scientist')
  }

  return Array.from(queries)
}

function derivePortfolioSkillSuggestions(skills: Skill[], projects: Project[]) {
  const normalizedProjectTags = projects.flatMap((project) => project.tags ?? []).map(normalizeText)

  return skills
    .map((skill) => ({
      value: skill.name,
      score:
        1 +
        normalizedProjectTags.filter(
          (tag) => tag.includes(normalizeText(skill.name)) || normalizeText(skill.name).includes(tag)
        ).length,
    }))
    .sort((left, right) => right.score - left.score || left.value.localeCompare(right.value))
    .slice(0, 8)
    .map((entry) => entry.value)
}

function matchesSearchCriteria(
  result: ExternalJobSearchResult,
  searchCriteria: SearchCriteria,
  fit: JobFitAssessment | null
) {
  const titleText = normalizeText(result.title)
  const haystack = normalizeText(
    [result.title, result.company, result.location, result.description, result.employment_type].join(' ')
  )

  if (searchCriteria.careerStage !== 'open' && isSeniorRole(titleText, haystack)) {
    return false
  }

  if (searchCriteria.careerStage === 'student' && requiresMultipleYearsExperience(haystack)) {
    return false
  }

  if (searchCriteria.onlyPortfolioAligned && fit?.band === 'low') {
    return false
  }

  const requiredSkills = parseDelimitedTerms(searchCriteria.requiredSkills)
  if (requiredSkills.length > 0 && !requiredSkills.some((term) => haystack.includes(term))) {
    return false
  }

  const excludeTerms = parseDelimitedTerms(searchCriteria.excludeTerms)
  if (excludeTerms.some((term) => haystack.includes(term))) {
    return false
  }

  return true
}

function isSeniorRole(titleText: string, haystack: string) {
  return /\b(senior|sr\.?|staff|principal|lead|manager|director|head|vp|vice president|architect)\b/i.test(
    titleText
  ) || /\b(people manager|team lead|technical lead)\b/i.test(haystack)
}

function requiresMultipleYearsExperience(haystack: string) {
  return /\b([5-9]|[1-9][0-9])\+?\s+years?\b/i.test(haystack)
}

function parseDelimitedTerms(value: string) {
  return value
    .split(',')
    .map((item) => normalizeText(item.trim()))
    .filter(Boolean)
}

function mergeDelimitedValue(current: string, next: string) {
  const terms = new Set(parseDelimitedTerms(current))
  terms.add(normalizeText(next))
  return Array.from(terms).join(', ')
}

function readDiscoverSession(): Partial<DiscoverSession> | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(DISCOVER_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DiscoverSession>

    return {
      panelMode: parsed.panelMode === 'imported' ? 'imported' : 'search',
      searchForm: parsed.searchForm
        ? {
            ...EMPTY_SEARCH_FORM,
            ...parsed.searchForm,
          }
        : undefined,
      searchResults: Array.isArray(parsed.searchResults) ? parsed.searchResults : undefined,
      activeFilter: isJobFilter(parsed.activeFilter) ? parsed.activeFilter : undefined,
      selectedSavedJobId: typeof parsed.selectedSavedJobId === 'string' ? parsed.selectedSavedJobId : null,
      selectedSearchKey: typeof parsed.selectedSearchKey === 'string' ? parsed.selectedSearchKey : null,
      searchCriteria: parsed.searchCriteria
        ? {
            ...DEFAULT_SEARCH_CRITERIA,
            ...parsed.searchCriteria,
          }
        : undefined,
    }
  } catch (error) {
    console.error('Error reading discover session:', error)
    return null
  }
}

function writeDiscoverSession(session: DiscoverSession) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(DISCOVER_SESSION_KEY, JSON.stringify(session))
  } catch (error) {
    console.error('Error writing discover session:', error)
  }
}

function isJobFilter(value: unknown): value is JobFilter {
  return value === 'all' || value === 'strong' || value === 'review' || value === 'tracked'
}
