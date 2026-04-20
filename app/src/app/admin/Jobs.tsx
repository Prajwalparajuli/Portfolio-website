import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Archive,
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  Compass,
  ExternalLink,
  History,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { getAdminPath } from '@/lib/adminConfig'
import { searchExternalJobs } from '@/lib/jobSearch'
import { refreshHybridMatches } from '@/lib/careerCockpit'
import { scoreJobFit } from '@/lib/jobMatching'
import {
  createJobPosting,
  createJobSyncRun,
  createSavedJobSearch,
  deleteSavedJobSearch,
  getAllProjects,
  getApplications,
  getJobMatches,
  getJobSyncRuns,
  getJobPostings,
  getResumeWorkspace,
  getSavedJobSearches,
  getSkills,
  saveApplication,
  updateJobSyncRun,
  updateJobPosting,
  updateSavedJobSearch,
  upsertImportedJobPosting,
} from '@/lib/supabase'
import {
  ApplicationRecord,
  CandidateProfile,
  ExternalJobSearchRequest,
  ExternalJobSearchResult,
  JobMatch,
  JobPosting,
  JobPostingFormData,
  JobSearchSource,
  JobSyncRun,
  JobSyncRunMode,
  Project,
  SavedJobSearch,
  SavedJobSearchInput,
  Skill,
} from '@/types'
import { ResumeEducationSection, ResumeVariant } from '@/types/resume'

