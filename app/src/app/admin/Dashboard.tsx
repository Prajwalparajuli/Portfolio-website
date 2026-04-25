import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BriefcaseBusiness,
  CheckCircle2,
  Compass,
  FileText,
  FolderKanban,
  NotebookPen,
  RefreshCw,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getAdminPath } from '@/lib/adminConfig'
import { discoverWatchlist, runScheduledWatchlists } from '@/lib/careerCockpit'
import {
  getAllProjects,
  getApplications,
  getCandidateAnswers,
  getCareerContacts,
  getCompanyWatchlists,
  getJobMatches,
  getJobPostings,
  getNotificationItems,
  getResumeWorkspace,
  getSavedJobSearches,
  saveApplication,
  updateApplication,
  updateCareerContact,
  updateNotificationItem,
} from '@/lib/supabase'
import type {
  ApplicationRecord,
  CandidateAnswer,
  CandidateProfile,
  CareerContact,
  CompanyWatchlist,
  JobMatch,
  JobPosting,
  NotificationItem,
  Project,
  SavedJobSearch,
} from '@/types'
import { ResumeVariant } from '@/types/resume'

const CLOSED_APPLICATION_STATUSES = new Set<ApplicationRecord['status']>([
  'applied',
  'interview',
  'offer',
  'rejected',
  'archived',
])

