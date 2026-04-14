import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ExternalLink, FileText, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { getAdminPath } from '@/lib/adminConfig'
import { scoreJobFit } from '@/lib/jobMatching'
import {
  deleteApplication,
  getAllProjects,
  getApplications,
  getJobPostings,
  getResumeWorkspace,
  getSkills,
  updateApplication,
} from '@/lib/supabase'
import { ApplicationRecord, ApplicationStatus, JobPosting, Project, Skill } from '@/types'
import { ResumeVariant } from '@/types/resume'

const STATUS_OPTIONS: ApplicationStatus[] = [
  'saved',
  'tailoring',
  'ready_to_apply',
  'applied',
  'interview',
  'offer',
  'rejected',
  'archived',
]

type ApplicationFilter = 'active' | 'ready' | 'applied' | 'closed' | 'all'

export function AdminApplications() {
  const [applications, setApplications] = useState<ApplicationRecord[] | null>([])
  const [jobs, setJobs] = useState<JobPosting[] | null>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [resumeVariants, setResumeVariants] = useState<ResumeVariant[]>([])
  const [activeFilter, setActiveFilter] = useState<ApplicationFilter>('active')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    Promise.all([
      getApplications(),
      getJobPostings(),
      getSkills(),
      getAllProjects(),
      getResumeWorkspace(),
    ]).then(([applicationData, jobData, skillsData, projectData, workspace]) => {
      if (!mounted) return
      setApplications(applicationData)
      setJobs(jobData)
      setSkills(skillsData)
      setProjects(projectData)
      setResumeVariants(workspace.variants)
    })

    return () => {
      mounted = false
    }
  }, [])

  const schemaReady = applications !== null && jobs !== null
  const primaryVariant = useMemo(
    () => resumeVariants.find((variant) => variant.isPrimary) ?? resumeVariants[0] ?? null,
    [resumeVariants]
  )
  const jobMap = useMemo(
    () => new Map((jobs ?? []).map((job) => [job.id, job])),
    [jobs]
  )
  const resumeMap = useMemo(
    () => new Map(resumeVariants.map((variant) => [variant.id, variant])),
    [resumeVariants]
  )

  const filteredApplications = useMemo(() => {
    const source = applications ?? []
    return source.filter((application) => {
      if (activeFilter === 'all') return true
      if (activeFilter === 'active') {
        return application.status === 'saved' || application.status === 'tailoring'
      }
      if (activeFilter === 'ready') {
        return application.status === 'ready_to_apply' || application.status === 'interview'
      }
      if (activeFilter === 'applied') {
        return application.status === 'applied' || application.status === 'offer'
      }
      return application.status === 'rejected' || application.status === 'archived'
    })
  }, [applications, activeFilter])

  const stats = useMemo(() => {
    const source = applications ?? []
    return [
      { label: 'Tracked', value: source.length, tone: 'text-foreground' },
      {
        label: 'Tailoring',
        value: source.filter((item) => item.status === 'tailoring').length,
        tone: 'text-amber-300',
      },
      {
        label: 'Applied',
        value: source.filter((item) => item.status === 'applied').length,
        tone: 'text-blue-300',
      },
      {
        label: 'Interviews+',
        value: source.filter((item) => item.status === 'interview' || item.status === 'offer').length,
        tone: 'text-emerald-300',
      },
    ]
  }, [applications])

  const handlePatch = async (
    id: string,
    patch: Partial<Pick<ApplicationRecord, 'resume_variant_id' | 'status' | 'follow_up_at' | 'applied_at' | 'notes'>>
  ) => {
    if (!schemaReady) return
    setSavingId(id)

    try {
      const updated = await updateApplication(id, patch)
      if (updated) {
        setApplications((current) =>
          (current ?? []).map((application) => (application.id === updated.id ? updated : application))
        )
      }
    } catch (error) {
      console.error('Error updating application:', error)
    } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!schemaReady) return
    setDeletingId(id)
    try {
      await deleteApplication(id)
      setApplications((current) => (current ?? []).filter((application) => application.id !== id))
    } catch (error) {
      console.error('Error deleting application:', error)
    } finally {
      setDeletingId(null)
    }
  }

  if (!schemaReady) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Applications</h1>
          <p className="text-muted-foreground mt-1">
            Run migration 004 to unlock application tracking.
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Applications</h1>
          <p className="text-muted-foreground mt-1">
            Keep the pipeline tight: assign a resume variant, move status forward, and set follow-ups.
          </p>
        </div>
        <Link to={getAdminPath('jobs')}>
          <Button variant="outline" className="gap-2">
            Back to Jobs
            <RefreshCw className="h-4 w-4" />
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={activeFilter} onValueChange={(value) => setActiveFilter(value as ApplicationFilter)}>
          <TabsList className="bg-black/30">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="ready">Ready</TabsTrigger>
            <TabsTrigger value="applied">Applied</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">Changes save immediately on select/date updates.</p>
      </div>

      <div className="space-y-3">
        {filteredApplications.map((application) => {
          const job = jobMap.get(application.job_posting_id)
          const assignedVariant = application.resume_variant_id
            ? resumeMap.get(application.resume_variant_id) ?? primaryVariant
            : primaryVariant
          const fit = job
            ? scoreJobFit({
                job,
                skills,
                projects,
                resumeVariant: assignedVariant,
              })
            : null

          return (
            <Card key={application.id} className="glass">
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold leading-tight text-foreground">
                        {job?.title || 'Untitled role'}
                      </h3>
                      <Badge className={statusBadgeClassName(application.status)}>
                        {application.status.replace(/_/g, ' ')}
                      </Badge>
                      {fit && (
                        <Badge variant="outline" className="border-white/10">
                          Fit {fit.score}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[job?.company, job?.location].filter(Boolean).join(' • ') || 'Job removed or archived'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {savingId === application.id && <span>Saving...</span>}
                    {job?.job_url && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => window.open(job.job_url, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open
                      </Button>
                    )}
                  </div>
                </div>

                {fit && (
                  <p className="text-sm text-muted-foreground">
                    {fit.summary}
                  </p>
                )}

                <div className="grid gap-3 xl:grid-cols-[180px_220px_160px_160px]">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</label>
                    <select
                      value={application.status}
                      onChange={(event) => {
                        const nextStatus = event.target.value as ApplicationStatus
                        handlePatch(application.id, {
                          status: nextStatus,
                          applied_at:
                            nextStatus === 'applied'
                              ? application.applied_at ?? new Date().toISOString().slice(0, 10)
                              : application.applied_at,
                        })
                      }}
                      className="flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Resume variant
                    </label>
                    <select
                      value={application.resume_variant_id ?? ''}
                      onChange={(event) =>
                        handlePatch(application.id, {
                          resume_variant_id: event.target.value || null,
                        })
                      }
                      className="flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                    >
                      <option value="">Unassigned</option>
                      {resumeVariants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.name}
                          {variant.isPrimary ? ' (primary)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Follow-up
                    </label>
                    <input
                      type="date"
                      value={application.follow_up_at ?? ''}
                      onChange={(event) =>
                        handlePatch(application.id, {
                          follow_up_at: event.target.value || null,
                        })
                      }
                      className="flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Applied on
                    </label>
                    <input
                      type="date"
                      value={application.applied_at ?? ''}
                      onChange={(event) =>
                        handlePatch(application.id, {
                          applied_at: event.target.value || null,
                        })
                      }
                      className="flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Notes</label>
                    <Textarea
                      defaultValue={application.notes}
                      onBlur={(event) => {
                        const nextNotes = event.target.value
                        if (nextNotes !== application.notes) {
                          handlePatch(application.id, { notes: nextNotes })
                        }
                      }}
                      placeholder="Referral status, recruiter notes, interview prep, blockers..."
                      className="min-h-[96px] bg-black/40 border-white/10"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link
                      to={`${getAdminPath('resume')}?job=${encodeURIComponent(application.job_posting_id)}&tab=tailor`}
                      onClick={() => {
                        if (application.status === 'saved') {
                          void handlePatch(application.id, { status: 'tailoring' })
                        }
                      }}
                    >
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <FileText className="h-4 w-4" />
                        Tailor for this job
                      </Button>
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() =>
                        handlePatch(application.id, {
                          follow_up_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                            .toISOString()
                            .slice(0, 10),
                        })
                      }
                    >
                      <CalendarClock className="h-4 w-4" />
                      Follow up in 3 days
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                      disabled={deletingId === application.id}
                      onClick={() => handleDelete(application.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {filteredApplications.length === 0 && (
          <Card className="glass">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nothing in this lane yet. Add a job from the Jobs page and track it here.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function statusBadgeClassName(status: ApplicationStatus): string {
  if (status === 'offer') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
  if (status === 'interview') return 'border-blue-400/20 bg-blue-400/10 text-blue-200'
  if (status === 'applied') return 'border-indigo-400/20 bg-indigo-400/10 text-indigo-100'
  if (status === 'tailoring' || status === 'ready_to_apply') {
    return 'border-amber-400/20 bg-amber-400/10 text-amber-100'
  }
  if (status === 'rejected' || status === 'archived') {
    return 'border-white/10 bg-white/5 text-muted-foreground'
  }
  return 'border-white/10 bg-white/5 text-foreground'
}