const EMPTY_JOB_FORM: JobPostingFormData = {
  source: 'manual',
  external_id: '',
  watchlist_id: null,
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

const EMPTY_SEARCH_FORM: ExternalJobSearchRequest = {
  source: 'usajobs',
  query: '',
  location: '',
  boardOrSite: '',
  remoteOnly: false,
  limit: 50,
}

type JobFilter = 'all' | 'strong' | 'review' | 'tracked'
type JobsMode = 'saved' | 'search'
const JOB_FORM_DRAFT_KEY = 'admin-jobs-manual-draft-v1'
const JOB_SEARCH_DRAFT_KEY = 'admin-jobs-search-draft-v1'

export function AdminJobs() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<JobPosting[] | null>([])
  const [applications, setApplications] = useState<ApplicationRecord[] | null>([])
  const [savedSearches, setSavedSearches] = useState<SavedJobSearch[] | null>([])
  const [syncRuns, setSyncRuns] = useState<JobSyncRun[] | null>([])
  const [jobMatches, setJobMatches] = useState<JobMatch[] | null>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null)
  const [resumeVariants, setResumeVariants] = useState<ResumeVariant[]>([])
  const [activeFilter, setActiveFilter] = useState<JobFilter>('all')
  const [panelMode, setPanelMode] = useState<JobsMode>('saved')
  const [formData, setFormData] = useState<JobPostingFormData>(() =>
    readDraft<JobPostingFormData>(JOB_FORM_DRAFT_KEY, EMPTY_JOB_FORM)
  )
  const [searchForm, setSearchForm] = useState<ExternalJobSearchRequest>(() =>
    readDraft<ExternalJobSearchRequest>(JOB_SEARCH_DRAFT_KEY, EMPTY_SEARCH_FORM)
  )
  const [searchResults, setSearchResults] = useState<ExternalJobSearchResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [trackingJobId, setTrackingJobId] = useState<string | null>(null)
  const [archivingJobId, setArchivingJobId] = useState<string | null>(null)
  const [importingExternalKey, setImportingExternalKey] = useState<string | null>(null)
  const [savingSearchId, setSavingSearchId] = useState<string | null>(null)
  const [runningSearchId, setRunningSearchId] = useState<string | null>(null)
  const [syncingSearchId, setSyncingSearchId] = useState<string | 'enabled' | null>(null)
  const [deletingSearchId, setDeletingSearchId] = useState<string | null>(null)
  const [refreshingMatches, setRefreshingMatches] = useState(false)
  const [runningPortfolioSearch, setRunningPortfolioSearch] = useState(false)

  useEffect(() => {
    let mounted = true

    Promise.all([
      getJobPostings(),
      getApplications(),
      getSavedJobSearches(),
      getJobSyncRuns(),
      getJobMatches(),
      getSkills(),
      getAllProjects(),
      getResumeWorkspace(),
    ]).then(([jobData, applicationData, savedSearchData, syncRunData, jobMatchData, skillsData, projectData, workspace]) => {
      if (!mounted) return
      setJobs(jobData)
      setApplications(applicationData)
      setSavedSearches(savedSearchData)
      setSyncRuns(syncRunData)
      setJobMatches(jobMatchData)
      setSkills(skillsData)
      setProjects(projectData)
      setCandidateProfile(workspace.candidateProfile)
      setResumeVariants(workspace.variants)
    })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    writeDraft(JOB_FORM_DRAFT_KEY, formData)
  }, [formData])

  useEffect(() => {
    writeDraft(JOB_SEARCH_DRAFT_KEY, searchForm)
  }, [searchForm])

  const schemaReady = jobs !== null && applications !== null
  const primaryVariant = useMemo(
    () => resumeVariants.find((variant) => variant.isPrimary) ?? resumeVariants[0] ?? null,
    [resumeVariants]
  )

  const fitById = useMemo(() => {
    if (!jobs) return new Map<string, ReturnType<typeof scoreJobFit>>()

    return new Map(
      jobs.map((job) => [
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
  }, [candidateProfile, jobs, skills, projects, primaryVariant])
  const persistedMatchById = useMemo(
    () => new Map((jobMatches ?? []).map((match) => [match.job_posting_id, match])),
    [jobMatches]
  )

  const trackedJobIds = useMemo(
    () => new Set((applications ?? []).map((application) => application.job_posting_id)),
    [applications]
  )

  const importedExternalKeys = useMemo(
    () => new Set((jobs ?? []).filter((job) => job.external_id).map((job) => `${job.source}:${job.external_id}`)),
    [jobs]
  )

  const filteredJobs = useMemo(() => {
    const source = jobs ?? []
    return source.filter((job) => {
      const persistedMatch = persistedMatchById.get(job.id)
      const fit = fitById.get(job.id)
      const band = persistedMatch?.band ?? fit?.band
      if (!band) return activeFilter === 'all'

      if (activeFilter === 'strong') return band === 'strong'
      if (activeFilter === 'review') return band === 'review'
      if (activeFilter === 'tracked') return trackedJobIds.has(job.id)
      return true
    })
  }, [jobs, persistedMatchById, fitById, activeFilter, trackedJobIds])

  const stats = useMemo(() => {
    const source = jobs ?? []
    const bands = source.map((job) => persistedMatchById.get(job.id)?.band ?? fitById.get(job.id)?.band)

    return [
      { label: 'Open jobs', value: source.length, tone: 'text-foreground' },
      {
        label: 'Strong fits',
        value: bands.filter((band) => band === 'strong').length,
        tone: 'text-emerald-300',
      },
      {
        label: 'Need review',
        value: bands.filter((band) => band === 'review').length,
        tone: 'text-amber-300',
      },
      { label: 'Tracked', value: trackedJobIds.size, tone: 'text-blue-300' },
    ]
  }, [jobs, persistedMatchById, fitById, trackedJobIds])

  const suggestedQueries = useMemo(
    () => buildSuggestedQueries(skills, projects, primaryVariant, candidateProfile),
    [candidateProfile, skills, projects, primaryVariant]
  )

  const searchResultFits = useMemo(
    () =>
      new Map(
        searchResults.map((result) => [
          `${result.source}:${result.external_id}`,
          scoreJobFit({
            job: {
              title: result.title,
              company: result.company,
              description: result.description,
              location: result.location,
              employment_type: result.employment_type,
            },
            skills,
            projects,
            resumeVariant: primaryVariant,
            candidateProfile,
          }),
        ])
      ),
    [candidateProfile, searchResults, skills, projects, primaryVariant]
  )

  const sortPortfolioSearchResults = useCallback(
    (results: ExternalJobSearchResult[]) =>
      sortSearchResultsForPortfolio(results, skills, projects, primaryVariant, candidateProfile),
    [candidateProfile, primaryVariant, projects, skills]
  )

  const searchesSupported = savedSearches !== null
  const syncHistorySupported = searchesSupported && syncRuns !== null
  const enabledSavedSearches = useMemo(
    () => (savedSearches ?? []).filter((savedSearch) => savedSearch.is_enabled),
    [savedSearches]
  )

  const runSearch = useCallback(async (request: ExternalJobSearchRequest) => {
    setIsSearching(true)
    setSearchError(null)

    try {
      const results = await searchExternalJobs(request)
      const sortedResults = sortPortfolioSearchResults(results)
      setSearchResults(sortedResults)
      return sortedResults
    } catch (error) {
      setSearchResults([])
      const message = error instanceof Error ? error.message : 'Search failed.'
      setSearchError(message)
      throw error
    } finally {
      setIsSearching(false)
    }
  }, [sortPortfolioSearchResults])

  const mergeImportedJobs = useCallback((importedJobs: JobPosting[]) => {
    if (importedJobs.length === 0) return

    setJobs((current) => {
      const existing = current ?? []
      const next = [...existing]

      for (const imported of importedJobs) {
        const withoutMatch = next.filter(
          (job) => !(job.source === imported.source && job.external_id === imported.external_id)
        )
        next.splice(0, next.length, imported, ...withoutMatch)
      }

      return next
    })
  }, [])

  const mergeSavedSearch = useCallback((savedSearch: SavedJobSearch) => {
    setSavedSearches((current) => {
      const next = (current ?? []).filter((entry) => entry.id !== savedSearch.id)
      return [savedSearch, ...next]
    })
  }, [])

  const mergeSyncRun = useCallback((syncRun: JobSyncRun) => {
    setSyncRuns((current) => {
      const next = (current ?? []).filter((entry) => entry.id !== syncRun.id)
      return [syncRun, ...next].slice(0, 12)
    })
  }, [])

  const importExternalResults = useCallback(async (results: ExternalJobSearchResult[]) => {
    const importedJobs: JobPosting[] = []

    for (const result of results) {
      const imported = await upsertImportedJobPosting(buildImportedJobPayload(result))
      if (imported) {
        importedJobs.push(imported)
      }
    }

    mergeImportedJobs(importedJobs)
    return importedJobs.length
  }, [mergeImportedJobs])

  const syncSavedSearch = useCallback(async (
    savedSearch: SavedJobSearch,
    options?: {
      runMode?: JobSyncRunMode
      applySearchForm?: boolean
      updateResults?: boolean
    }
  ) => {
    const request = searchRequestFromSaved(savedSearch)

    if (options?.applySearchForm ?? true) {
      setPanelMode('search')
      setSearchForm(request)
    }

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

      if (syncRun) {
        mergeSyncRun(syncRun)
      }
    }

    try {
      const results = await searchExternalJobs(request)
      const importedCount = await importExternalResults(results)
      const completedAt = new Date().toISOString()

      if (options?.updateResults ?? true) {
        setSearchResults(sortPortfolioSearchResults(results))
      }

      if (syncRun) {
        const completedRun = await updateJobSyncRun(syncRun.id, {
          status: 'success',
          result_count: results.length,
          imported_count: importedCount,
          error_message: '',
          completed_at: completedAt,
        })

        if (completedRun) {
          mergeSyncRun(completedRun)
        }
      }

      if (syncHistorySupported) {
        const updatedSearch = await updateSavedJobSearch(savedSearch.id, {
          last_run_at: completedAt,
          last_error: '',
        })

        if (updatedSearch) {
          mergeSavedSearch(updatedSearch)
        }
      }

      return { results, importedCount }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed.'
      const completedAt = new Date().toISOString()

      if (syncRun) {
        const failedRun = await updateJobSyncRun(syncRun.id, {
          status: 'error',
          error_message: message,
          completed_at: completedAt,
        })

        if (failedRun) {
          mergeSyncRun(failedRun)
        }
      }

      if (syncHistorySupported) {
        const updatedSearch = await updateSavedJobSearch(savedSearch.id, {
          last_run_at: completedAt,
          last_error: message,
        })

        if (updatedSearch) {
          mergeSavedSearch(updatedSearch)
        }
      }

      throw error
    }
  }, [importExternalResults, mergeSavedSearch, mergeSyncRun, sortPortfolioSearchResults, syncHistorySupported])

  const handleCreateJob = async (event: FormEvent) => {
    event.preventDefault()
    if (!schemaReady) return

    setIsCreating(true)
    try {
      const created = await createJobPosting({
        ...formData,
        title: formData.title.trim(),
        company: formData.company.trim(),
        location: formData.location.trim(),
        employment_type: formData.employment_type.trim(),
        salary_range: formData.salary_range.trim(),
        job_url: formData.job_url.trim(),
        description: formData.description.trim(),
        fit_notes: formData.fit_notes.trim(),
      })

      if (created) {
        setJobs((current) => [created, ...(current ?? [])])
        setFormData(EMPTY_JOB_FORM)
        clearDraft(JOB_FORM_DRAFT_KEY)
      }
    } catch (error) {
      console.error('Error creating job posting:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault()
    await runSearch(searchForm).catch(() => undefined)
  }

  const handleTrackJob = async (jobId: string) => {
    if (!schemaReady) return
    setTrackingJobId(jobId)

    try {
      const saved = await saveApplication({
        job_posting_id: jobId,
        resume_variant_id: primaryVariant?.id ?? null,
        status: 'saved',
        follow_up_at: null,
        applied_at: null,
        notes: '',
        cover_letter: '',
      })

      if (saved) {
        setApplications((current) => {
          const withoutExisting = (current ?? []).filter(
            (application) => application.job_posting_id !== saved.job_posting_id
          )
          return [saved, ...withoutExisting]
        })
      }
    } catch (error) {
      console.error('Error tracking job:', error)
    } finally {
      setTrackingJobId(null)
    }
  }

  const handleArchiveJob = async (jobId: string) => {
    if (!schemaReady) return
    setArchivingJobId(jobId)

    try {
      await updateJobPosting(jobId, {
        archived_at: new Date().toISOString(),
      })
      setJobs((current) => (current ?? []).filter((job) => job.id !== jobId))
    } catch (error) {
      console.error('Error archiving job:', error)
    } finally {
      setArchivingJobId(null)
    }
  }

  const persistImportedResult = async (result: ExternalJobSearchResult) => {
    setImportingExternalKey(`${result.source}:${result.external_id}`)
    try {
      const imported = await upsertImportedJobPosting(buildImportedJobPayload(result))
      if (imported) mergeImportedJobs([imported])
      return imported
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Import failed.')
    } finally {
      setImportingExternalKey(null)
    }

    return null
  }

  const handleImportResult = async (result: ExternalJobSearchResult) => {
    await persistImportedResult(result)
  }

  const handleImportAndTailorResult = async (result: ExternalJobSearchResult) => {
    const imported = await persistImportedResult(result)
    if (!imported) return
    navigate(`${getAdminPath('resume')}?job=${encodeURIComponent(imported.id)}&tab=tailor`)
  }

  const handleLoadSavedSearch = useCallback((savedSearch: SavedJobSearch) => {
    setPanelMode('search')
    setSearchError(null)
    setSearchForm(searchRequestFromSaved(savedSearch))
  }, [])

  const handleRunSavedSearch = useCallback(async (savedSearch: SavedJobSearch) => {
    setRunningSearchId(savedSearch.id)
    setPanelMode('search')
    const nextRequest = searchRequestFromSaved(savedSearch)
    setSearchForm(nextRequest)
    try {
      await runSearch(nextRequest)
    } catch {
      // runSearch already surfaces the user-facing error state
    } finally {
      setRunningSearchId(null)
    }
  }, [runSearch])

  const handleRunAllSavedSearches = useCallback(async () => {
    if (!savedSearches || savedSearches.length === 0) return

    setPanelMode('search')
    setRunningSearchId('all')
    setIsSearching(true)
    setSearchError(null)

    try {
      const merged = new Map<string, ExternalJobSearchResult>()
      const failures: string[] = []

      for (const savedSearch of savedSearches) {
        try {
          const results = await searchExternalJobs(searchRequestFromSaved(savedSearch))
          for (const result of results) {
            merged.set(`${result.source}:${result.external_id}`, result)
          }
        } catch (error) {
          failures.push(
            `${savedSearch.name}: ${error instanceof Error ? error.message : 'Search failed.'}`
          )
        }
      }

      setSearchResults(sortPortfolioSearchResults(Array.from(merged.values())))
      if (savedSearches[0]) {
        setSearchForm(searchRequestFromSaved(savedSearches[0]))
      }
      if (failures.length > 0) {
        setSearchError(failures.join(' '))
      }
    } finally {
      setIsSearching(false)
      setRunningSearchId(null)
    }
  }, [savedSearches, sortPortfolioSearchResults])

  const handleSyncSavedSearch = useCallback(async (savedSearch: SavedJobSearch) => {
    if (!syncHistorySupported) return

    setPanelMode('search')
    setSyncingSearchId(savedSearch.id)
    setSearchError(null)

    try {
      await syncSavedSearch(savedSearch, {
        runMode: 'single',
        applySearchForm: true,
        updateResults: true,
      })
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Sync failed.')
    } finally {
      setSyncingSearchId(null)
    }
  }, [syncHistorySupported, syncSavedSearch])

  const handleSyncEnabledSavedSearches = useCallback(async () => {
    if (!syncHistorySupported || enabledSavedSearches.length === 0) return

    setPanelMode('search')
    setSyncingSearchId('enabled')
    setSearchError(null)

    try {
      const merged = new Map<string, ExternalJobSearchResult>()
      const failures: string[] = []

      for (const savedSearch of enabledSavedSearches) {
        try {
          const { results } = await syncSavedSearch(savedSearch, {
            runMode: 'enabled_batch',
            applySearchForm: false,
            updateResults: false,
          })

          for (const result of results) {
            merged.set(`${result.source}:${result.external_id}`, result)
          }
        } catch (error) {
          failures.push(
            `${savedSearch.name}: ${error instanceof Error ? error.message : 'Search failed.'}`
          )
        }
      }

      setSearchResults(sortPortfolioSearchResults(Array.from(merged.values())))
      if (enabledSavedSearches[0]) {
        setSearchForm(searchRequestFromSaved(enabledSavedSearches[0]))
      }
      if (failures.length > 0) {
        setSearchError(failures.join(' '))
      }
    } finally {
      setSyncingSearchId(null)
    }
  }, [enabledSavedSearches, sortPortfolioSearchResults, syncHistorySupported, syncSavedSearch])

  const handleSaveCurrentSearch = useCallback(async () => {
    if (!searchesSupported) return

    const suggestedName = buildSearchName(searchForm)
    const nextName = window.prompt('Name this source/search', suggestedName)?.trim()
    if (!nextName) return

    const matchingSearch = (savedSearches ?? []).find((entry) => entry.name.toLowerCase() === nextName.toLowerCase())
    setSavingSearchId(matchingSearch?.id ?? 'new')

    try {
      const payload = savedSearchInputFromForm(searchForm, nextName)
      const saved = matchingSearch
        ? await updateSavedJobSearch(matchingSearch.id, payload)
        : await createSavedJobSearch(payload)

      if (saved) {
        mergeSavedSearch(saved)
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Could not save this search.')
    } finally {
      setSavingSearchId(null)
    }
  }, [mergeSavedSearch, savedSearches, searchForm, searchesSupported])

  const handleDeleteSavedSearch = useCallback(async (id: string) => {
    if (!searchesSupported) return
    setDeletingSearchId(id)

    try {
      await deleteSavedJobSearch(id)
      setSavedSearches((current) => (current ?? []).filter((entry) => entry.id !== id))
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Could not delete this saved search.')
    } finally {
      setDeletingSearchId(null)
    }
  }, [searchesSupported])

  const handleToggleSavedSearch = useCallback(async (savedSearch: SavedJobSearch, checked: boolean) => {
    if (!syncHistorySupported) return

    setSavingSearchId(savedSearch.id)
    try {
      const updated = await updateSavedJobSearch(savedSearch.id, {
        is_enabled: checked,
      })

      if (updated) {
        mergeSavedSearch(updated)
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Could not update this source.')
    } finally {
      setSavingSearchId(null)
    }
  }, [mergeSavedSearch, syncHistorySupported])

  const handleRefreshMatches = useCallback(async (jobId?: string) => {
    setRefreshingMatches(true)
    try {
      await refreshHybridMatches(jobId ? [jobId] : undefined)
      const [nextMatches, nextJobs] = await Promise.all([
        getJobMatches(),
        getJobPostings(),
      ])
      setJobMatches(nextMatches)
      setJobs(nextJobs)
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Could not refresh semantic matches.')
    } finally {
      setRefreshingMatches(false)
    }
  }, [])

  const handleRunPortfolioSearch = useCallback(async () => {
    if (searchForm.source !== 'usajobs') return

    const requests = buildPortfolioSearchRequests(
      searchForm,
      suggestedQueries,
      skills,
      projects,
      primaryVariant,
      candidateProfile
    )
    if (requests.length === 0) {
      setSearchError('Add a query, skills, or projects first so the USAJobs search pack has something to work from.')
      return
    }

    setPanelMode('search')
    setRunningPortfolioSearch(true)
    setIsSearching(true)
    setSearchError(null)

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
          failures.push(`${request.query}: ${error instanceof Error ? error.message : 'Search failed.'}`)
        }
      }

      setSearchForm(requests[0])
      setSearchResults(sortPortfolioSearchResults(Array.from(merged.values())))

      if (merged.size === 0) {
        setSearchError(
          failures.length > 0
            ? failures.join(' ')
            : 'No USAJobs results came back for the portfolio-driven query pack.'
        )
      } else if (failures.length > 0) {
        setSearchError(failures.join(' '))
      }
    } finally {
      setIsSearching(false)
      setRunningPortfolioSearch(false)
    }
  }, [candidateProfile, primaryVariant, projects, searchForm, skills, sortPortfolioSearchResults, suggestedQueries])

  if (!schemaReady) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Jobs</h1>
          <p className="text-muted-foreground mt-1">
            Run migration 004 to unlock the jobs and applications workspace.
          </p>
        </div>
        <Card className="glass">
          <CardContent className="p-6 space-y-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Schema not detected</p>
            <p>
              Apply <code className="rounded bg-black/30 px-1 py-0.5">004_jobs_applications_foundation.sql</code>
              {' '}in Supabase, then reload this page.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Jobs</h1>
          <p className="text-muted-foreground mt-1">
            Search real boards, import the roles worth keeping, and move the best ones into Applications.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={refreshingMatches}
            onClick={() => handleRefreshMatches()}
          >
            <Sparkles className="h-4 w-4" />
            {refreshingMatches ? 'Refreshing matches...' : 'Refresh semantic matches'}
          </Button>
          <Link to={getAdminPath('applications')}>
            <Button variant="outline" className="gap-2">
              Applications
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="glass">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</p>
              <p className={`mt-2 text-2xl font-semibold ${stat.tone}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={panelMode} onValueChange={(value) => setPanelMode(value as JobsMode)} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="bg-black/30">
            <TabsTrigger value="saved">Saved jobs</TabsTrigger>
            <TabsTrigger value="search">Search import</TabsTrigger>
          </TabsList>
          <p className="text-xs text-muted-foreground">
            Connector search is admin-only and uses the server-side function, not the browser.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="glass xl:sticky xl:top-6 h-fit">
            <CardContent className="p-5">
              <TabsContent value="saved" className="mt-0">
                <form className="space-y-4" onSubmit={handleCreateJob}>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Manual capture</p>
                    <p className="text-xs text-muted-foreground">
                      Useful for referrals, stealth roles, or any posting you already found elsewhere.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="job-title">Role</Label>
                    <Input
                      id="job-title"
                      value={formData.title}
                      onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Machine Learning Engineer"
                      className="bg-black/40 border-white/10"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="job-company">Company</Label>
                      <Input
                        id="job-company"
                        value={formData.company}
                        onChange={(event) => setFormData((current) => ({ ...current, company: event.target.value }))}
                        placeholder="Anthropic"
                        className="bg-black/40 border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="job-location">Location</Label>
                      <Input
                        id="job-location"
                        value={formData.location}
                        onChange={(event) => setFormData((current) => ({ ...current, location: event.target.value }))}
                        placeholder="Remote or NYC"
                        className="bg-black/40 border-white/10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="job-remote">Work mode</Label>
                      <select
                        id="job-remote"
                        value={formData.remote_type}
                        onChange={(event) =>
                          setFormData((current) => ({
                            ...current,
                            remote_type: event.target.value as JobPostingFormData['remote_type'],
                          }))
                        }
                        className="flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                      >
                        <option value="unknown">Unknown</option>
                        <option value="remote">Remote</option>
                        <option value="hybrid">Hybrid</option>
                        <option value="onsite">Onsite</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="job-employment">Employment</Label>
                      <Input
                        id="job-employment"
                        value={formData.employment_type}
                        onChange={(event) =>
                          setFormData((current) => ({ ...current, employment_type: event.target.value }))
                        }
                        placeholder="Full-time"
                        className="bg-black/40 border-white/10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="job-url">Posting URL</Label>
                    <Input
                      id="job-url"
                      value={formData.job_url}
                      onChange={(event) => setFormData((current) => ({ ...current, job_url: event.target.value }))}
                      placeholder="https://company.com/jobs/..."
                      className="bg-black/40 border-white/10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="job-description">Job description</Label>
                    <Textarea
                      id="job-description"
                      value={formData.description}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, description: event.target.value }))
                      }
                      placeholder="Paste the job description here for quick fit scoring..."
                      className="min-h-[180px] bg-black/40 border-white/10"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="job-notes">Private notes</Label>
                    <Textarea
                      id="job-notes"
                      value={formData.fit_notes}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, fit_notes: event.target.value }))
                      }
                      placeholder="Why this role matters, referral context, salary note..."
                      className="min-h-[88px] bg-black/40 border-white/10"
                    />
                  </div>

                  <Button type="submit" className="w-full gap-2" disabled={isCreating}>
                    <Plus className="h-4 w-4" />
                    {isCreating ? 'Saving...' : 'Save job'}
                  </Button>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-muted-foreground">
                    Fit scoring uses your current skills, projects, and primary resume variant.
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="search" className="mt-0">
                <form className="space-y-4" onSubmit={handleSearch}>
                  <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Saved sources</p>
                        <p className="text-xs text-muted-foreground">
                          Save a board/site once, then rerun it instead of pasting URLs every time.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {searchesSupported && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={savingSearchId !== null}
                            onClick={handleSaveCurrentSearch}
                          >
                            <Bookmark className="h-3.5 w-3.5" />
                            {savingSearchId ? 'Saving…' : 'Save current'}
                          </Button>
                        )}
                        {searchesSupported && (savedSearches?.length ?? 0) > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={runningSearchId === 'all' || isSearching}
                            onClick={handleRunAllSavedSearches}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            {runningSearchId === 'all' ? 'Running…' : 'Run all'}
                          </Button>
                        )}
                      </div>
                    </div>

                    {syncHistorySupported && enabledSavedSearches.length > 0 && (
                      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Recurring sync queue</p>
                          <p className="text-xs text-muted-foreground">
                            {enabledSavedSearches.length} source{enabledSavedSearches.length === 1 ? '' : 's'} enabled for repeat syncs and history.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={syncingSearchId === 'enabled'}
                          onClick={handleSyncEnabledSavedSearches}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          {syncingSearchId === 'enabled' ? 'Syncing...' : 'Sync enabled'}
                        </Button>
                      </div>
                    )}

                    {!searchesSupported && (
                      <p className="text-xs text-yellow-300/80">
                        Saved searches unlock after <code className="text-yellow-200">005_saved_job_searches.sql</code> is applied.
                      </p>
                    )}

                    {searchesSupported && !syncHistorySupported && (
                      <p className="text-xs text-yellow-300/80">
                        Run <code className="text-yellow-200">006_job_sync_runs.sql</code> to enable recurring source toggles and sync history.
                      </p>
                    )}

                    {searchesSupported && (savedSearches?.length ?? 0) > 0 && (
                      <div className="space-y-2">
                        {(savedSearches ?? []).map((savedSearch) => (
                          <div
                            key={savedSearch.id}
                            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{savedSearch.name}</p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  {savedSearch.source}
                                  {savedSearch.board_or_site ? ` • ${savedSearch.board_or_site}` : ''}
                                  {savedSearch.query ? ` • ${savedSearch.query}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleLoadSavedSearch(savedSearch)}
                                >
                                  <Bookmark className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={runningSearchId === savedSearch.id}
                                  onClick={() => handleRunSavedSearch(savedSearch)}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  disabled={deletingSearchId === savedSearch.id}
                                  onClick={() => handleDeleteSavedSearch(savedSearch.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                <Badge variant="outline" className="border-white/10">
                                  {savedSearch.is_enabled ? 'Enabled' : 'Paused'}
                                </Badge>
                                {savedSearch.last_run_at ? (
                                  <span>Last sync {formatRelativeSyncTime(savedSearch.last_run_at)}</span>
                                ) : (
                                  <span>Never synced</span>
                                )}
                                {savedSearch.last_error && (
                                  <span className="text-amber-200">
                                    Last error: {truncateText(savedSearch.last_error, 80)}
                                  </span>
                                )}
                              </div>

                              {syncHistorySupported && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="flex items-center gap-2">
                                    <Label
                                      htmlFor={`saved-search-enabled-${savedSearch.id}`}
                                      className="text-[11px] font-medium text-muted-foreground"
                                    >
                                      Auto-sync
                                    </Label>
                                    <Switch
                                      id={`saved-search-enabled-${savedSearch.id}`}
                                      checked={savedSearch.is_enabled}
                                      disabled={savingSearchId === savedSearch.id}
                                      onCheckedChange={(checked) => handleToggleSavedSearch(savedSearch, checked)}
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="gap-2"
                                    disabled={syncingSearchId === savedSearch.id}
                                    onClick={() => handleSyncSavedSearch(savedSearch)}
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                    {syncingSearchId === savedSearch.id ? 'Syncing...' : 'Sync'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {syncHistorySupported && (
                      <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="flex items-center gap-2">
                          <History className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-semibold text-foreground">Recent syncs</p>
                        </div>

                        {(syncRuns ?? []).length > 0 ? (
                          <div className="space-y-2">
                            {(syncRuns ?? []).slice(0, 6).map((syncRun) => (
                              <div
                                key={syncRun.id}
                                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-foreground">
                                      {syncRun.label || humanizeSearchSource(syncRun.source)}
                                    </p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                      {formatSyncRunMeta(syncRun)}
                                    </p>
                                  </div>
                                  <Badge className={syncRunBadgeClassName(syncRun.status)}>
                                    {syncRun.status}
                                  </Badge>
                                </div>

                                {syncRun.error_message && (
                                  <p className="mt-2 text-[11px] text-amber-200">
                                    {truncateText(syncRun.error_message, 120)}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No sync history yet. Run Sync on a saved source to start building a trail.
                          </p>
                        )}
                      </div>
                    )}

                    {searchesSupported && (savedSearches?.length ?? 0) === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No saved sources yet. Set up one board/site below, then save it once.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Connector search</p>
                    <p className="text-xs text-muted-foreground">
                      Search Greenhouse or Lever board feeds now. USAJobs is the easiest broad search path because it does not need a board token.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="search-source">Source</Label>
                    <select
                      id="search-source"
                      value={searchForm.source}
                      onChange={(event) => {
                        const nextSource = event.target.value as JobSearchSource
                        setSearchForm((current) => ({
                          ...current,
                          source: nextSource,
                          boardOrSite: nextSource === 'usajobs' ? '' : current.boardOrSite,
                          limit: nextSource === 'usajobs'
                            ? Math.max(20, Math.min(current.limit, 200))
                            : Math.min(current.limit, 50),
                        }))
                      }}
                      className="flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                    >
                      <option value="greenhouse">Greenhouse board</option>
                      <option value="lever">Lever site</option>
                      <option value="usajobs">USAJobs</option>
                    </select>
                  </div>

                  {searchForm.source !== 'usajobs' && (
                    <div className="space-y-2">
                      <Label htmlFor="search-board-site">{boardOrSiteLabel(searchForm.source)}</Label>
                      <Input
                        id="search-board-site"
                        value={searchForm.boardOrSite}
                        onChange={(event) =>
                          setSearchForm((current) => ({ ...current, boardOrSite: event.target.value }))
                        }
                        placeholder={boardOrSitePlaceholder(searchForm.source)}
                        className="bg-black/40 border-white/10"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        {boardOrSiteHelp(searchForm.source)}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="search-query">Keyword query</Label>
                    <Input
                      id="search-query"
                      value={searchForm.query}
                      onChange={(event) =>
                        setSearchForm((current) => ({ ...current, query: event.target.value }))
                      }
                      placeholder="machine learning engineer python"
                      className="bg-black/40 border-white/10"
                    />
                    {suggestedQueries.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {suggestedQueries.map((query) => (
                          <button
                            key={query}
                            type="button"
                            onClick={() =>
                              setSearchForm((current) => ({
                                ...current,
                                query,
                              }))
                            }
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                          >
                            {query}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {searchForm.source === 'usajobs' && (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Portfolio-driven USAJobs search</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Runs a broader search pack generated from role titles, skills, and keyword combinations from your portfolio, then re-ranks the combined results.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={isSearching || runningPortfolioSearch}
                          onClick={() => void handleRunPortfolioSearch()}
                        >
                          <Compass className="h-4 w-4" />
                          {runningPortfolioSearch ? 'Searching...' : 'Run query pack'}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="search-location">Location</Label>
                      <Input
                        id="search-location"
                        value={searchForm.location}
                        onChange={(event) =>
                          setSearchForm((current) => ({ ...current, location: event.target.value }))
                        }
                        placeholder="Remote, New York, Austin..."
                        className="bg-black/40 border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="search-limit">Results</Label>
                      <select
                        id="search-limit"
                        value={searchForm.limit}
                        onChange={(event) =>
                          setSearchForm((current) => ({
                            ...current,
                            limit: Number(event.target.value),
                          }))
                        }
                        className="flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                      >
                        {getSearchLimitOptions(searchForm.source).map((limit) => (
                          <option key={limit} value={limit}>{limit}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={searchForm.remoteOnly}
                      onChange={(event) =>
                        setSearchForm((current) => ({ ...current, remoteOnly: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-white/20 bg-black/40"
                    />
                    Remote-first filter
                  </label>

                  <Button type="submit" className="w-full gap-2" disabled={isSearching}>
                    <Compass className="h-4 w-4" />
                    {isSearching ? 'Searching...' : 'Search jobs'}
                  </Button>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-muted-foreground">
                    Suggested queries come from your skills, projects, and primary resume. Saved sources turn this into repeatable curation instead of one-off searches.
                  </div>
                </form>
              </TabsContent>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <TabsContent value="saved" className="mt-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Tabs value={activeFilter} onValueChange={(value) => setActiveFilter(value as JobFilter)}>
                  <TabsList className="bg-black/30">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="strong">Strong fits</TabsTrigger>
                    <TabsTrigger value="review">Review</TabsTrigger>
                    <TabsTrigger value="tracked">Tracked</TabsTrigger>
                  </TabsList>
                </Tabs>

                <p className="text-xs text-muted-foreground">
                  Saved roles are your private shortlist. Push the keepers into Applications.
                </p>
              </div>

              <div className="space-y-3">
                {filteredJobs.map((job) => {
                  const heuristicFit = fitById.get(job.id)
                  const persistedMatch = persistedMatchById.get(job.id)
                  const displayBand = persistedMatch?.band ?? heuristicFit?.band
                  const displayScore = persistedMatch ? Math.round(persistedMatch.total_score) : heuristicFit?.score
                  const matchSummary = persistedMatch?.reason_summary ?? heuristicFit?.summary
                  const matchedSkills = persistedMatch?.matched_skill_names ?? heuristicFit?.matchedSkills ?? []
                  const matchedProjects = persistedMatch?.matched_project_titles ?? heuristicFit?.matchedProjects ?? []
                  const matchedKeywords = persistedMatch?.matched_keywords ?? heuristicFit?.matchedKeywords ?? []
                  const tracked = trackedJobIds.has(job.id)

                  return (
                    <Card key={job.id} className="glass">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold leading-tight text-foreground">
                                {job.title || 'Untitled role'}
                              </h3>
                              {displayBand && typeof displayScore === 'number' && (
                                <Badge className={fitBadgeClassName(displayBand)}>
                                  Fit {displayScore}
                                </Badge>
                              )}
                              {tracked && (
                                <Badge variant="outline" className="border-blue-400/30 text-blue-200">
                                  In applications
                                </Badge>
                              )}
                              {persistedMatch && (
                                <Badge variant="outline" className="border-amber-400/20 text-amber-100">
                                  Hybrid
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {[job.company, job.location].filter(Boolean).join(' • ') || 'Manual capture'}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {job.remote_type !== 'unknown' && (
                              <Badge variant="outline" className="border-white/10">
                                {job.remote_type}
                              </Badge>
                            )}
                            {job.employment_type && (
                              <Badge variant="outline" className="border-white/10">
                                {job.employment_type}
                              </Badge>
                            )}
                            <Badge variant="outline" className="border-white/10">
                              {job.source}
                            </Badge>
                            {job.discovery_status !== 'manual' && (
                              <Badge variant="outline" className="border-white/10">
                                {humanizeDiscoveryStatus(job.discovery_status)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {matchSummary && (
                          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                              <Sparkles className="h-4 w-4 text-amber-300" />
                              {persistedMatch ? 'Hybrid match read' : 'Heuristic match read'}
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{matchSummary}</p>
                            {persistedMatch && (
                              <div className="mt-3 grid gap-2 md:grid-cols-3">
                                <ScoreChip label="Semantic" value={persistedMatch.semantic_score} />
                                <ScoreChip label="Keyword" value={persistedMatch.keyword_score} />
                                <ScoreChip label="Preference" value={persistedMatch.preference_score} />
                              </div>
                            )}
                            {persistedMatch?.best_evidence_label && (
                              <p className="mt-3 text-xs text-amber-100">
                                Lead with: {persistedMatch.best_evidence_label}
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {matchedSkills.slice(0, 4).map((skill) => (
                                <Badge
                                  key={`${job.id}-${skill}`}
                                  variant="outline"
                                  className="border-emerald-400/20 text-emerald-200"
                                >
                                  {skill}
                                </Badge>
                              ))}
                              {matchedProjects.slice(0, 2).map((projectTitle) => (
                                <Badge
                                  key={`${job.id}-${projectTitle}`}
                                  variant="outline"
                                  className="border-blue-400/20 text-blue-200"
                                >
                                  {projectTitle}
                                </Badge>
                              ))}
                              {matchedKeywords.slice(0, 3).map((keyword) => (
                                <Badge
                                  key={`${job.id}-${keyword}`}
                                  variant="outline"
                                  className="border-white/10 text-muted-foreground"
                                >
                                  {keyword}
                                </Badge>
                              ))}
                            </div>
                            {persistedMatch && persistedMatch.missing_signals.length > 0 && (
                              <div className="mt-4 space-y-2">
                                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                  Missing signals
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {persistedMatch.missing_signals.slice(0, 5).map((signal) => (
                                    <Badge
                                      key={`${job.id}-${signal}`}
                                      variant="outline"
                                      className="border-rose-400/20 text-rose-200"
                                    >
                                      {signal}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          {job.job_url && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => window.open(job.job_url, '_blank', 'noopener,noreferrer')}
                            >
                              <ExternalLink className="h-4 w-4" />
                              Open posting
                            </Button>
                          )}
                          <Link to={`${getAdminPath('resume')}?job=${encodeURIComponent(job.id)}&tab=tailor`}>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2"
                            >
                              <Sparkles className="h-4 w-4" />
                              Tailor for this job
                            </Button>
                          </Link>
                          <Button
                            type="button"
                            size="sm"
                            className="gap-2"
                            disabled={trackingJobId === job.id}
                            onClick={() => handleTrackJob(job.id)}
                          >
                            <BriefcaseBusiness className="h-4 w-4" />
                            {tracked ? 'Refresh application' : 'Add to Applications'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="gap-2 text-muted-foreground"
                            disabled={refreshingMatches}
                            onClick={() => handleRefreshMatches(job.id)}
                          >
                            <RefreshCw className="h-4 w-4" />
                            Refresh match
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="gap-2 text-muted-foreground"
                            disabled={archivingJobId === job.id}
                            onClick={() => handleArchiveJob(job.id)}
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}

                {filteredJobs.length === 0 && (
                  <Card className="glass">
                    <CardContent className="p-8 text-center text-sm text-muted-foreground">
                      No saved jobs yet. Capture one manually or switch to Search import.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="search" className="mt-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">Search results</p>
                <p className="text-xs text-muted-foreground">
                  Imported results are upserted into your saved jobs list using source + external id.
                </p>
              </div>

              {searchError && (
                <Card className="glass border border-destructive/30">
                  <CardContent className="p-4 text-sm text-destructive">
                    {searchError}
                  </CardContent>
                </Card>
              )}

              <div className="space-y-3">
                {searchResults.map((result) => {
                  const fit = searchResultFits.get(`${result.source}:${result.external_id}`)
                  const alreadyImported = importedExternalKeys.has(`${result.source}:${result.external_id}`)

                  return (
                    <Card key={`${result.source}:${result.external_id}`} className="glass">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold leading-tight text-foreground">
                                {result.title}
                              </h3>
                              {fit && (
                                <Badge className={fitBadgeClassName(fit.band)}>
                                  Fit {fit.score}
                                </Badge>
                              )}
                              {alreadyImported && (
                                <Badge variant="outline" className="border-blue-400/30 text-blue-200">
                                  Imported
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {[result.company, result.location].filter(Boolean).join(' • ') || result.source_label}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {result.remote_type !== 'unknown' && (
                              <Badge variant="outline" className="border-white/10">
                                {result.remote_type}
                              </Badge>
                            )}
                            {result.employment_type && (
                              <Badge variant="outline" className="border-white/10">
                                {result.employment_type}
                              </Badge>
                            )}
                            <Badge variant="outline" className="border-white/10">
                              {result.source_label}
                            </Badge>
                          </div>
                        </div>

                        {fit && (
                          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                              <Sparkles className="h-4 w-4 text-amber-300" />
                              Match read
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{fit.summary}</p>
                          </div>
                        )}

                        <p className="text-sm text-muted-foreground line-clamp-4">
                          {result.description || 'No description available from this source.'}
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                          {result.job_url && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => window.open(result.job_url, '_blank', 'noopener,noreferrer')}
                            >
                              <ExternalLink className="h-4 w-4" />
                              Open posting
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={importingExternalKey === `${result.source}:${result.external_id}`}
                            onClick={() => handleImportAndTailorResult(result)}
                          >
                            <Sparkles className="h-4 w-4" />
                            Import + tailor
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="gap-2"
                            disabled={importingExternalKey === `${result.source}:${result.external_id}`}
                            onClick={() => handleImportResult(result)}
                          >
                            <Plus className="h-4 w-4" />
                            {alreadyImported ? 'Refresh import' : 'Import to saved jobs'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}

                {!isSearching && searchResults.length === 0 && !searchError && (
                  <Card className="glass">
                    <CardContent className="p-8 text-center text-sm text-muted-foreground">
                      No search results yet. Pick a source on the left and run a search.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  )
}

function fitBadgeClassName(band: ReturnType<typeof scoreJobFit>['band']): string {
  if (band === 'strong') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
  if (band === 'review') return 'border-amber-400/20 bg-amber-400/10 text-amber-100'
  return 'border-white/10 bg-white/5 text-muted-foreground'
}

function boardOrSiteLabel(source: JobSearchSource): string {
  if (source === 'greenhouse') return 'Board token or Greenhouse URL'
  if (source === 'lever') return 'Site name or Lever URL'
  return 'Source'
}

function boardOrSitePlaceholder(source: JobSearchSource): string {
  if (source === 'greenhouse') return 'openai or https://boards.greenhouse.io/openai'
  if (source === 'lever') return 'netflix or https://jobs.lever.co/netflix'
  return ''
}

function boardOrSiteHelp(source: JobSearchSource): string {
  if (source === 'greenhouse') {
    return 'Paste the board token or a Greenhouse board URL once, then save it as a reusable source.'
  }
  if (source === 'lever') {
    return 'Paste the site name or a Lever jobs URL once, then save it as a reusable source.'
  }
  return ''
}

function buildImportedJobPayload(result: ExternalJobSearchResult): JobPostingFormData {
  return {
    source: result.source,
    external_id: result.external_id,
    watchlist_id: null,
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

function buildSearchName(searchForm: ExternalJobSearchRequest): string {
  const parts = [
    humanizeSearchSource(searchForm.source),
    searchForm.boardOrSite.trim(),
    searchForm.query.trim(),
    searchForm.location.trim(),
  ].filter(Boolean)

  return parts.join(' · ') || `${humanizeSearchSource(searchForm.source)} search`
}

const CORE_SEARCH_TITLE_PHRASES = [
  'ai engineer',
  'machine learning engineer',
  'applied ai',
  'applied scientist',
  'research scientist',
  'data scientist',
  'decision scientist',
  'computer vision',
  'nlp',
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

const SEARCH_CONTEXT_PHRASES = [
  'artificial intelligence',
  'machine learning',
  'deep learning',
  'data science',
  'data analytics',
  'analytics',
  'business intelligence',
  'computer vision',
  'nlp',
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
  'model development',
  'algorithms',
  'systems engineering',
  'process engineering',
]

const INDIVIDUAL_CONTRIBUTOR_SEARCH_PHRASES = [
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

const OFF_TARGET_BUSINESS_TITLE_PHRASES = [
  'customer success',
  'marketing',
  'sales',
  'recruit',
  'talent',
  'human resources',
  'budget',
  'accounting',
  'payroll',
  'fp a',
  'accounts payable',
  'accounts receivable',
  'bookkeeper',
  'bookkeeping',
  'tax',
  'auditor',
  'audit',
  'benefits',
  'compensation',
  'success manager',
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

const GENERIC_CATCHALL_TITLE_PHRASES = [
  "don't see what you're looking for",
  'dont see what youre looking for',
  'general interest',
  'future opportunities',
  'join our talent community',
  'talent community',
]

const OFF_TARGET_BUSINESS_TEXT_PHRASES = [
  'general ledger',
  'journal entry',
  'accounts payable',
  'accounts receivable',
  'bank reconciliation',
  'benefits administration',
  'tax return',
  'payroll processing',
  'sourcing candidates',
  'candidate pipeline',
  'sales quota',
  'pipeline generation',
  'demand generation',
]

function buildSuggestedQueries(
  skills: Skill[],
  projects: Project[],
  primaryVariant: ResumeVariant | null,
  candidateProfile: CandidateProfile | null
): string[] {
  return buildPortfolioQueryPack(skills, projects, primaryVariant, candidateProfile).slice(0, 8)
}

function buildPortfolioSearchRequests(
  baseSearch: ExternalJobSearchRequest,
  suggestedQueries: string[],
  skills: Skill[],
  projects: Project[],
  primaryVariant: ResumeVariant | null,
  candidateProfile: CandidateProfile | null
): ExternalJobSearchRequest[] {
  const queries = Array.from(
    new Set([
      ...buildPortfolioQueryPack(
        skills,
        projects,
        primaryVariant,
        candidateProfile,
        baseSearch.query.trim()
      ),
      ...suggestedQueries,
    ].filter((value) => value.length > 2))
  )

  return queries.slice(0, 8).map((query) => ({
    ...baseSearch,
    source: 'usajobs',
    boardOrSite: '',
    query,
    limit: Math.max(20, Math.min(baseSearch.limit, 35)),
  }))
}

function getSearchLimitOptions(source: JobSearchSource): number[] {
  return source === 'usajobs' ? [20, 50, 100, 200] : [10, 20, 30, 50]
}

function inferRoleLabel(skillTerms: string[], projectTags: string[], variantTerms: string[]): string {
  const haystack = [...skillTerms, ...projectTags, ...variantTerms].join(' ').toLowerCase()

  if (/\bllm\b|\bnlp\b|\bgenerative ai\b|\bprompt\b/.test(haystack)) return 'Applied AI Engineer'
  if (/\bmachine learning\b|\bdeep learning\b|\bcomputer vision\b/.test(haystack)) return 'Machine Learning Engineer'
  if (/\bdata science\b|\banalytics\b|\bsql\b/.test(haystack)) return 'Data Scientist'
  if (/\breact\b|\btypescript\b|\bfrontend\b/.test(haystack)) return 'Frontend Engineer'
  return 'Data Scientist'
}

function buildPortfolioQueryPack(
  skills: Skill[],
  projects: Project[],
  primaryVariant: ResumeVariant | null,
  candidateProfile: CandidateProfile | null,
  manualQuery = ''
): string[] {
  const skillTerms = skills.map((skill) => normalizeQueryPhrase(skill.name)).filter(Boolean)
  const projectTags = Array.from(
    new Set(projects.flatMap((project) => project.tags.map((tag) => normalizeQueryPhrase(tag))).filter(Boolean))
  )
  const jobTitlePhrase = normalizeQueryPhrase(primaryVariant?.sourceJobTitle ?? '')
  const variantTerms = tokenizeInline(primaryVariant?.sourceJobTitle ?? '')
  const educationTerms = buildEducationSignalTerms(candidateProfile, primaryVariant)
  const portfolioTerms = Array.from(new Set([
    ...skillTerms,
    ...projectTags,
    ...variantTerms,
    ...educationTerms,
    jobTitlePhrase,
  ].filter(Boolean)))
  const haystack = portfolioTerms.join(' ')

  return dedupeQueryPhrases([
    normalizeQueryPhrase(manualQuery),
    inferRoleLabel(skillTerms, projectTags, [...variantTerms, ...educationTerms]),
    ...buildRoleQuerySeeds(haystack),
    ...buildSkillQuerySeeds(haystack),
  ]).slice(0, 8)
}

function buildEducationSignalTerms(
  candidateProfile: CandidateProfile | null,
  primaryVariant: ResumeVariant | null
): string[] {
  const education = candidateProfile?.education ?? []
  if (education.length === 0) return []

  const educationSection = primaryVariant?.content.sections.find(
    (section): section is ResumeEducationSection => section.type === 'education'
  )

  const selectedEntries = educationSection?.includedIndices.length
    ? educationSection.includedIndices
        .map((index) => education[index])
        .filter(Boolean)
    : education

  return dedupeQueryPhrases(
    selectedEntries.flatMap((entry) => [
      normalizeQueryPhrase(entry.title),
      ...tokenizeInline(entry.title),
    ])
  )
}

function buildRoleQuerySeeds(haystack: string): string[] {
  const queries: string[] = []
  const hasDataSignals = hasPortfolioSignal(haystack, ['data science', 'analytics', 'analyst', 'sql'])
  const hasMlSignals = hasPortfolioSignal(haystack, [
    'machine learning',
    'deep learning',
    'pytorch',
    'tensorflow',
    'computer vision',
    'nlp',
  ])
  const hasAiSignals = hasPortfolioSignal(haystack, [
    'llm',
    'nlp',
    'generative ai',
    'machine learning',
    'deep learning',
  ])
  const hasFrontEndSignals = hasPortfolioSignal(haystack, ['react', 'typescript', 'frontend'])
  const hasPythonSignals = hasPortfolioSignal(haystack, ['python'])
  const hasSqlSignals = hasPortfolioSignal(haystack, ['sql'])
  const hasBusinessSignals = hasPortfolioSignal(haystack, [
    'business',
    'management',
    'operations',
    'decision support',
    'business intelligence',
  ])
  const hasEngineeringSignals = hasPortfolioSignal(haystack, [
    'engineering',
    'systems',
    'quality',
    'process',
    'industrial',
  ])
  const hasRiskSignals = hasPortfolioSignal(haystack, [
    'risk',
    'fraud',
    'financial',
    'finance',
    'forecasting',
  ])
  const hasOpsResearchSignals = hasPortfolioSignal(haystack, [
    'operations research',
    'optimization',
    'supply chain',
    'logistics',
    'simulation',
  ])

  if (hasDataSignals) {
    queries.push('data scientist', 'data analyst', 'business intelligence analyst')
  }
  if (hasDataSignals && (hasBusinessSignals || hasEngineeringSignals || hasOpsResearchSignals)) {
    queries.push('operations research analyst', 'management analyst data analytics')
  }
  if (hasEngineeringSignals && (hasDataSignals || hasSqlSignals)) {
    queries.push('operations analyst process improvement', 'business analyst data analytics')
  }
  if ((hasRiskSignals || hasBusinessSignals) && (hasSqlSignals || hasPythonSignals)) {
    queries.push('risk analyst sql python', 'financial analyst data analytics')
  }
  if (hasOpsResearchSignals) {
    queries.push('supply chain analyst sql')
  }
  if (hasBusinessSignals && hasSqlSignals) {
    queries.push('business systems analyst sql')
  }
  if (hasDataSignals && hasSqlSignals && hasPythonSignals) {
    queries.push('data analyst python sql', 'business intelligence analyst sql python')
  }
  if (hasMlSignals) {
    queries.push('machine learning engineer', 'ai engineer')
    if (hasPythonSignals) queries.push('machine learning engineer python')
  }
  if (hasAiSignals) {
    queries.push('applied ai engineer', 'applied scientist machine learning')
  }
  if (hasPortfolioSignal(haystack, ['nlp', 'llm', 'generative ai'])) {
    queries.push('nlp engineer', 'nlp engineer python')
  }
  if (hasPortfolioSignal(haystack, ['computer vision'])) {
    queries.push(
      hasPortfolioSignal(haystack, ['pytorch'])
        ? 'computer vision engineer pytorch'
        : 'computer vision engineer'
    )
  }
  if (hasFrontEndSignals && !hasDataSignals && !hasMlSignals) {
    queries.push('frontend engineer react typescript', 'software engineer react typescript')
  }

  return queries
}

function buildSkillQuerySeeds(haystack: string): string[] {
  const queries: string[] = []

  if (hasPortfolioSignal(haystack, ['machine learning']) && hasPortfolioSignal(haystack, ['python'])) {
    queries.push('machine learning python')
  }
  if (hasPortfolioSignal(haystack, ['deep learning', 'machine learning']) && hasPortfolioSignal(haystack, ['pytorch'])) {
    queries.push('deep learning pytorch')
  }
  if (hasPortfolioSignal(haystack, ['deep learning', 'machine learning']) && hasPortfolioSignal(haystack, ['tensorflow'])) {
    queries.push('deep learning tensorflow')
  }
  if (hasPortfolioSignal(haystack, ['computer vision'])) {
    queries.push(
      hasPortfolioSignal(haystack, ['pytorch']) ? 'computer vision pytorch' : 'computer vision'
    )
  }
  if (hasPortfolioSignal(haystack, ['nlp'])) {
    queries.push(hasPortfolioSignal(haystack, ['python']) ? 'nlp machine learning python' : 'nlp machine learning')
  }
  if (
    hasPortfolioSignal(haystack, ['data science', 'analytics']) &&
    hasPortfolioSignal(haystack, ['sql']) &&
    hasPortfolioSignal(haystack, ['python'])
  ) {
    queries.push('data analysis python sql', 'dashboard reporting sql python')
  }
  if (
    hasPortfolioSignal(haystack, ['analytics', 'business intelligence']) &&
    hasPortfolioSignal(haystack, ['sql'])
  ) {
    queries.push('business intelligence sql', 'reporting analytics sql')
  }
  if (
    hasPortfolioSignal(haystack, ['optimization', 'operations research', 'forecasting']) &&
    hasPortfolioSignal(haystack, ['python'])
  ) {
    queries.push('operations research optimization python')
  }
  if (
    hasPortfolioSignal(haystack, ['risk', 'fraud', 'financial']) &&
    hasPortfolioSignal(haystack, ['sql', 'python'])
  ) {
    queries.push('risk analytics python sql')
  }

  return queries
}

function sortSearchResultsForPortfolio(
  results: ExternalJobSearchResult[],
  skills: Skill[],
  projects: Project[],
  primaryVariant: ResumeVariant | null,
  candidateProfile: CandidateProfile | null
): ExternalJobSearchResult[] {
  return [...results]
    .map((result) => {
      const fit = scoreJobFit({
        job: {
          title: result.title,
          company: result.company,
          description: result.description,
          location: result.location,
          employment_type: result.employment_type,
        },
        skills,
        projects,
        resumeVariant: primaryVariant,
        candidateProfile,
      })

      const remoteBoost = result.remote_type === 'remote' ? 6 : result.remote_type === 'hybrid' ? 2 : 0
      const titleBoost = computeTargetRoleBoost(result.title, result.description, fit)
      const penalty = computeOffTargetSearchPenalty(result.title, result.description)

      return {
        result,
        rank: fit.score + remoteBoost + titleBoost - penalty,
      }
    })
    .sort((left, right) => right.rank - left.rank || left.result.title.localeCompare(right.result.title))
    .map(({ result }) => result)
}

function computeTargetRoleBoost(
  title: string,
  description: string,
  fit: ReturnType<typeof scoreJobFit>
): number {
  const normalizedTitle = normalizeQueryPhrase(title)
  const normalizedJobText = normalizeQueryPhrase([title, description].join(' '))
  const contextHits = countMatchingQueryPhrases(normalizedJobText, SEARCH_CONTEXT_PHRASES)
  const icSignalHits = countMatchingQueryPhrases(normalizedJobText, INDIVIDUAL_CONTRIBUTOR_SEARCH_PHRASES)
  const leadershipRole = containsAnyQueryPhrase(normalizedTitle, OFF_TARGET_LEADERSHIP_TITLE_PHRASES)
  const evidenceCount = fit.matchedSkills.length + fit.matchedProjects.length + fit.matchedKeywords.length
  let boost = 0

  if (containsAnyQueryPhrase(normalizedTitle, CORE_SEARCH_TITLE_PHRASES)) {
    boost += 10
  }

  if (
    containsAnyQueryPhrase(normalizedTitle, ADJACENT_ANALYST_TITLE_PHRASES) &&
    contextHits >= 2 &&
    evidenceCount >= 2
  ) {
    boost += 6
  }

  if (
    /\b(engineer|scientist)\b/.test(normalizedTitle) &&
    !leadershipRole &&
    !containsAnyQueryPhrase(normalizedTitle, OFF_TARGET_ENGINEERING_TITLE_PHRASES) &&
    fit.matchedSkills.length > 0 &&
    (contextHits >= 1 || icSignalHits >= 2)
  ) {
    boost += 2
  }

  if (/\banalyst\b/.test(normalizedTitle) && contextHits >= 3 && evidenceCount >= 3) {
    boost += 3
  }

  if (contextHits >= 5 && evidenceCount >= 3) {
    boost += 2
  }

  return boost
}

function computeOffTargetSearchPenalty(title: string, description: string): number {
  const normalizedTitle = normalizeQueryPhrase(title)
  const normalizedJobText = normalizeQueryPhrase([title, description].join(' '))
  const targetContextHits = countMatchingQueryPhrases(normalizedJobText, SEARCH_CONTEXT_PHRASES)
  const icSignalHits = countMatchingQueryPhrases(normalizedJobText, INDIVIDUAL_CONTRIBUTOR_SEARCH_PHRASES)
  let penalty = 0

  if (containsAnyQueryPhrase(normalizedTitle, OFF_TARGET_BUSINESS_TITLE_PHRASES)) {
    penalty += targetContextHits <= 1 ? 18 : 8
  }

  if (containsAnyQueryPhrase(normalizedTitle, OFF_TARGET_ENGINEERING_TITLE_PHRASES)) {
    if (icSignalHits <= 1) {
      penalty += 16
    } else if (targetContextHits <= 2) {
      penalty += 10
    } else if (targetContextHits <= 4) {
      penalty += 5
    }
  }

  if (containsAnyQueryPhrase(normalizedTitle, OFF_TARGET_LEADERSHIP_TITLE_PHRASES)) {
    if (icSignalHits <= 1) {
      penalty += 16
    } else if (icSignalHits <= 2) {
      penalty += 10
    } else if (targetContextHits <= 3) {
      penalty += 5
    }
  }

  if (containsAnyQueryPhrase(normalizedTitle, [
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
  ])) {
    penalty += 14
  }

  const offTargetDomainHits = countMatchingQueryPhrases(normalizedJobText, [
    ...OFF_TARGET_BUSINESS_TEXT_PHRASES,
    'clinical',
    'laboratory',
    'diagnosis',
    'diagnostic',
    'patient',
    'patients',
    'hospital',
    'healthcare',
    'public health',
    'medical',
    'biomedical',
    'pathology',
    'specimen',
    'disease',
    'epidemiology',
  ])

  if (offTargetDomainHits >= 3 && targetContextHits <= 1) {
    penalty += 8
  } else if (offTargetDomainHits >= 2 && targetContextHits <= 2) {
    penalty += 4
  }

  if (
    /\bscientist\b/.test(normalizedTitle) &&
    containsAnyQueryPhrase(normalizedTitle, ['clinical', 'laboratory', 'health', 'medical', 'biomedical'])
  ) {
    penalty += 4
  }

  if (containsAnyQueryPhrase(normalizedTitle, GENERIC_CATCHALL_TITLE_PHRASES)) {
    penalty += 22
  }

  if (
    /\bmanager\b/.test(normalizedTitle) &&
    targetContextHits <= 1
  ) {
    penalty += 4
  }

  return penalty
}

function countMatchingQueryPhrases(haystack: string, needles: string[]): number {
  return needles.filter((needle) => containsAnyQueryPhrase(haystack, [needle])).length
}

function dedupeQueryPhrases(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeQueryPhrase(value)).filter((value) => value.length > 2)))
}

function normalizeQueryPhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasPortfolioSignal(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(normalizeQueryPhrase(needle)))
}

function containsAnyQueryPhrase(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(normalizeQueryPhrase(needle)))
}

function tokenizeInline(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
}

function humanizeSearchSource(source: JobSyncRun['source']): string {
  if (source === 'greenhouse') return 'Greenhouse'
  if (source === 'lever') return 'Lever'
  if (source === 'generic') return 'Generic'
  return 'USAJobs'
}

function syncRunBadgeClassName(status: JobSyncRun['status']): string {
  if (status === 'success') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
  if (status === 'error') return 'border-amber-400/20 bg-amber-400/10 text-amber-100'
  return 'border-blue-400/20 bg-blue-400/10 text-blue-200'
}

function formatRelativeSyncTime(value: string): string {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'recently'

  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000))

  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}

function formatSyncRunMeta(syncRun: JobSyncRun): string {
  const parts = [
    humanizeSearchSource(syncRun.source),
    syncRun.query,
    syncRun.location,
    `${syncRun.result_count} found`,
    `${syncRun.imported_count} imported`,
    formatRelativeSyncTime(syncRun.completed_at ?? syncRun.started_at),
  ].filter(Boolean)

  return parts.join(' | ')
}

function humanizeDiscoveryStatus(status: JobPosting['discovery_status']): string {
  if (status === 'discovered') return 'watchlist sync'
  if (status === 'snapshot') return 'snapshot'
  if (status === 'unsupported') return 'manual review'
  return 'manual'
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{Math.round(value)}</p>
    </div>
  )
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

function readDraft<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) }
  } catch {
    return fallback
  }
}

function writeDraft<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function clearDraft(key: string) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(key)
}
