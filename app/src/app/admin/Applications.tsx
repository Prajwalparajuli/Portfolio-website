import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  MessageSquare,
  NotebookPen,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { getAdminPath } from '@/lib/adminConfig'
import { buildCareerAnalytics } from '@/lib/careerAnalytics'
import {
  getSuggestedCandidateAnswers,
  seedDefaultCandidateAnswers,
} from '@/lib/candidateAnswerBank'
import {
  createApplicationShareLink,
  generateInterviewPrep,
  getApplicationShareLinks,
  revokeApplicationShareLink,
} from '@/lib/careerCockpit'
import { scoreJobFit } from '@/lib/jobMatching'
import { generateCoverLetter, tailorResumeToJob } from '@/lib/resumeAi'
import {
  createResumeVariant,
  createContactTouchpoint,
  deleteApplication,
  deleteContactTouchpoint,
  getAllProjects,
  getApplications,
  getCandidateAnswers,
  getCareerContacts,
  getCompanyWatchlists,
  getContactTouchpoints,
  getInterviewPrepNotes,
  getJobMatches,
  getJobPostings,
  getProofOfWorkHighlights,
  getResumeWorkspace,
  getSettings,
  getSkills,
  saveInterviewPrepNote,
  updateApplication,
  updateCareerContact,
} from '@/lib/supabase'
import {
  ApplicationRecord,
  ApplicationShareLink,
  ApplicationStatus,
  CandidateAnswer,
  CareerContact,
  CompanyWatchlist,
  ContactTouchpoint,
  InterviewPrepNote,
  JobMatch,
  JobPosting,
  ProofOfWorkHighlight,
  Project,
  Skill,
} from '@/types'
import {
  type ResumeContent,
  type ResumeExperienceSection,
  type ResumeSummarySection,
  ResumeVariant,
} from '@/types/resume'

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

type ApplicationFilter =
  | 'needs_tailoring'
  | 'ready_to_apply'
  | 'applied'
  | 'follow_up'
  | 'closed'

const APPLICATION_FILTER_OPTIONS: Array<{
  value: ApplicationFilter
  label: string
}> = [
  { value: 'needs_tailoring', label: 'Needs tailoring' },
  { value: 'ready_to_apply', label: 'Ready to apply' },
  { value: 'applied', label: 'Applied' },
  { value: 'follow_up', label: 'Follow up' },
  { value: 'closed', label: 'Closed' },
]

type TouchpointDraft = {
  contact_id: string
  contact_name: string
  contact_role: string
  channel: ContactTouchpoint['channel']
  touchpoint_kind: ContactTouchpoint['touchpoint_kind']
  direction: ContactTouchpoint['direction']
  subject: string
  note: string
  next_follow_up_at: string
}

const EMPTY_TOUCHPOINT_DRAFT: TouchpointDraft = {
  contact_id: '',
  contact_name: '',
  contact_role: '',
  channel: 'email',
  touchpoint_kind: 'note',
  direction: 'outbound',
  subject: '',
  note: '',
  next_follow_up_at: '',
}

