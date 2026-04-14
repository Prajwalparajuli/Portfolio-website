import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Archive,
  ArrowRight,
  BriefcaseBusiness,
  Compass,
  ExternalLink,
  Plus,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { getAdminPath } from '@/lib/adminConfig'
import { searchExternalJobs } from '@/lib/jobSearch'
import { scoreJobFit } from '@/lib/jobMatching'
import {
  createJobPosting,
  getAllProjects,
  getApplications,
  getJobPostings,
  getResumeWorkspace,
  getSkills,
  saveApplication,
  updateJobPosting,
  upsertImportedJobPosting,
} from '@/lib/supabase'
import {
  ApplicationRecord,
  ExternalJobSearchRequest,
  ExternalJobSearchResult,
  JobPosting,
  JobPostingFormData,
  JobSearchSource,
  Project,
  Skill,
} from '@/types'
import { ResumeVariant } from '@/types/resume'

const EMPTY_JOB_FORM: JobPostingFormData = {
  source: 'manual',
  external_id: '',
  title: '',
  company: '',
  location: '',
  remote_type: 'unknown',
  employment_type: '',
  salary_range: '',
  job_url: '',
  description: '',
  fit_notes: '',
}

const EMPTY_SEARCH_FORM: ExternalJobSearchRequest = {
  source: 'greenhouse',
  query: '',
  location: '',
  boardOrSite: '',
  remoteOnly: false,
  limit: 20,
}

type JobFilter = 'all' | 'strong' | 'review' | 'tracked'
type JobsMode = 'saved' | 'search'