export function AdminDashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [jobMatches, setJobMatches] = useState<JobMatch[]>([])
  const [watchlists, setWatchlists] = useState<CompanyWatchlist[] | null>([])
  const [notifications, setNotifications] = useState<NotificationItem[] | null>([])
  const [resumeVariants, setResumeVariants] = useState<ResumeVariant[]>([])
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null)
  const [candidateAnswers, setCandidateAnswers] = useState<CandidateAnswer[] | null>([])
  const [savedSearches, setSavedSearches] = useState<SavedJobSearch[] | null>([])
  const [contacts, setContacts] = useState<CareerContact[] | null>([])
  const [workingKey, setWorkingKey] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    Promise.all([
      getAllProjects(),
      getJobPostings(),
      getApplications(),
      getJobMatches(),
      getCompanyWatchlists(),
      getNotificationItems(),
      getResumeWorkspace(),
      getCandidateAnswers(),
      getSavedJobSearches(),
      getCareerContacts(),
    ]).then(
      ([
        projectData,
        jobData,
        applicationData,
        matchData,
        watchlistData,
        notificationData,
        workspace,
        answerData,
        savedSearchData,
        contactData,
      ]) => {
        if (!mounted) return
        setProjects(projectData)
        setJobs(jobData ?? [])
        setApplications(applicationData ?? [])
        setJobMatches(matchData ?? [])
        setWatchlists(watchlistData)
        setNotifications(notificationData)
        setResumeVariants(workspace.variants)
        setCandidateProfile(workspace.candidateProfile)
        setCandidateAnswers(answerData)
        setSavedSearches(savedSearchData)
        setContacts(contactData)
      }
    )

    return () => {
      mounted = false
    }
  }, [])

  const primaryVariant = useMemo(
    () => resumeVariants.find((variant) => variant.isPrimary) ?? resumeVariants[0] ?? null,
    [resumeVariants]
  )

  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs])
  const applicationsByJobId = useMemo(
    () => new Map(applications.map((application) => [application.job_posting_id, application])),
    [applications]
  )

  const publishedProjects = projects.filter((project) => project.is_published)
  const activeApplications = applications.filter((application) => !CLOSED_APPLICATION_STATUSES.has(application.status))

  const reviewNow = jobMatches
    .filter((match) => match.band === 'strong' || match.band === 'review')
    .filter((match) => !applicationsByJobId.has(match.job_posting_id))
    .map((match) => {
      const job = jobsById.get(match.job_posting_id)
      if (!job) return null
      return { match, job }
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (!left || !right) return 0
      if (left.match.band !== right.match.band) {
        return left.match.band === 'strong' ? -1 : 1
      }
      return right.match.total_score - left.match.total_score
    }) as Array<{ match: JobMatch; job: JobPosting }>

  const tailorNow = activeApplications
    .filter((application) => !isPacketReady(application))
    .sort((left, right) => {
      if (left.status !== right.status) {
        if (left.status === 'tailoring') return -1
        if (right.status === 'tailoring') return 1
      }
      return new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime()
    })

  const applyNow = activeApplications
    .filter((application) => isPacketReady(application))
    .sort((left, right) => {
      if (left.status !== right.status) {
        if (left.status === 'ready_to_apply') return -1
        if (right.status === 'ready_to_apply') return 1
      }
      return new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime()
    })

  const todayStart = startOfToday()

  const followUpApplications = applications
    .filter((application) => {
      if (!application.follow_up_at) return false
      if (application.status === 'archived' || application.status === 'rejected') return false
      return new Date(application.follow_up_at).getTime() <= todayStart.getTime()
    })
    .sort((left, right) => new Date(left.follow_up_at ?? 0).getTime() - new Date(right.follow_up_at ?? 0).getTime())

  const dueContacts = (contacts ?? [])
    .filter((contact) => {
      if (!contact.next_follow_up_at) return false
      return new Date(contact.next_follow_up_at).getTime() <= todayStart.getTime()
    })
    .sort((left, right) => new Date(left.next_follow_up_at ?? 0).getTime() - new Date(right.next_follow_up_at ?? 0).getTime())

  const representedFollowUpKeys = new Set([
    ...followUpApplications.map((application) => `application:${application.id}`),
    ...dueContacts.map((contact) => `contact:${contact.id}`),
  ])

  const unreadFollowUpNotifications = (notifications ?? [])
    .filter((item) => !item.is_read && (item.type === 'follow_up_due' || item.type === 'contact_follow_up'))
    .filter((item) => !representedFollowUpKeys.has(buildFollowUpNotificationKey(item)))
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())

  const watchlistIssues = (watchlists ?? [])
    .filter((watchlist) => !watchlist.last_sync_at || Boolean(watchlist.last_error))
    .sort((left, right) => {
      if (Boolean(left.last_error) !== Boolean(right.last_error)) {
        return left.last_error ? -1 : 1
      }
      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    })

  const profileGaps = buildProfileGaps({
    projects,
    publishedProjects,
    resumeVariants,
    candidateProfile,
    candidateAnswers,
    watchlists,
    savedSearches,
  })

  const totalUrgentItems =
    reviewNow.length +
    tailorNow.length +
    applyNow.length +
    followUpApplications.length +
    dueContacts.length +
    unreadFollowUpNotifications.length +
    watchlistIssues.length +
    profileGaps.length

  const handleAddToApplications = async (jobId: string) => {
    setWorkingKey(`track-${jobId}`)
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

      if (!saved) return

      setApplications((current) => {
        const withoutExisting = (current ?? []).filter(
          (application) => application.job_posting_id !== saved.job_posting_id
        )
        return [saved, ...withoutExisting]
      })
    } finally {
      setWorkingKey(null)
    }
  }

  const handleMarkApplied = async (application: ApplicationRecord) => {
    setWorkingKey(`applied-${application.id}`)
    try {
      const updated = await updateApplication(application.id, {
        status: 'applied',
        applied_at: application.applied_at ?? new Date().toISOString().slice(0, 10),
        follow_up_at:
          application.follow_up_at ??
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      })
      if (!updated) return
      setApplications((current) =>
        (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry))
      )
    } finally {
      setWorkingKey(null)
    }
  }

  const handleMarkFollowUpDone = async (application: ApplicationRecord) => {
    setWorkingKey(`followup-${application.id}`)
    try {
      const updated = await updateApplication(application.id, {
        follow_up_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      })
      if (!updated) return
      setApplications((current) =>
        (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry))
      )
    } finally {
      setWorkingKey(null)
    }
  }

  const handleMarkContactFollowUpDone = async (contact: CareerContact) => {
    setWorkingKey(`contact-${contact.id}`)
    try {
      const updated = await updateCareerContact(contact.id, {
        next_follow_up_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      })
      if (!updated) return
      setContacts((current) =>
        (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry))
      )
    } finally {
      setWorkingKey(null)
    }
  }

  const handleMarkNotificationDone = async (item: NotificationItem) => {
    setWorkingKey(`notification-${item.id}`)
    try {
      const updated = await updateNotificationItem(item.id, { is_read: true })
      if (!updated) return
      setNotifications((current) =>
        (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry))
      )
    } finally {
      setWorkingKey(null)
    }
  }

  const handleDiscoverWatchlist = async (watchlistId: string) => {
    setWorkingKey(`discover-${watchlistId}`)
    try {
      await discoverWatchlist({ watchlistId })
      setWatchlists(await getCompanyWatchlists())
    } finally {
      setWorkingKey(null)
    }
  }

  const handleSyncWatchlist = async (watchlistId: string) => {
    setWorkingKey(`sync-${watchlistId}`)
    try {
      await runScheduledWatchlists(watchlistId)
      setWatchlists(await getCompanyWatchlists())
    } finally {
      setWorkingKey(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Today</h1>
          <p className="mt-1 text-muted-foreground">
            Due-now work only. Use this page to clear the next actions, then go back to Discover or Applications.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={getAdminPath('jobs')}>
            <Button className="gap-2">
              <Compass className="h-4 w-4" />
              Discover
            </Button>
          </Link>
          <Link to={getAdminPath('applications')}>
            <Button variant="outline">Applications</Button>
          </Link>
        </div>
      </div>

      {totalUrgentItems === 0 ? (
        <Card className="glass">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nothing is due right now. Start in Discover, then come back here when a job, packet, or follow-up needs action.
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="p-0">
            <SlimTodaySection
              title="Review now"
              count={reviewNow.length}
              description="Strong and review jobs that are not in Applications yet."
            >
              {reviewNow.slice(0, 6).map(({ match, job }) => (
                <SlimQueueRow
                  key={job.id}
                  title={job.title || 'Untitled role'}
                  subtitle={[job.company, job.location].filter(Boolean).join(' | ') || 'Saved role'}
                  badge={
                    <Badge className={match.band === 'strong'
                      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                      : 'border-amber-400/20 bg-amber-400/10 text-amber-100'}
                    >
                      {match.band === 'strong' ? `Strong ${Math.round(match.total_score)}` : `Review ${Math.round(match.total_score)}`}
                    </Badge>
                  }
                  body={match.reason_summary || 'Review the role and move it into Applications if it is worth pursuing.'}
                  primaryAction={
                    <Button
                      size="sm"
                      className="gap-2"
                      disabled={workingKey === `track-${job.id}`}
                      onClick={() => void handleAddToApplications(job.id)}
                    >
                      <BriefcaseBusiness className="h-4 w-4" />
                      {workingKey === `track-${job.id}` ? 'Adding...' : 'Add'}
                    </Button>
                  }
                  secondaryAction={
                    <Link to={`${getAdminPath('jobs')}?view=imported&job=${encodeURIComponent(job.id)}`}>
                      <Button size="sm" variant="outline" className="gap-2">
                        <Sparkles className="h-4 w-4" />
                        Open role
                      </Button>
                    </Link>
                  }
                />
              ))}
            </SlimTodaySection>

            <SlimTodaySection
              title="Tailor now"
              count={tailorNow.length}
              description="Tracked applications that still need packet work."
            >
              {tailorNow.slice(0, 6).map((application) => {
                const job = jobsById.get(application.job_posting_id)

                return (
                  <SlimQueueRow
                    key={application.id}
                    title={job?.title || 'Tracked application'}
                    subtitle={[job?.company, describePacketGaps(application)].filter(Boolean).join(' | ')}
                    body="Open the packet workspace and close the missing pieces before you apply."
                    primaryAction={
                      <Link
                        to={`${getAdminPath('applications')}?filter=needs_tailoring&application=${encodeURIComponent(application.id)}`}
                      >
                        <Button size="sm" className="gap-2">
                          <FileText className="h-4 w-4" />
                          Open packet
                        </Button>
                      </Link>
                    }
                    secondaryAction={
                      <Link to={`${getAdminPath('applications')}?filter=needs_tailoring&application=${encodeURIComponent(application.id)}`}>
                        <Button size="sm" variant="outline">
                          Open app
                        </Button>
                      </Link>
                    }
                  />
                )
              })}
            </SlimTodaySection>

            <SlimTodaySection
              title="Apply now"
              count={applyNow.length}
              description="Applications that look ready to submit."
            >
              {applyNow.slice(0, 6).map((application) => {
                const job = jobsById.get(application.job_posting_id)

                return (
                  <SlimQueueRow
                    key={application.id}
                    title={job?.title || 'Ready application'}
                    subtitle={[job?.company, application.status.replace(/_/g, ' ')].filter(Boolean).join(' | ')}
                    badge={<Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">Packet ready</Badge>}
                    body="Mark it applied after you submit. The core packet is already in place."
                    primaryAction={
                      <Button
                        size="sm"
                        className="gap-2"
                        disabled={workingKey === `applied-${application.id}`}
                        onClick={() => void handleMarkApplied(application)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {workingKey === `applied-${application.id}` ? 'Saving...' : 'Mark applied'}
                      </Button>
                    }
                    secondaryAction={
                      <Link
                        to={`${getAdminPath('applications')}?filter=ready_to_apply&application=${encodeURIComponent(application.id)}`}
                      >
                        <Button size="sm" variant="outline">
                          Open packet
                        </Button>
                      </Link>
                    }
                  />
                )
              })}
            </SlimTodaySection>

            <SlimTodaySection
              title="Follow up now"
              count={followUpApplications.length + dueContacts.length + unreadFollowUpNotifications.length}
              description="Overdue application follow-ups, people follow-ups, and unread reminders."
            >
              {followUpApplications.slice(0, 4).map((application) => {
                const job = jobsById.get(application.job_posting_id)

                return (
                  <SlimQueueRow
                    key={application.id}
                    title={job?.title || 'Application follow-up'}
                    subtitle={[job?.company, application.follow_up_at ? `Due ${application.follow_up_at}` : 'Follow-up due'].filter(Boolean).join(' | ')}
                    badge={<Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100">Follow up</Badge>}
                    body="Log the touchpoint, then move the next follow-up date forward."
                    primaryAction={
                      <Link to={`${getAdminPath('applications')}?filter=follow_up&application=${encodeURIComponent(application.id)}`}>
                        <Button size="sm" className="gap-2">
                          <NotebookPen className="h-4 w-4" />
                          Open app
                        </Button>
                      </Link>
                    }
                    secondaryAction={
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        disabled={workingKey === `followup-${application.id}`}
                        onClick={() => void handleMarkFollowUpDone(application)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {workingKey === `followup-${application.id}` ? 'Saving...' : 'Done'}
                      </Button>
                    }
                  />
                )
              })}

              {dueContacts.slice(0, 4).map((contact) => {
                const companyWatchlist = contact.company_watchlist_id
                  ? (watchlists ?? []).find((entry) => entry.id === contact.company_watchlist_id) ?? null
                  : null

                return (
                  <SlimQueueRow
                    key={contact.id}
                    title={contact.full_name || 'Contact follow-up'}
                    subtitle={[
                      contact.role_title,
                      companyWatchlist?.company_name || contact.organization_name,
                      contact.next_follow_up_at ? `Due ${contact.next_follow_up_at}` : 'Follow-up due',
                    ].filter(Boolean).join(' | ')}
                    badge={<Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100">People</Badge>}
                    body="Keep recruiter, referral, and alumni outreach in the same workflow as your applications."
                    primaryAction={
                      <Link to={`${getAdminPath('contacts')}?contact=${encodeURIComponent(contact.id)}`}>
                        <Button size="sm" className="gap-2">
                          <NotebookPen className="h-4 w-4" />
                          Open contact
                        </Button>
                      </Link>
                    }
                    secondaryAction={
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        disabled={workingKey === `contact-${contact.id}`}
                        onClick={() => void handleMarkContactFollowUpDone(contact)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {workingKey === `contact-${contact.id}` ? 'Saving...' : 'Done'}
                      </Button>
                    }
                  />
                )
              })}

              {unreadFollowUpNotifications.slice(0, 4).map((item) => (
                <SlimQueueRow
                  key={item.id}
                  title={item.title}
                  subtitle={item.due_at ? `Due ${item.due_at}` : 'Unread reminder'}
                  badge={<Badge variant="outline">Unread</Badge>}
                  body={item.body}
                  primaryAction={
                    <Link
                      to={
                        item.application_id
                          ? `${getAdminPath('applications')}?application=${encodeURIComponent(item.application_id)}`
                          : item.link_path || (item.contact_id ? getAdminPath('contacts') : getAdminPath('applications'))
                      }
                    >
                      <Button size="sm" className="gap-2">
                        <NotebookPen className="h-4 w-4" />
                        Open
                      </Button>
                    </Link>
                  }
                  secondaryAction={
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      disabled={workingKey === `notification-${item.id}`}
                      onClick={() => void handleMarkNotificationDone(item)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {workingKey === `notification-${item.id}` ? 'Saving...' : 'Done'}
                    </Button>
                  }
                />
              ))}
            </SlimTodaySection>

            <SlimTodaySection
              title="Fix now"
              count={watchlistIssues.length + profileGaps.length}
              description="Broken watchlists, never-synced watchlists, and profile gaps that weaken matching."
              isLast
            >
              {watchlistIssues.slice(0, 4).map((watchlist) => (
                <SlimQueueRow
                  key={watchlist.id}
                  title={watchlist.company_name}
                  subtitle={buildWatchlistIssueSummary(watchlist)}
                  badge={<Badge variant="outline">{watchlist.last_error ? 'Needs attention' : 'Never synced'}</Badge>}
                  body={watchlist.last_error || 'This target company still needs an initial discovery or sync pass.'}
                  primaryAction={
                    <Button
                      size="sm"
                      className="gap-2"
                      disabled={workingKey === `discover-${watchlist.id}`}
                      onClick={() => void handleDiscoverWatchlist(watchlist.id)}
                    >
                      <Compass className="h-4 w-4" />
                      {workingKey === `discover-${watchlist.id}` ? 'Discovering...' : 'Discover'}
                    </Button>
                  }
                  secondaryAction={
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      disabled={workingKey === `sync-${watchlist.id}`}
                      onClick={() => void handleSyncWatchlist(watchlist.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                      {workingKey === `sync-${watchlist.id}` ? 'Syncing...' : 'Sync'}
                    </Button>
                  }
                />
              ))}

              {profileGaps.map((gap) => (
                <SlimQueueRow
                  key={gap.id}
                  title={gap.title}
                  subtitle={gap.subtitle}
                  badge={<Badge variant="outline">Profile gap</Badge>}
                  body={gap.body}
                  primaryAction={
                    <Link to={gap.primaryHref}>
                      <Button size="sm" className="gap-2">
                        {gap.primaryIcon}
                        {gap.primaryLabel}
                      </Button>
                    </Link>
                  }
                  secondaryAction={
                    gap.secondaryHref ? (
                      <Link to={gap.secondaryHref}>
                        <Button size="sm" variant="outline" className="gap-2">
                          {gap.secondaryIcon}
                          {gap.secondaryLabel}
                        </Button>
                      </Link>
                    ) : null
                  }
                />
              ))}
            </SlimTodaySection>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SlimTodaySection({
  title,
  count,
  description,
  children,
  isLast = false,
}: {
  title: string
  count: number
  description: string
  children: ReactNode
  isLast?: boolean
}) {
  if (count === 0) return null

  return (
    <section className={!isLast ? 'border-b border-white/10 px-4 py-4 md:px-5' : 'px-4 py-4 md:px-5'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <Badge variant="outline">{count}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  )
}

function SlimQueueRow({
  title,
  subtitle,
  badge,
  body,
  primaryAction,
  secondaryAction,
}: {
  title: string
  subtitle: string
  badge?: ReactNode
  body: string
  primaryAction: ReactNode
  secondaryAction?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{title}</p>
            {badge}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      </div>
    </div>
  )
}

function isPacketReady(application: ApplicationRecord): boolean {
  return Boolean(application.resume_variant_id) && Boolean(application.cover_letter.trim())
}

function describePacketGaps(application: ApplicationRecord): string {
  const missing: string[] = []
  if (!application.resume_variant_id) missing.push('resume')
  if (!application.cover_letter.trim()) missing.push('cover letter')
  return missing.length > 0 ? `Missing ${missing.join(' + ')}` : 'Needs packet polish'
}

function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function buildFollowUpNotificationKey(item: NotificationItem): string {
  if (item.contact_id) return `contact:${item.contact_id}`
  if (item.application_id) return `application:${item.application_id}`
  return `notification:${item.id}`
}

function buildWatchlistIssueSummary(watchlist: CompanyWatchlist): string {
  const parts = [
    watchlist.preferred_query ? `Role focus: ${watchlist.preferred_query}` : null,
    watchlist.location_hint ? `Location: ${watchlist.location_hint}` : null,
    watchlist.last_sync_at ? `Last sync ${formatShortDateTime(watchlist.last_sync_at)}` : 'Never synced',
  ]
  return parts.filter(Boolean).join(' | ')
}

function formatShortDateTime(value: string): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function buildProfileGaps({
  projects,
  publishedProjects,
  resumeVariants,
  candidateProfile,
  candidateAnswers,
  watchlists,
  savedSearches,
}: {
  projects: Project[]
  publishedProjects: Project[]
  resumeVariants: ResumeVariant[]
  candidateProfile: CandidateProfile | null
  candidateAnswers: CandidateAnswer[] | null
  watchlists: CompanyWatchlist[] | null
  savedSearches: SavedJobSearch[] | null
}) {
  const gaps: Array<{
    id: string
    title: string
    subtitle: string
    body: string
    primaryLabel: string
    primaryHref: string
    primaryIcon: ReactNode
    secondaryLabel?: string
    secondaryHref?: string
    secondaryIcon?: ReactNode
  }> = []

  if (publishedProjects.length === 0) {
    gaps.push({
      id: 'published-projects',
      title: 'Publish proof of work',
      subtitle: 'No published projects are live yet.',
      body: 'Matching and recruiter confidence are both weaker when the portfolio has nothing public to point at.',
      primaryLabel: 'Add project',
      primaryHref: getAdminPath('projects/new'),
      primaryIcon: <FolderKanban className="h-4 w-4" />,
      secondaryLabel: 'Update resume',
      secondaryHref: getAdminPath('resume'),
      secondaryIcon: <FileText className="h-4 w-4" />,
    })
  }

  if (projects.length > 0 && projects.length < 3) {
    gaps.push({
      id: 'project-depth',
      title: 'Increase project depth',
      subtitle: `Only ${projects.length} project${projects.length === 1 ? '' : 's'} captured so far.`,
      body: 'A thin project corpus weakens both matching quality and the recruiter-facing proof layer.',
      primaryLabel: 'Add project',
      primaryHref: getAdminPath('projects/new'),
      primaryIcon: <FolderKanban className="h-4 w-4" />,
      secondaryLabel: 'Update resume',
      secondaryHref: getAdminPath('resume'),
      secondaryIcon: <FileText className="h-4 w-4" />,
    })
  }

  if (resumeVariants.length === 0) {
    gaps.push({
      id: 'resume-variant',
      title: 'Create a resume variant',
      subtitle: 'No resume variants exist yet.',
      body: 'Applications move faster when there is at least one primary resume ready to tailor from.',
      primaryLabel: 'Update resume',
      primaryHref: getAdminPath('resume'),
      primaryIcon: <FileText className="h-4 w-4" />,
      secondaryLabel: 'Add project',
      secondaryHref: getAdminPath('projects/new'),
      secondaryIcon: <FolderKanban className="h-4 w-4" />,
    })
  }

  if ((candidateProfile?.education ?? []).length === 0) {
    gaps.push({
      id: 'education',
      title: 'Add education details',
      subtitle: 'No education entries are visible yet.',
      body: 'Education is a credibility signal on the public site and inside tailored recruiter packets.',
      primaryLabel: 'Update settings',
      primaryHref: getAdminPath('settings'),
      primaryIcon: <FileText className="h-4 w-4" />,
      secondaryLabel: 'Update resume',
      secondaryHref: getAdminPath('resume'),
      secondaryIcon: <FileText className="h-4 w-4" />,
    })
  }

  if ((candidateAnswers ?? []).length === 0) {
    gaps.push({
      id: 'answer-bank',
      title: 'Seed the answer bank',
      subtitle: 'No reusable application answers are stored yet.',
      body: 'Work authorization, compensation, intro, and logistics answers should be ready before applications speed up.',
      primaryLabel: 'Open answer bank',
      primaryHref: getAdminPath('answers'),
      primaryIcon: <NotebookPen className="h-4 w-4" />,
      secondaryLabel: 'Update resume',
      secondaryHref: getAdminPath('resume'),
      secondaryIcon: <FileText className="h-4 w-4" />,
    })
  }

  if ((watchlists ?? []).length === 0) {
    gaps.push({
      id: 'watchlists',
      title: 'Seed target companies',
      subtitle: 'No watchlists exist yet.',
      body: 'Company-first discovery gets stronger once a few target employers are being monitored continuously.',
      primaryLabel: 'Discover',
      primaryHref: getAdminPath('jobs'),
      primaryIcon: <Compass className="h-4 w-4" />,
      secondaryLabel: 'Open watchlists',
      secondaryHref: getAdminPath('watchlists'),
      secondaryIcon: <Wrench className="h-4 w-4" />,
    })
  }

  if ((savedSearches ?? []).length === 0) {
    gaps.push({
      id: 'saved-searches',
      title: 'Save a repeatable search',
      subtitle: 'No saved search sources are configured yet.',
      body: 'Discovery becomes much less manual once at least one source or board search is saved for repeat runs.',
      primaryLabel: 'Discover',
      primaryHref: getAdminPath('jobs'),
      primaryIcon: <Compass className="h-4 w-4" />,
      secondaryLabel: 'Open watchlists',
      secondaryHref: getAdminPath('watchlists'),
      secondaryIcon: <Wrench className="h-4 w-4" />,
    })
  }

  return gaps
}