export function AdminApplications() {
  const [applications, setApplications] = useState<ApplicationRecord[] | null>([])
  const [jobs, setJobs] = useState<JobPosting[] | null>([])
  const [jobMatches, setJobMatches] = useState<JobMatch[] | null>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [resumeVariants, setResumeVariants] = useState<ResumeVariant[]>([])
  const [candidateAnswers, setCandidateAnswers] = useState<CandidateAnswer[] | null>([])
  const [prepNotes, setPrepNotes] = useState<InterviewPrepNote[] | null>([])
  const [touchpoints, setTouchpoints] = useState<ContactTouchpoint[] | null>([])
  const [highlights, setHighlights] = useState<ProofOfWorkHighlight[] | null>([])
  const [contacts, setContacts] = useState<CareerContact[] | null>([])
  const [watchlists, setWatchlists] = useState<CompanyWatchlist[] | null>([])
  const [shareLinksByApplication, setShareLinksByApplication] = useState<Record<string, ApplicationShareLink[]>>({})
  const [activeFilter, setActiveFilter] = useState<ApplicationFilter>('needs_tailoring')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [generatingPacketId, setGeneratingPacketId] = useState<string | null>(null)
  const [generatingPrepId, setGeneratingPrepId] = useState<string | null>(null)
  const [savingPrepId, setSavingPrepId] = useState<string | null>(null)
  const [creatingShareId, setCreatingShareId] = useState<string | null>(null)
  const [revokingShareId, setRevokingShareId] = useState<string | null>(null)
  const [addingTouchpointId, setAddingTouchpointId] = useState<string | null>(null)
  const [deletingTouchpointId, setDeletingTouchpointId] = useState<string | null>(null)
  const [seedingAnswers, setSeedingAnswers] = useState(false)
  const [copiedValueId, setCopiedValueId] = useState<string | null>(null)
  const [coverLetterDrafts, setCoverLetterDrafts] = useState<Record<string, string>>({})
  const [prepNoteDrafts, setPrepNoteDrafts] = useState<Record<string, string>>({})
  const [touchpointDrafts, setTouchpointDrafts] = useState<Record<string, TouchpointDraft>>({})

  useEffect(() => {
    let mounted = true

    const load = async () => {
      const [
        applicationData,
        jobData,
        jobMatchData,
        skillsData,
        projectData,
        workspace,
        answerData,
        prepData,
        touchpointData,
        highlightData,
        contactData,
        watchlistData,
      ] = await Promise.all([
        getApplications(),
        getJobPostings(),
        getJobMatches(),
        getSkills(),
        getAllProjects(),
        getResumeWorkspace(),
        getCandidateAnswers(),
        getInterviewPrepNotes(),
        getContactTouchpoints(),
        getProofOfWorkHighlights(),
        getCareerContacts(),
        getCompanyWatchlists(),
      ])

      if (!mounted) return

      setApplications(applicationData)
      setCoverLetterDrafts(
        Object.fromEntries((applicationData ?? []).map((application) => [application.id, application.cover_letter]))
      )
      setJobs(jobData)
      setJobMatches(jobMatchData)
      setSkills(skillsData)
      setProjects(projectData)
      setResumeVariants(workspace.variants)
      setCandidateAnswers(answerData)
      setPrepNotes(prepData)
      setTouchpoints(touchpointData)
      setHighlights(highlightData)
      setContacts(contactData)
      setWatchlists(watchlistData)
      setPrepNoteDrafts(
        Object.fromEntries((prepData ?? []).map((note) => [note.application_id, note.notes]))
      )

      const cockpitSupported =
        answerData !== null && prepData !== null && touchpointData !== null && highlightData !== null

      if (!cockpitSupported || !applicationData || applicationData.length === 0) return

      const shareEntries = await Promise.all(
        applicationData.map(async (application) => {
          try {
            return [application.id, await getApplicationShareLinks(application.id)] as const
          } catch (error) {
            console.error('Error loading application share links:', error)
            return [application.id, []] as const
          }
        })
      )

      if (!mounted) return
      setShareLinksByApplication(Object.fromEntries(shareEntries))
    }

    void load()

    return () => {
      mounted = false
    }
  }, [])

  const schemaReady = applications !== null && jobs !== null
  const cockpitSupported =
    candidateAnswers !== null && prepNotes !== null && touchpoints !== null && highlights !== null
  const primaryVariant = useMemo(
    () => resumeVariants.find((variant) => variant.isPrimary) ?? resumeVariants[0] ?? null,
    [resumeVariants]
  )
  const jobMap = useMemo(
    () => new Map((jobs ?? []).map((job) => [job.id, job])),
    [jobs]
  )
  const contactMap = useMemo(
    () => new Map((contacts ?? []).map((contact) => [contact.id, contact])),
    [contacts]
  )
  const watchlistMap = useMemo(
    () => new Map((watchlists ?? []).map((watchlist) => [watchlist.id, watchlist])),
    [watchlists]
  )
  const jobMatchMap = useMemo(
    () => new Map((jobMatches ?? []).map((match) => [match.job_posting_id, match])),
    [jobMatches]
  )
  const resumeMap = useMemo(
    () => new Map(resumeVariants.map((variant) => [variant.id, variant])),
    [resumeVariants]
  )
  const prepMap = useMemo(
    () => new Map((prepNotes ?? []).map((note) => [note.application_id, note])),
    [prepNotes]
  )
  const touchpointsByApplicationId = useMemo(() => {
    const next = new Map<string, ContactTouchpoint[]>()
    for (const touchpoint of touchpoints ?? []) {
      if (!touchpoint.application_id) continue
      const existing = next.get(touchpoint.application_id) ?? []
      next.set(touchpoint.application_id, [...existing, touchpoint])
    }
    return next
  }, [touchpoints])
  const suggestedAnswers = useMemo(
    () => getSuggestedCandidateAnswers(candidateAnswers ?? []),
    [candidateAnswers]
  )
  const today = startOfToday()

  const applicationCounts = useMemo(() => {
    const source = applications ?? []
    return source.reduce<Record<ApplicationFilter, number>>(
      (counts, application) => {
        const bucket = getApplicationBucket(application, today)
        counts[bucket] += 1
        return counts
      },
      {
        needs_tailoring: 0,
        ready_to_apply: 0,
        applied: 0,
        follow_up: 0,
        closed: 0,
      }
    )
  }, [applications, today])

  const filteredApplications = useMemo(() => {
    const source = applications ?? []
    return [...source]
      .filter((application) => getApplicationBucket(application, today) === activeFilter)
      .sort((left, right) => compareApplicationsByBucket(activeFilter, left, right))
  }, [activeFilter, applications, today])

  const stats = useMemo(() => {
    return [
      { label: 'Needs tailoring', value: applicationCounts.needs_tailoring, tone: 'text-amber-100' },
      {
        label: 'Ready to apply',
        value: applicationCounts.ready_to_apply,
        tone: 'text-emerald-300',
      },
      {
        label: 'Applied',
        value: applicationCounts.applied,
        tone: 'text-blue-300',
      },
      {
        label: 'Follow up',
        value: applicationCounts.follow_up,
        tone: 'text-cyan-200',
      },
      { label: 'Closed', value: applicationCounts.closed, tone: 'text-muted-foreground' },
    ]
  }, [applicationCounts])

  const analytics = useMemo(
    () =>
      buildCareerAnalytics({
        jobs: jobs ?? [],
        applications: applications ?? [],
        savedSearches: [],
        syncRuns: [],
        watchlists: watchlists ?? [],
        highlights: highlights ?? [],
        window: '30d',
      }),
    [applications, highlights, jobs, watchlists]
  )

  const handlePatch = async (
    id: string,
    patch: Partial<Pick<ApplicationRecord, 'resume_variant_id' | 'status' | 'follow_up_at' | 'applied_at' | 'notes' | 'cover_letter'>>
  ) => {
    if (!schemaReady) return
    setSavingId(id)

    try {
      const updated = await updateApplication(id, patch)
      if (updated) {
        setCoverLetterDrafts((current) => ({
          ...current,
          [updated.id]: updated.cover_letter,
        }))
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

  const handleStatusChange = async (application: ApplicationRecord, nextStatus: ApplicationStatus) => {
    await handlePatch(application.id, {
      status: nextStatus,
      applied_at:
        nextStatus === 'applied'
          ? application.applied_at ?? new Date().toISOString().slice(0, 10)
          : application.applied_at,
      follow_up_at:
        nextStatus === 'applied'
          ? application.follow_up_at ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
          : application.follow_up_at,
    })
  }

  const handleSeedStarterAnswers = async () => {
    if (!cockpitSupported) return candidateAnswers ?? []

    setSeedingAnswers(true)
    try {
      const seeded = await seedDefaultCandidateAnswers()
      setCandidateAnswers(seeded)
      return seeded
    } catch (error) {
      console.error('Error seeding starter answers:', error)
      return candidateAnswers ?? []
    } finally {
      setSeedingAnswers(false)
    }
  }

  const handleGeneratePacket = async (
    application: ApplicationRecord,
    job: JobPosting | undefined,
    assignedVariant: ResumeVariant | null
  ) => {
    if (!job || !assignedVariant) return

    setGeneratingPacketId(application.id)
    try {
      if (cockpitSupported && (candidateAnswers?.length ?? 0) === 0) {
        await handleSeedStarterAnswers()
      }

      let packetVariant = application.resume_variant_id ? assignedVariant : null
      let resumeVariantId = application.resume_variant_id

      if (!packetVariant) {
        let nextContent = assignedVariant.content

        if (job.description.trim()) {
          try {
            nextContent = await tailorResumeContentToJob(
              assignedVariant.content,
              job.description,
              projects,
              skills
            )
          } catch (error) {
            console.error('Error tailoring resume content for packet generation:', error)
          }
        }

        const settings = await getSettings()
        const createdVariant = await createResumeVariant(
          {
            candidateProfileId: assignedVariant.candidateProfileId,
            name: buildPacketVariantName(job),
            variantType: 'tailored',
            isPrimary: false,
            sourceJobTitle: job.title,
            sourceJobCompany: job.company,
            sourceJobUrl: job.job_url,
            notes: `Generated from Applications for ${job.company || 'selected company'}.`,
            content: nextContent,
          },
          { settings }
        )

        if (createdVariant) {
          packetVariant = createdVariant
          resumeVariantId = createdVariant.id
          setResumeVariants((current) => [createdVariant, ...current.filter((variant) => variant.id !== createdVariant.id)])
        }
      }

      const nextCoverLetter = await generateCoverLetter(job, packetVariant ?? assignedVariant, skills)
      setCoverLetterDrafts((current) => ({
        ...current,
        [application.id]: nextCoverLetter,
      }))

      const nextStatus =
        application.status === 'saved' || application.status === 'tailoring'
          ? isCorePacketReady({
              resumeVariantId,
              coverLetter: nextCoverLetter,
            })
            ? 'ready_to_apply'
            : 'tailoring'
          : application.status

      await handlePatch(application.id, {
        resume_variant_id: resumeVariantId,
        cover_letter: nextCoverLetter,
        status: nextStatus,
      })
    } catch (error) {
      console.error('Error generating packet:', error)
    } finally {
      setGeneratingPacketId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!schemaReady) return
    setDeletingId(id)
    try {
      await deleteApplication(id)
      setApplications((current) => (current ?? []).filter((application) => application.id !== id))
      setShareLinksByApplication((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
    } catch (error) {
      console.error('Error deleting application:', error)
    } finally {
      setDeletingId(null)
    }
  }

  const handleGeneratePrep = async (applicationId: string) => {
    if (!cockpitSupported) return

    setGeneratingPrepId(applicationId)
    try {
      const generated = await generateInterviewPrep(applicationId)
      setPrepNotes((current) => {
        const next = (current ?? []).filter((entry) => entry.application_id !== generated.application_id)
        return [generated, ...next]
      })
      setPrepNoteDrafts((current) => ({
        ...current,
        [generated.application_id]: generated.notes,
      }))
    } catch (error) {
      console.error('Error generating interview prep:', error)
    } finally {
      setGeneratingPrepId(null)
    }
  }

  const handleSavePrepNotes = async (prep: InterviewPrepNote, notes: string) => {
    if (!cockpitSupported || notes === prep.notes) return

    setSavingPrepId(prep.application_id)
    try {
      const saved = await saveInterviewPrepNote({
        application_id: prep.application_id,
        generated_summary: prep.generated_summary,
        talking_points: prep.talking_points,
        technical_focus: prep.technical_focus,
        recruiter_questions: prep.recruiter_questions,
        tell_me_about_yourself: prep.tell_me_about_yourself,
        notes,
      })

      if (!saved) return
      setPrepNotes((current) => {
        const next = (current ?? []).filter((entry) => entry.application_id !== saved.application_id)
        return [saved, ...next]
      })
    } catch (error) {
      console.error('Error saving interview prep notes:', error)
    } finally {
      setSavingPrepId(null)
    }
  }

  const handleCreateShareLink = async (
    application: ApplicationRecord,
    job: JobPosting | undefined,
    assignedVariant: ResumeVariant | null
  ) => {
    if (!cockpitSupported) return

    const defaultTitle = [job?.title, job?.company].filter(Boolean).join(' at ') || 'Recruiter packet'
    const title = window.prompt('Title this recruiter packet', defaultTitle)?.trim()
    if (!title) return

    setCreatingShareId(application.id)
    try {
      const created = await createApplicationShareLink({
        applicationId: application.id,
        resumeVariantId: assignedVariant?.id ?? null,
        title,
      })

      setShareLinksByApplication((current) => ({
        ...current,
        [application.id]: [created, ...(current[application.id] ?? [])],
      }))

      if (created.share_url) {
        await copyText(created.share_url, created.id, setCopiedValueId)
      }
    } catch (error) {
      console.error('Error creating recruiter packet link:', error)
    } finally {
      setCreatingShareId(null)
    }
  }

  const handleRevokeShareLink = async (applicationId: string, shareLink: ApplicationShareLink) => {
    if (!cockpitSupported) return

    setRevokingShareId(shareLink.id)
    try {
      const revoked = await revokeApplicationShareLink(shareLink.id)
      setShareLinksByApplication((current) => ({
        ...current,
        [applicationId]: (current[applicationId] ?? []).map((entry) =>
          entry.id === revoked.id ? { ...entry, revoked_at: revoked.revoked_at } : entry
        ),
      }))
    } catch (error) {
      console.error('Error revoking recruiter packet link:', error)
    } finally {
      setRevokingShareId(null)
    }
  }

  const handleAddTouchpoint = async (
    application: ApplicationRecord,
    job: JobPosting | undefined,
    draft: TouchpointDraft
  ) => {
    if (!cockpitSupported || !draft.note.trim()) return

    setAddingTouchpointId(application.id)
    try {
      const linkedContact = draft.contact_id ? contactMap.get(draft.contact_id) ?? null : null
      const companyWatchlistId = job?.watchlist_id ?? linkedContact?.company_watchlist_id ?? null
      const companyWatchlist = companyWatchlistId ? watchlistMap.get(companyWatchlistId) ?? null : null
      const occurredAt = new Date().toISOString()
      const created = await createContactTouchpoint({
        application_id: application.id,
        contact_id: linkedContact?.id ?? null,
        company_watchlist_id: companyWatchlistId,
        company: job?.company ?? companyWatchlist?.company_name ?? linkedContact?.organization_name ?? '',
        contact_name: linkedContact?.full_name ?? draft.contact_name.trim(),
        contact_role: linkedContact?.role_title ?? draft.contact_role.trim(),
        channel: draft.channel,
        touchpoint_kind: draft.touchpoint_kind,
        direction: draft.direction,
        subject: draft.subject.trim(),
        note: draft.note.trim(),
        occurred_at: occurredAt,
        next_follow_up_at: draft.next_follow_up_at || null,
      })

      if (!created) return
      setTouchpoints((current) => [created, ...(current ?? [])])

      if (linkedContact) {
        const updatedContact = await updateCareerContact(linkedContact.id, {
          last_contact_at: occurredAt,
          next_follow_up_at: draft.next_follow_up_at || linkedContact.next_follow_up_at,
          role_title: linkedContact.role_title || draft.contact_role.trim(),
          organization_name:
            linkedContact.organization_name ||
            companyWatchlist?.company_name ||
            job?.company ||
            linkedContact.organization_name,
        })

        if (updatedContact) {
          setContacts((current) =>
            (current ?? []).map((entry) => (entry.id === updatedContact.id ? updatedContact : entry))
          )
        }
      }

      setTouchpointDrafts((current) => ({
        ...current,
        [application.id]: EMPTY_TOUCHPOINT_DRAFT,
      }))
    } catch (error) {
      console.error('Error creating touchpoint:', error)
    } finally {
      setAddingTouchpointId(null)
    }
  }

  const handleDeleteTouchpoint = async (touchpointId: string) => {
    if (!cockpitSupported) return

    setDeletingTouchpointId(touchpointId)
    try {
      await deleteContactTouchpoint(touchpointId)
      setTouchpoints((current) => (current ?? []).filter((entry) => entry.id !== touchpointId))
    } catch (error) {
      console.error('Error deleting touchpoint:', error)
    } finally {
      setDeletingTouchpointId(null)
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
            Generate the packet, move the application forward, and keep follow-up decisions visible instead of scattered across panels.
          </p>
        </div>
        <Link to={getAdminPath('jobs')}>
          <Button variant="outline" className="gap-2">
            Back to Jobs
            <RefreshCw className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {!cockpitSupported && (
        <Card className="glass border border-amber-400/20">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Run <code className="rounded bg-black/30 px-1 py-0.5">007_career_cockpit_phase2.sql</code> to enable answer bank, interview prep, recruiter packet links, CRM touchpoints, and proof-of-work highlights here.
          </CardContent>
        </Card>
      )}

      {cockpitSupported && (candidateAnswers ?? []).length === 0 && (
        <Card className="glass border border-emerald-400/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Starter answer pack missing</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Seed the answer bank once so work authorization, compensation, intro, and fit answers are ready when you generate packets.
              </p>
            </div>
            <Button
              type="button"
              className="gap-2"
              disabled={seedingAnswers}
              onClick={() => void handleSeedStarterAnswers()}
            >
              {seedingAnswers ? 'Seeding...' : 'Seed starter answers'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label} className="glass">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</p>
              <p className={`mt-2 text-2xl font-semibold ${stat.tone}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass">
        <CardContent className="space-y-4 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Conversion snapshot</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Packet completeness is now visible against actual interview conversion so you can stop guessing whether more polish is worth the time.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {analytics.packetRows.map((row) => (
              <div key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-medium text-foreground">{row.label}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{row.applications}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {row.applied} applied • {row.interviews} interviews • {Math.round(row.interview_rate * 100)}% interview rate
                </p>
              </div>
            ))}
          </div>
          {analytics.insights
            .filter((insight) => insight.surface === 'applications')
            .slice(0, 1)
            .map((insight) => (
              <div key={insight.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-medium text-foreground">{insight.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{insight.body}</p>
              </div>
            ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={activeFilter} onValueChange={(value) => setActiveFilter(value as ApplicationFilter)}>
          <TabsList className="bg-black/30">
            {APPLICATION_FILTER_OPTIONS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">Generate packet first, then move the application between lanes.</p>
      </div>

      <div className="space-y-3">
        {filteredApplications.map((application) => {
          const job = jobMap.get(application.job_posting_id)
          const assignedVariant = application.resume_variant_id
            ? resumeMap.get(application.resume_variant_id) ?? primaryVariant
            : primaryVariant
          const effectiveCoverLetter = coverLetterDrafts[application.id] ?? application.cover_letter
          const heuristicFit = job
            ? scoreJobFit({
                job,
                skills,
                projects,
                resumeVariant: assignedVariant,
              })
            : null
          const persistedMatch = job ? jobMatchMap.get(job.id) : undefined
          const prep = prepMap.get(application.id)
          const prepNotesValue = prepNoteDrafts[application.id] ?? prep?.notes ?? ''
          const applicationTouchpoints = touchpointsByApplicationId.get(application.id) ?? []
          const companyWatchlist = job?.watchlist_id ? watchlistMap.get(job.watchlist_id) ?? null : null
          const contactOptions = (contacts ?? [])
            .filter((contact) => {
              if (companyWatchlist && contact.company_watchlist_id === companyWatchlist.id) return true
              if (job?.company && contact.organization_name.trim().toLowerCase() === job.company.trim().toLowerCase()) {
                return true
              }
              return false
            })
            .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
          const applicationHighlights = (highlights ?? [])
            .filter((highlight) =>
              highlight.application_id === application.id || highlight.job_posting_id === application.job_posting_id
            )
            .sort((a, b) => a.display_order - b.display_order)
          const shareLinks = shareLinksByApplication[application.id] ?? []
          const activeShareLinks = shareLinks.filter((link) => !link.revoked_at && !isExpired(link.expires_at))
          const touchpointDraft = touchpointDrafts[application.id] ?? EMPTY_TOUCHPOINT_DRAFT
          const corePacketReady = isCorePacketReady({
            resumeVariantId: application.resume_variant_id,
            coverLetter: effectiveCoverLetter,
          })
          const polishedPacketReady = isPolishedPacketReady({
            resumeVariantId: application.resume_variant_id,
            coverLetter: effectiveCoverLetter,
            highlightCount: applicationHighlights.length,
            followUpAt: application.follow_up_at,
          })
          const followUpPrompt = buildFollowUpPrompt(application)
          const checklist = buildPacketChecklist({
            application,
            assignedVariant,
            coverLetter: effectiveCoverLetter,
            candidateAnswers: candidateAnswers ?? [],
            prep,
            highlightCount: applicationHighlights.length,
            touchpointCount: applicationTouchpoints.length,
            activeShareLinkCount: activeShareLinks.length,
          })

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
                      {application.resume_variant_id && (
                        <Badge variant="outline" className="border-emerald-400/20 text-emerald-200">
                          Resume attached
                        </Badge>
                      )}
                      {effectiveCoverLetter.trim() && (
                        <Badge variant="outline" className="border-blue-400/20 text-blue-200">
                          Cover letter ready
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          polishedPacketReady
                            ? 'border-emerald-400/20 text-emerald-200'
                            : corePacketReady
                              ? 'border-blue-400/20 text-blue-200'
                              : 'border-amber-400/20 text-amber-100'
                        }
                      >
                        {polishedPacketReady ? 'Polished packet' : corePacketReady ? 'Core packet ready' : 'Needs tailoring'}
                      </Badge>
                      {persistedMatch ? (
                        <Badge variant="outline" className="border-amber-400/20 text-amber-100">
                          Fit {Math.round(persistedMatch.total_score)}
                        </Badge>
                      ) : heuristicFit ? (
                        <Badge variant="outline" className="border-white/10">
                          Fit {heuristicFit.score}
                        </Badge>
                      ) : null}
                      {prep && (
                        <Badge variant="outline" className="border-violet-400/20 text-violet-200">
                          Interview prep
                        </Badge>
                      )}
                      {activeShareLinks.length > 0 && (
                        <Badge variant="outline" className="border-cyan-400/20 text-cyan-200">
                          Recruiter packet live
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[job?.company, job?.location].filter(Boolean).join(' • ') || 'Job removed or archived'}
                    </p>
                    {(companyWatchlist || contactOptions.length > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {companyWatchlist && (
                          <Link
                            to={`${getAdminPath('watchlists')}?company=${encodeURIComponent(companyWatchlist.id)}`}
                            className="hover:text-foreground"
                          >
                            Open company dossier
                          </Link>
                        )}
                        {contactOptions.length > 0 && (
                          <Link
                            to={`${getAdminPath('contacts')}${contactOptions[0]?.id ? `?contact=${encodeURIComponent(contactOptions[0].id)}` : ''}`}
                            className="hover:text-foreground"
                          >
                            Open linked contact
                          </Link>
                        )}
                      </div>
                    )}
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

                {(persistedMatch?.reason_summary || heuristicFit?.summary) && (
                  <p className="text-sm text-muted-foreground">
                    {persistedMatch?.reason_summary ?? heuristicFit?.summary}
                  </p>
                )}

                <div className="grid gap-3 xl:grid-cols-[180px_220px_160px_160px]">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</label>
                    <select
                      value={application.status}
                      onChange={(event) =>
                        void handleStatusChange(application, event.target.value as ApplicationStatus)
                      }
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
                    <Button
                      type="button"
                      className="w-full justify-start gap-2"
                      disabled={!job || !assignedVariant || generatingPacketId === application.id}
                      onClick={() => void handleGeneratePacket(application, job, assignedVariant)}
                    >
                      <Sparkles className="h-4 w-4" />
                      {generatingPacketId === application.id ? 'Generating packet...' : 'Generate packet'}
                    </Button>
                    <Link
                      to={`${getAdminPath('resume')}?job=${encodeURIComponent(application.job_posting_id)}&application=${encodeURIComponent(application.id)}&tab=tailor`}
                      onClick={() => {
                        if (application.status === 'saved') {
                          void handlePatch(application.id, { status: 'tailoring' })
                        }
                      }}
                    >
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <FileText className="h-4 w-4" />
                        Open packet workspace
                      </Button>
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() =>
                        handlePatch(application.id, {
                          follow_up_at: followUpPrompt.suggestedDate,
                        })
                      }
                    >
                      <CalendarClock className="h-4 w-4" />
                      {followUpPrompt.label}
                    </Button>
                    <p className="max-w-[220px] text-[11px] leading-5 text-muted-foreground">
                      {followUpPrompt.description}
                    </p>
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

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Packet workspace</p>
                      <p className="text-xs text-muted-foreground">
                        Packet readiness, matched proof, reusable answers, and the follow-up plan for this application.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {persistedMatch?.best_evidence_label && (
                        <Badge variant="outline" className="border-amber-400/20 text-amber-100">
                          Lead with: {persistedMatch.best_evidence_label}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Packet state</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {polishedPacketReady
                            ? 'Core packet is ready, supporting proof is attached, and follow-up is planned.'
                            : corePacketReady
                              ? 'Resume and cover letter are ready. Add proof highlights and confirm the follow-up plan to polish it.'
                              : 'Generate the packet or fill the missing core pieces below before you try to apply.'}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          polishedPacketReady
                            ? 'border-emerald-400/20 text-emerald-200'
                            : corePacketReady
                              ? 'border-blue-400/20 text-blue-200'
                              : 'border-amber-400/20 text-amber-100'
                        }
                      >
                        {polishedPacketReady ? 'Polished packet' : corePacketReady ? 'Core packet ready' : 'Needs tailoring'}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {checklist.map((item) => (
                      <div key={`${application.id}-${item.label}`} className="rounded-lg border border-white/10 bg-black/30 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          <Badge
                            variant="outline"
                            className={item.ready ? 'border-emerald-400/20 text-emerald-200' : 'border-amber-400/20 text-amber-100'}
                          >
                            {item.ready ? 'Ready' : 'Needs work'}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                    ))}
                  </div>

                  {persistedMatch && persistedMatch.missing_signals.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Missing signals</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {persistedMatch.missing_signals.slice(0, 5).map((signal) => (
                          <Badge key={`${application.id}-${signal}`} variant="outline" className="border-rose-400/20 text-rose-200">
                            {signal}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">Answer bank suggestions</p>
                        <Link to={getAdminPath('answers')}>
                          <Button variant="outline" size="sm">Manage</Button>
                        </Link>
                      </div>
                      <div className="mt-3 space-y-2">
                        {suggestedAnswers.map((answer) => (
                          <div key={answer.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-foreground">{answer.label}</p>
                                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{answer.category}</p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="gap-2"
                                onClick={() => void copyText(answer.answer, answer.id, setCopiedValueId)}
                              >
                                <Copy className="h-4 w-4" />
                                {copiedValueId === answer.id ? 'Copied' : 'Copy'}
                              </Button>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{truncateText(answer.answer, 180)}</p>
                          </div>
                        ))}
                        {(candidateAnswers ?? []).length === 0 && (
                          <div className="rounded-lg border border-emerald-400/20 bg-black/20 p-3">
                            <p className="text-sm text-muted-foreground">
                              Seed work authorization, compensation, intro, and fit answers once, then reuse them across packets.
                            </p>
                            <Button
                              type="button"
                              className="mt-3 gap-2"
                              disabled={seedingAnswers}
                              onClick={() => void handleSeedStarterAnswers()}
                            >
                              {seedingAnswers ? 'Seeding...' : 'Seed starter answers'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <p className="text-sm font-medium text-foreground">Proof of work highlights</p>
                      <div className="mt-3 space-y-2">
                        {applicationHighlights.slice(0, 4).map((highlight) => (
                          <div key={highlight.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-foreground">{highlight.title}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{highlight.summary}</p>
                                <p className="mt-2 text-xs text-accent">{highlight.relevance_reason}</p>
                              </div>
                              {highlight.url && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(highlight.url, '_blank', 'noopener,noreferrer')}
                                >
                                  Open
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        {applicationHighlights.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            Run semantic matching from Jobs to generate role-specific proof highlights.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {cockpitSupported && (
                  <div className="grid gap-4 xl:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4 xl:col-span-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Interview prep</p>
                          <p className="text-xs text-muted-foreground">
                            Generate role-specific themes, recruiter questions, and a tailored intro.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          disabled={generatingPrepId === application.id}
                          onClick={() => void handleGeneratePrep(application.id)}
                        >
                          <NotebookPen className="h-4 w-4" />
                          {generatingPrepId === application.id ? 'Generating prep...' : prep ? 'Refresh prep' : 'Generate prep'}
                        </Button>
                      </div>

                      {prep ? (
                        <div className="mt-4 space-y-4">
                          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                            <p className="text-sm text-muted-foreground">{prep.generated_summary}</p>
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            <PrepColumn title="Talking points" items={prep.talking_points} />
                            <PrepColumn title="Technical focus" items={prep.technical_focus} />
                            <PrepColumn title="Recruiter questions" items={prep.recruiter_questions} />
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                              <p className="text-sm font-medium text-foreground">Tell me about yourself</p>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                                {prep.tell_me_about_yourself}
                              </p>
                            </div>

                            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-foreground">Editable notes</p>
                                {savingPrepId === application.id && (
                                  <span className="text-xs text-muted-foreground">Saving...</span>
                                )}
                              </div>
                              <Textarea
                                value={prepNotesValue}
                                onChange={(event) =>
                                  setPrepNoteDrafts((current) => ({
                                    ...current,
                                    [application.id]: event.target.value,
                                  }))
                                }
                                onBlur={(event) => void handleSavePrepNotes(prep, event.target.value)}
                                placeholder="Add stories, objections, or custom reminders before interviews."
                                className="mt-3 min-h-[150px] border-white/10 bg-black/40"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-muted-foreground">
                          No prep generated yet. Create it once this role is worth preparing for.
                        </p>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">Recruiter packet links</p>
                            <p className="text-xs text-muted-foreground">
                              Secret expiring links for tailored resume packets.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={creatingShareId === application.id || !corePacketReady}
                            onClick={() => void handleCreateShareLink(application, job, assignedVariant)}
                          >
                            <Link2 className="h-4 w-4" />
                            New
                          </Button>
                        </div>
                        <div className="mt-3 space-y-2">
                          {shareLinks.map((shareLink) => (
                            <div key={shareLink.id} className="rounded-lg border border-white/10 bg-black/30 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-foreground">{shareLink.title}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Expires {new Date(shareLink.expires_at).toLocaleString()}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {shareLink.access_count} access{shareLink.access_count === 1 ? '' : 'es'}
                                  </p>
                                </div>
                                <div className="flex flex-col gap-2">
                                  {shareLink.share_url ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="gap-2"
                                      onClick={() => void copyText(shareLink.share_url!, shareLink.id, setCopiedValueId)}
                                    >
                                      <Copy className="h-4 w-4" />
                                      {copiedValueId === shareLink.id ? 'Copied' : 'Copy'}
                                    </Button>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground">Copy on creation only</span>
                                  )}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="gap-2 text-muted-foreground"
                                    disabled={Boolean(shareLink.revoked_at) || revokingShareId === shareLink.id}
                                    onClick={() => void handleRevokeShareLink(application.id, shareLink)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    {revokingShareId === shareLink.id ? 'Revoking...' : 'Revoke'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {shareLinks.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              {corePacketReady
                                ? 'Create a recruiter packet link once you are comfortable sharing this packet externally.'
                                : 'Generate the packet first so the share link points to a tailored resume and cover letter.'}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <p className="text-sm font-medium text-foreground">CRM touchpoints</p>
                        <div className="mt-3 space-y-2">
                          {applicationTouchpoints.map((touchpoint) => (
                            <div key={touchpoint.id} className="rounded-lg border border-white/10 bg-black/30 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-foreground">
                                      {touchpoint.contact_name || 'Untitled contact'}
                                    </p>
                                    <Badge variant="outline">{touchpoint.touchpoint_kind.replace(/_/g, ' ')}</Badge>
                                    <Badge variant="outline">{touchpoint.direction}</Badge>
                                    <Badge variant="outline">{touchpoint.channel}</Badge>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {[touchpoint.contact_role, new Date(touchpoint.occurred_at).toLocaleString()].filter(Boolean).join(' • ')}
                                  </p>
                                  {touchpoint.subject && (
                                    <p className="mt-2 text-sm font-medium text-foreground">{touchpoint.subject}</p>
                                  )}
                                  <p className="mt-2 text-sm text-muted-foreground">{touchpoint.note}</p>
                                  {(touchpoint.contact_id || touchpoint.company_watchlist_id || touchpoint.next_follow_up_at) && (
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                      {touchpoint.contact_id && (
                                        <Link
                                          to={`${getAdminPath('contacts')}?contact=${encodeURIComponent(touchpoint.contact_id)}`}
                                          className="hover:text-foreground"
                                        >
                                          Open contact
                                        </Link>
                                      )}
                                      {touchpoint.company_watchlist_id && (
                                        <Link
                                          to={`${getAdminPath('watchlists')}?company=${encodeURIComponent(touchpoint.company_watchlist_id)}`}
                                          className="hover:text-foreground"
                                        >
                                          Open company
                                        </Link>
                                      )}
                                      {touchpoint.next_follow_up_at && (
                                        <span>Next follow-up {touchpoint.next_follow_up_at}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="gap-2 text-muted-foreground"
                                  disabled={deletingTouchpointId === touchpoint.id}
                                  onClick={() => void handleDeleteTouchpoint(touchpoint.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}

                          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                            {contactOptions.length > 0 && (
                              <select
                                value={touchpointDraft.contact_id}
                                onChange={(event) => {
                                  const nextContactId = event.target.value
                                  const nextContact = nextContactId ? contactMap.get(nextContactId) ?? null : null
                                  setTouchpointDrafts((current) => ({
                                    ...current,
                                    [application.id]: {
                                      ...touchpointDraft,
                                      contact_id: nextContactId,
                                      contact_name: nextContact?.full_name ?? '',
                                      contact_role: nextContact?.role_title ?? '',
                                    },
                                  }))
                                }}
                                className="flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                              >
                                <option value="">Choose linked contact (optional)</option>
                                {contactOptions.map((contact) => (
                                  <option key={contact.id} value={contact.id}>
                                    {contact.full_name}
                                    {contact.role_title ? ` - ${contact.role_title}` : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Input
                                value={touchpointDraft.contact_name}
                                onChange={(event) =>
                                  setTouchpointDrafts((current) => ({
                                    ...current,
                                    [application.id]: {
                                      ...touchpointDraft,
                                      contact_id: '',
                                      contact_name: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="Recruiter or referral"
                                className="border-white/10 bg-black/40"
                              />
                              <Input
                                value={touchpointDraft.contact_role}
                                onChange={(event) =>
                                  setTouchpointDrafts((current) => ({
                                    ...current,
                                    [application.id]: {
                                      ...touchpointDraft,
                                      contact_role: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="Role or context"
                                className="border-white/10 bg-black/40"
                              />
                            </div>
                            <select
                              value={touchpointDraft.channel}
                              onChange={(event) =>
                                setTouchpointDrafts((current) => ({
                                  ...current,
                                  [application.id]: {
                                    ...touchpointDraft,
                                    channel: event.target.value as TouchpointDraft['channel'],
                                  },
                                }))
                              }
                              className="mt-3 flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                            >
                              <option value="email">Email</option>
                              <option value="linkedin">LinkedIn</option>
                              <option value="phone">Phone</option>
                              <option value="referral">Referral</option>
                              <option value="other">Other</option>
                            </select>
                            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                              <select
                                value={touchpointDraft.touchpoint_kind}
                                onChange={(event) =>
                                  setTouchpointDrafts((current) => ({
                                    ...current,
                                    [application.id]: {
                                      ...touchpointDraft,
                                      touchpoint_kind: event.target.value as TouchpointDraft['touchpoint_kind'],
                                    },
                                  }))
                                }
                                className="flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                              >
                                <option value="note">Note</option>
                                <option value="outreach">Outreach</option>
                                <option value="reply">Reply</option>
                                <option value="meeting">Meeting</option>
                                <option value="informational_interview">Informational interview</option>
                                <option value="referral">Referral</option>
                                <option value="recruiter_screen">Recruiter screen</option>
                                <option value="thank_you">Thank you</option>
                              </select>
                              <select
                                value={touchpointDraft.direction}
                                onChange={(event) =>
                                  setTouchpointDrafts((current) => ({
                                    ...current,
                                    [application.id]: {
                                      ...touchpointDraft,
                                      direction: event.target.value as TouchpointDraft['direction'],
                                    },
                                  }))
                                }
                                className="flex h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                              >
                                <option value="outbound">Outbound</option>
                                <option value="inbound">Inbound</option>
                              </select>
                              <Input
                                type="date"
                                value={touchpointDraft.next_follow_up_at}
                                onChange={(event) =>
                                  setTouchpointDrafts((current) => ({
                                    ...current,
                                    [application.id]: {
                                      ...touchpointDraft,
                                      next_follow_up_at: event.target.value,
                                    },
                                  }))
                                }
                                className="border-white/10 bg-black/40"
                              />
                            </div>
                            <Input
                              value={touchpointDraft.subject}
                              onChange={(event) =>
                                setTouchpointDrafts((current) => ({
                                  ...current,
                                  [application.id]: {
                                    ...touchpointDraft,
                                    subject: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Subject or checkpoint"
                              className="mt-3 border-white/10 bg-black/40"
                            />
                            <Textarea
                              value={touchpointDraft.note}
                              onChange={(event) =>
                                setTouchpointDrafts((current) => ({
                                  ...current,
                                  [application.id]: {
                                    ...touchpointDraft,
                                    note: event.target.value,
                                  },
                                }))
                              }
                              placeholder="What happened, what was promised, and what needs follow-up?"
                              className="mt-3 min-h-[100px] border-white/10 bg-black/40"
                            />
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                className="gap-2"
                                disabled={addingTouchpointId === application.id}
                                onClick={() => void handleAddTouchpoint(application, job, touchpointDraft)}
                              >
                                <MessageSquare className="h-4 w-4" />
                                {addingTouchpointId === application.id ? 'Saving...' : 'Add touchpoint'}
                              </Button>
                              {companyWatchlist && (
                                <Link to={`${getAdminPath('contacts')}?company=${encodeURIComponent(companyWatchlist.id)}`}>
                                  <Button type="button" variant="outline" className="gap-2">
                                    <NotebookPen className="h-4 w-4" />
                                    Open contacts
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Cover letter
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      {assignedVariant ? `Using ${assignedVariant.name}` : 'Assign a resume variant for best results'}
                    </span>
                  </div>
                  <Textarea
                    value={effectiveCoverLetter}
                    onChange={(event) =>
                      setCoverLetterDrafts((current) => ({
                        ...current,
                        [application.id]: event.target.value,
                      }))
                    }
                    onBlur={(event) => {
                      const nextCoverLetter = event.target.value
                      if (nextCoverLetter !== application.cover_letter) {
                        void handlePatch(application.id, { cover_letter: nextCoverLetter })
                      }
                    }}
                    placeholder="Optional cover letter for this application. Draft one with AI, then edit it before sending."
                    className="min-h-[180px] bg-black/40 border-white/10"
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}

        {filteredApplications.length === 0 && (
          <Card className="glass">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {emptyLaneMessage(activeFilter)}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function getApplicationBucket(
  application: ApplicationRecord,
  today: Date
): ApplicationFilter {
  if (application.status === 'rejected' || application.status === 'archived') {
    return 'closed'
  }

  if (
    (application.status === 'applied' || application.status === 'interview' || application.status === 'offer') &&
    application.follow_up_at &&
    new Date(application.follow_up_at).getTime() <= today.getTime()
  ) {
    return 'follow_up'
  }

  if (application.status === 'applied' || application.status === 'interview' || application.status === 'offer') {
    return 'applied'
  }

  if (
    application.status === 'saved' ||
    application.status === 'tailoring' ||
    !isCorePacketReady({
      resumeVariantId: application.resume_variant_id,
      coverLetter: application.cover_letter,
    })
  ) {
    return 'needs_tailoring'
  }

  return 'ready_to_apply'
}

function compareApplicationsByBucket(
  bucket: ApplicationFilter,
  left: ApplicationRecord,
  right: ApplicationRecord
): number {
  if (bucket === 'follow_up') {
    return new Date(left.follow_up_at ?? 0).getTime() - new Date(right.follow_up_at ?? 0).getTime()
  }

  if (bucket === 'applied') {
    return new Date(right.applied_at ?? 0).getTime() - new Date(left.applied_at ?? 0).getTime()
  }

  if (bucket === 'closed') {
    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  }

  return new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime()
}

function isCorePacketReady({
  resumeVariantId,
  coverLetter,
}: {
  resumeVariantId: string | null
  coverLetter: string
}): boolean {
  return Boolean(resumeVariantId) && Boolean(coverLetter.trim())
}

function isPolishedPacketReady({
  resumeVariantId,
  coverLetter,
  highlightCount,
  followUpAt,
}: {
  resumeVariantId: string | null
  coverLetter: string
  highlightCount: number
  followUpAt: string | null
}): boolean {
  return isCorePacketReady({ resumeVariantId, coverLetter }) && highlightCount > 0 && Boolean(followUpAt)
}

function buildFollowUpPrompt(application: ApplicationRecord): {
  label: string
  description: string
  suggestedDate: string
} {
  if (application.status === 'interview') {
    return {
      label: 'Set 48-hour thank-you follow-up',
      description: 'Interview-stage roles should usually have a quick thank-you or check-in deadline, not a vague later reminder.',
      suggestedDate: addDaysFromToday(2),
    }
  }

  if (application.status === 'offer') {
    return {
      label: 'Set offer decision follow-up',
      description: 'Offers should have a clear response or clarification checkpoint on the calendar.',
      suggestedDate: addDaysFromToday(3),
    }
  }

  if (application.status === 'applied') {
    return {
      label: 'Set 1-week follow-up',
      description: 'Applied roles should usually have a concrete follow-up date instead of relying on memory.',
      suggestedDate: addDaysFromToday(7),
    }
  }

  if (application.follow_up_at) {
    return {
      label: 'Move follow-up forward 3 days',
      description: 'Keep a visible next-step date attached even before the application is fully closed out.',
      suggestedDate: addDaysFromToday(3),
    }
  }

  return {
    label: 'Plan next follow-up',
    description: 'Choose the next touchpoint now so the application does not fall into a silent backlog.',
    suggestedDate: addDaysFromToday(3),
  }
}

function buildPacketVariantName(job: JobPosting): string {
  const parts = [job.title.trim(), job.company.trim()].filter(Boolean)
  return parts.length > 0 ? `${parts.join(' @ ')} Packet Resume` : 'Tailored Packet Resume'
}

function emptyLaneMessage(filter: ApplicationFilter): string {
  if (filter === 'needs_tailoring') {
    return 'Nothing needs tailoring right now. Pull in another role from Discover if you want to build the next packet.'
  }

  if (filter === 'ready_to_apply') {
    return 'No applications are packet-ready yet. Generate the packet or finish the missing pieces in the tailoring lane.'
  }

  if (filter === 'applied') {
    return 'No applied applications are waiting without an overdue follow-up.'
  }

  if (filter === 'follow_up') {
    return 'No follow-up items are due right now.'
  }

  return 'Nothing is closed yet. Rejected or archived applications will collect here.'
}

async function tailorResumeContentToJob(
  content: ResumeContent,
  jobDescription: string,
  projects: Project[],
  skills: Skill[]
): Promise<ResumeContent> {
  if (!jobDescription.trim()) return content

  const summarySection = content.sections.find(
    (section): section is ResumeSummarySection => section.type === 'summary'
  )
  const experienceSection = content.sections.find(
    (section): section is ResumeExperienceSection => section.type === 'experience'
  )

  if (!experienceSection || experienceSection.items.length === 0) return content

  const { summary, bullets } = await tailorResumeToJob(
    jobDescription,
    summarySection?.text ?? '',
    experienceSection.items,
    projects,
    skills
  )

  return {
    ...content,
    sections: content.sections.map((section) => {
      if (section.type === 'summary') {
        return {
          ...section,
          text: summary || section.text,
        }
      }

      if (section.type === 'experience') {
        return {
          ...section,
          items: section.items.map((item, index) =>
            bullets[index] ? { ...item, bullets: bullets[index] } : item
          ),
        }
      }

      return section
    }),
  }
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

function PrepColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={`${title}-${item}`} className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-muted-foreground">
              {item}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No items generated yet.</p>
        )}
      </div>
    </div>
  )
}

function buildPacketChecklist({
  application,
  assignedVariant,
  coverLetter,
  candidateAnswers,
  prep,
  highlightCount,
  touchpointCount,
  activeShareLinkCount,
}: {
  application: ApplicationRecord
  assignedVariant: ResumeVariant | null
  coverLetter: string
  candidateAnswers: CandidateAnswer[]
  prep: InterviewPrepNote | undefined
  highlightCount: number
  touchpointCount: number
  activeShareLinkCount: number
}) {
  return [
    {
      label: 'Resume variant',
      ready: Boolean(application.resume_variant_id),
      detail:
        assignedVariant && application.resume_variant_id
          ? assignedVariant.name
          : 'Attach a role-specific resume.',
    },
    {
      label: 'Cover letter',
      ready: Boolean(coverLetter.trim()),
      detail: coverLetter.trim() ? 'Drafted and ready for editing.' : 'Draft or write the cover letter.',
    },
    {
      label: 'Answer bank',
      ready: candidateAnswers.length >= 3,
      detail:
        candidateAnswers.length >= 3
          ? `${candidateAnswers.length} reusable answers available.`
          : 'Add work auth, compensation, and intro answers.',
    },
    {
      label: 'Proof highlights',
      ready: highlightCount > 0,
      detail:
        highlightCount > 0
          ? `${highlightCount} matched proof highlight${highlightCount === 1 ? '' : 's'} ready.`
          : 'No role-specific proof highlights yet.',
    },
    {
      label: 'Interview prep',
      ready: Boolean(prep),
      detail: prep ? 'Generated for this role.' : 'Generate prep when the role is worth preparing for.',
    },
    {
      label: 'Follow-up',
      ready: Boolean(application.follow_up_at),
      detail: application.follow_up_at ? `Next follow-up: ${application.follow_up_at}.` : 'Set a follow-up date.',
    },
    {
      label: 'CRM context',
      ready: touchpointCount > 0,
      detail:
        touchpointCount > 0
          ? `${touchpointCount} recruiter or referral touchpoint${touchpointCount === 1 ? '' : 's'} logged.`
          : 'No recruiter/referral notes logged yet.',
    },
    {
      label: 'Recruiter packet',
      ready: activeShareLinkCount > 0,
      detail:
        activeShareLinkCount > 0
          ? `${activeShareLinkCount} active packet link${activeShareLinkCount === 1 ? '' : 's'}.`
          : 'Create a share link when the packet is polished.',
    },
  ]
}

function isExpired(value: string) {
  return new Date(value).getTime() < Date.now()
}

async function copyText(
  value: string,
  id: string,
  setCopiedValueId: Dispatch<SetStateAction<string | null>>
) {
  try {
    await navigator.clipboard.writeText(value)
    setCopiedValueId(id)
    window.setTimeout(() => {
      setCopiedValueId((current) => (current === id ? null : current))
    }, 1500)
  } catch (error) {
    console.error('Error copying text:', error)
  }
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function addDaysFromToday(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