export function AdminJobs() {
  const [jobs, setJobs] = useState<JobPosting[] | null>([])
  const [applications, setApplications] = useState<ApplicationRecord[] | null>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [resumeVariants, setResumeVariants] = useState<ResumeVariant[]>([])
  const [activeFilter, setActiveFilter] = useState<JobFilter>('all')
  const [panelMode, setPanelMode] = useState<JobsMode>('saved')
  const [formData, setFormData] = useState<JobPostingFormData>(EMPTY_JOB_FORM)
  const [searchForm, setSearchForm] = useState<ExternalJobSearchRequest>(EMPTY_SEARCH_FORM)
  const [searchResults, setSearchResults] = useState<ExternalJobSearchResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [trackingJobId, setTrackingJobId] = useState<string | null>(null)
  const [archivingJobId, setArchivingJobId] = useState<string | null>(null)
  const [importingExternalKey, setImportingExternalKey] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    Promise.all([
      getJobPostings(),
      getApplications(),
      getSkills(),
      getAllProjects(),
      getResumeWorkspace(),
    ]).then(([jobData, applicationData, skillsData, projectData, workspace]) => {
      if (!mounted) return
      setJobs(jobData)
      setApplications(applicationData)
      setSkills(skillsData)
      setProjects(projectData)
      setResumeVariants(workspace.variants)
    })

    return () => {
      mounted = false
    }
  }, [])

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
        }),
      ])
    )
  }, [jobs, skills, projects, primaryVariant])

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
      const fit = fitById.get(job.id)
      if (!fit) return activeFilter === 'all'

      if (activeFilter === 'strong') return fit.band === 'strong'
      if (activeFilter === 'review') return fit.band === 'review'
      if (activeFilter === 'tracked') return trackedJobIds.has(job.id)
      return true
    })
  }, [jobs, fitById, activeFilter, trackedJobIds])

  const stats = useMemo(() => {
    const source = jobs ?? []
    const fits = source.map((job) => fitById.get(job.id)).filter(Boolean)

    return [
      { label: 'Open jobs', value: source.length, tone: 'text-foreground' },
      {
        label: 'Strong fits',
        value: fits.filter((fit) => fit?.band === 'strong').length,
        tone: 'text-emerald-300',
      },
      {
        label: 'Need review',
        value: fits.filter((fit) => fit?.band === 'review').length,
        tone: 'text-amber-300',
      },
      { label: 'Tracked', value: trackedJobIds.size, tone: 'text-blue-300' },
    ]
  }, [jobs, fitById, trackedJobIds])

  const suggestedQueries = useMemo(
    () => buildSuggestedQueries(skills, projects, primaryVariant),
    [skills, projects, primaryVariant]
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
          }),
        ])
      ),
    [searchResults, skills, projects, primaryVariant]
  )

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
      }
    } catch (error) {
      console.error('Error creating job posting:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault()
    setIsSearching(true)
    setSearchError(null)

    try {
      const results = await searchExternalJobs(searchForm)
      setSearchResults(results)
    } catch (error) {
      setSearchResults([])
      setSearchError(error instanceof Error ? error.message : 'Search failed.')
    } finally {
      setIsSearching(false)
    }
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

  const handleImportResult = async (result: ExternalJobSearchResult) => {
    setImportingExternalKey(`${result.source}:${result.external_id}`)
    try {
      const imported = await upsertImportedJobPosting({
        source: result.source,
        external_id: result.external_id,
        title: result.title,
        company: result.company,
        location: result.location,
        remote_type: result.remote_type,
        employment_type: result.employment_type,
        salary_range: result.salary_range,
        job_url: result.job_url,
        description: result.description,
        fit_notes: `Imported from ${result.source_label}`,
      })

      if (imported) {
        setJobs((current) => {
          const existing = current ?? []
          const next = existing.filter(
            (job) => !(job.source === imported.source && job.external_id === imported.external_id)
          )
          return [imported, ...next]
        })
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Import failed.')
    } finally {
      setImportingExternalKey(null)
    }
  }

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
        <Link to={getAdminPath('applications')}>
          <Button variant="outline" className="gap-2">
            Applications
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
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
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Connector search</p>
                    <p className="text-xs text-muted-foreground">
                      Search Greenhouse or Lever board feeds now. USAJobs also works once its key is configured.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="search-source">Source</Label>
                    <select
                      id="search-source"
                      value={searchForm.source}
                      onChange={(event) =>
                        setSearchForm((current) => ({
                          ...current,
                          source: event.target.value as JobSearchSource,
                        }))
                      }
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
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
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
                    Suggested queries are derived from your current skills, projects, and primary resume variant.
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
                  const fit = fitById.get(job.id)
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
                              {fit && (
                                <Badge className={fitBadgeClassName(fit.band)}>
                                  Fit {fit.score}
                                </Badge>
                              )}
                              {tracked && (
                                <Badge variant="outline" className="border-blue-400/30 text-blue-200">
                                  In applications
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
                          </div>
                        </div>

                        {fit && (
                          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                              <Sparkles className="h-4 w-4 text-amber-300" />
                              Match read
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{fit.summary}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {fit.matchedSkills.slice(0, 4).map((skill) => (
                                <Badge
                                  key={`${job.id}-${skill}`}
                                  variant="outline"
                                  className="border-emerald-400/20 text-emerald-200"
                                >
                                  {skill}
                                </Badge>
                              ))}
                              {fit.matchedProjects.slice(0, 2).map((projectTitle) => (
                                <Badge
                                  key={`${job.id}-${projectTitle}`}
                                  variant="outline"
                                  className="border-blue-400/20 text-blue-200"
                                >
                                  {projectTitle}
                                </Badge>
                              ))}
                            </div>
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
    return 'Paste the board token or a Greenhouse board URL. The search runs against that company board.'
  }
  if (source === 'lever') {
    return 'Paste the site name or a Lever jobs URL. The search runs against that Lever site.'
  }
  return ''
}

function buildSuggestedQueries(
  skills: Skill[],
  projects: Project[],
  primaryVariant: ResumeVariant | null
): string[] {
  const skillTerms = skills.map((skill) => skill.name.trim()).filter(Boolean)
  const projectTags = Array.from(new Set(projects.flatMap((project) => project.tags))).filter(Boolean)
  const variantTerms = tokenizeInline(primaryVariant?.sourceJobTitle ?? '')
  const role = inferRoleLabel(skillTerms, projectTags, variantTerms)
  const leadingTerms = Array.from(new Set([...variantTerms, ...projectTags, ...skillTerms]))
    .filter((term) => term.length > 1)
    .slice(0, 8)

  const candidates = [
    [role, ...leadingTerms.slice(0, 3)].filter(Boolean).join(' '),
    leadingTerms.slice(0, 4).join(' '),
    [role, ...leadingTerms.slice(3, 6)].filter(Boolean).join(' '),
  ]

  return Array.from(
    new Set(candidates.map((value) => value.trim()).filter((value) => value.length > 6))
  ).slice(0, 3)
}

function inferRoleLabel(skillTerms: string[], projectTags: string[], variantTerms: string[]): string {
  const haystack = [...skillTerms, ...projectTags, ...variantTerms].join(' ').toLowerCase()

  if (/\bllm\b|\bnlp\b|\bgenerative ai\b|\bprompt\b/.test(haystack)) return 'Applied AI Engineer'
  if (/\bmachine learning\b|\bdeep learning\b|\bcomputer vision\b/.test(haystack)) return 'Machine Learning Engineer'
  if (/\bdata science\b|\banalytics\b|\bsql\b/.test(haystack)) return 'Data Scientist'
  if (/\breact\b|\btypescript\b|\bfrontend\b/.test(haystack)) return 'Software Engineer'
  return 'Software Engineer'
}

function tokenizeInline(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
}
