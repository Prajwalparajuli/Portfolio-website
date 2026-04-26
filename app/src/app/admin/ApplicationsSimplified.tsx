import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CalendarClock,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
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
import { Textarea } from '@/components/ui/textarea'
import { getAdminPath } from '@/lib/adminConfig'
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
import { generateCoverLetter, tailorResumeToJob } from '@/lib/resumeAi'
import {
  createContactTouchpoint,
  createResumeVariant,
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
import { cn } from '@/lib/utils'
import type {
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
import type {
  ResumeContent,
  ResumeExperienceSection,
  ResumeSummarySection,
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

const FILTER_OPTIONS: Array<{ value: ApplicationFilter; label: string }> = [
  { value: 'needs_tailoring', label: 'Needs tailoring' },
  { value: 'ready_to_apply', label: 'Ready to apply' },
  { value: 'applied', label: 'Applied' },
  { value: 'follow_up', label: 'Follow up' },
  { value: 'closed', label: 'Closed' },
]

type TouchpointDraft = {
  contactId: string
  channel: ContactTouchpoint['channel']
  subject: string
  note: string
  nextFollowUpAt: string
}

const EMPTY_TOUCHPOINT_DRAFT: TouchpointDraft = {
  contactId: '',
  channel: 'email',
  subject: '',
  note: '',
  nextFollowUpAt: '',
}

export function AdminApplications() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialFilterParam = searchParams.get('filter')
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
  const [pageError, setPageError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<ApplicationFilter>(
    isApplicationFilter(initialFilterParam) ? initialFilterParam : 'needs_tailoring'
  )
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(
    searchParams.get('application')
  )
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
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({})
  const [prepNoteDrafts, setPrepNoteDrafts] = useState<Record<string, string>>({})
  const [touchpointDrafts, setTouchpointDrafts] = useState<Record<string, TouchpointDraft>>({})

  useEffect(() => {
    let mounted = true

    const load = async () => {
      const [
        applicationData,
        jobData,
        jobMatchData,
        skillData,
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
      setJobs(jobData)
      setJobMatches(jobMatchData)
      setSkills(skillData)
      setProjects(projectData)
      setResumeVariants(workspace.variants)
      setCandidateAnswers(answerData)
      setPrepNotes(prepData)
      setTouchpoints(touchpointData)
      setHighlights(highlightData)
      setContacts(contactData)
      setWatchlists(watchlistData)
      setCoverLetterDrafts(
        Object.fromEntries((applicationData ?? []).map((application) => [application.id, application.cover_letter]))
      )
      setNotesDrafts(
        Object.fromEntries((applicationData ?? []).map((application) => [application.id, application.notes]))
      )
      setPrepNoteDrafts(
        Object.fromEntries((prepData ?? []).map((prep) => [prep.application_id, prep.notes]))
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

  useEffect(() => {
    const filterParam = searchParams.get('filter')
    const nextFilter = isApplicationFilter(filterParam) ? filterParam : 'needs_tailoring'
    const nextApplicationId = searchParams.get('application')

    if (nextFilter !== activeFilter) setActiveFilter(nextFilter)
    if (nextApplicationId !== selectedApplicationId) setSelectedApplicationId(nextApplicationId)
  }, [activeFilter, searchParams, selectedApplicationId])

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('filter', activeFilter)
    if (selectedApplicationId) nextParams.set('application', selectedApplicationId)
    else nextParams.delete('application')

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [activeFilter, searchParams, selectedApplicationId, setSearchParams])

  const schemaReady = applications !== null && jobs !== null
  const cockpitSupported =
    candidateAnswers !== null && prepNotes !== null && touchpoints !== null && highlights !== null
  const primaryVariant = useMemo(
    () => resumeVariants.find((variant) => variant.isPrimary) ?? resumeVariants[0] ?? null,
    [resumeVariants]
  )
  const today = useMemo(() => startOfToday(), [])
  const jobMap = useMemo(() => new Map((jobs ?? []).map((job) => [job.id, job])), [jobs])
  const contactMap = useMemo(() => new Map((contacts ?? []).map((contact) => [contact.id, contact])), [contacts])
  const watchlistMap = useMemo(
    () => new Map((watchlists ?? []).map((watchlist) => [watchlist.id, watchlist])),
    [watchlists]
  )
  const jobMatchMap = useMemo(
    () => new Map((jobMatches ?? []).map((match) => [match.job_posting_id, match])),
    [jobMatches]
  )

  const filteredApplications = useMemo(() => {
    const source = applications ?? []
    return source
      .filter((application) => getApplicationBucket(application, today) === activeFilter)
      .sort((left, right) => compareApplicationsByBucket(activeFilter, left, right))
  }, [activeFilter, applications, today])

  const countsByFilter = useMemo(() => {
    const counts = new Map<ApplicationFilter, number>(
      FILTER_OPTIONS.map((option) => [option.value, 0] as const)
    )

    for (const application of applications ?? []) {
      const bucket = getApplicationBucket(application, today)
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
    }

    return counts
  }, [applications, today])

  const selectedApplication =
    (applications ?? []).find((application) => application.id === selectedApplicationId) ??
    filteredApplications[0] ??
    null

  useEffect(() => {
    if (!selectedApplicationId) return
    const selected = (applications ?? []).find((application) => application.id === selectedApplicationId)
    if (!selected) return
    const bucket = getApplicationBucket(selected, today)
    if (bucket !== activeFilter) setActiveFilter(bucket)
  }, [activeFilter, applications, selectedApplicationId, today])

  useEffect(() => {
    if (!selectedApplication) return
    if (selectedApplication.id === selectedApplicationId) return
    setSelectedApplicationId(selectedApplication.id)
  }, [selectedApplication, selectedApplicationId])

  const selectedJob = selectedApplication ? jobMap.get(selectedApplication.job_posting_id) : null
  const selectedAssignedVariant =
    selectedApplication && selectedApplication.resume_variant_id
      ? resumeVariants.find((variant) => variant.id === selectedApplication.resume_variant_id) ?? primaryVariant
      : primaryVariant
  const selectedPrep = selectedApplication
    ? (prepNotes ?? []).find((entry) => entry.application_id === selectedApplication.id)
    : undefined
  const selectedHighlights = selectedApplication
    ? (highlights ?? []).filter(
        (entry) =>
          entry.application_id === selectedApplication.id ||
          entry.job_posting_id === selectedApplication.job_posting_id
      )
    : []
  const selectedTouchpoints = selectedApplication
    ? (touchpoints ?? []).filter((entry) => entry.application_id === selectedApplication.id)
    : []
  const selectedShareLinks = selectedApplication ? shareLinksByApplication[selectedApplication.id] ?? [] : []
  const selectedSuggestedAnswers =
    candidateAnswers && candidateAnswers.length > 0
      ? getSuggestedCandidateAnswers(candidateAnswers, 4)
      : []
  const selectedCoverLetter =
    selectedApplication ? coverLetterDrafts[selectedApplication.id] ?? selectedApplication.cover_letter : ''
  const selectedNotes = selectedApplication ? notesDrafts[selectedApplication.id] ?? selectedApplication.notes : ''
  const packetChecklist =
    selectedApplication && selectedAssignedVariant
      ? buildPacketChecklist({
          application: selectedApplication,
          assignedVariant: selectedAssignedVariant,
          coverLetter: selectedCoverLetter,
          candidateAnswers: candidateAnswers ?? [],
          prep: selectedPrep,
          highlightCount: selectedHighlights.length,
          touchpointCount: selectedTouchpoints.length,
          activeShareLinkCount: selectedShareLinks.filter((entry) => !entry.revoked_at && !isExpired(entry.expires_at)).length,
        })
      : []

  const followUpPrompt = selectedApplication ? buildFollowUpPrompt(selectedApplication) : null

  const handlePatch = async (
    id: string,
    patch: Partial<
      Pick<
        ApplicationRecord,
        'resume_variant_id' | 'status' | 'follow_up_at' | 'applied_at' | 'notes' | 'cover_letter'
      >
    >
  ) => {
    setSavingId(id)
    try {
      const updated = await updateApplication(id, patch)
      if (!updated) return

      setApplications((current) =>
        (current ?? []).map((application) => (application.id === updated.id ? updated : application))
      )
      setCoverLetterDrafts((current) => ({ ...current, [updated.id]: updated.cover_letter }))
      setNotesDrafts((current) => ({ ...current, [updated.id]: updated.notes }))
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not update this application.')
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
          ? application.follow_up_at ?? addDaysFromToday(7)
          : application.follow_up_at,
    })
  }

  const handleSeedStarterAnswers = async () => {
    if (!cockpitSupported) return

    setSeedingAnswers(true)
    try {
      const seeded = await seedDefaultCandidateAnswers()
      setCandidateAnswers(seeded)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not seed starter answers.')
    } finally {
      setSeedingAnswers(false)
    }
  }

  const handleGeneratePacket = async (
    application: ApplicationRecord,
    job: JobPosting | null,
    assignedVariant: ResumeVariant | null
  ) => {
    if (!job || !assignedVariant) {
      setPageError('Create a resume variant first so packet generation has a source resume to work from.')
      return
    }

    setGeneratingPacketId(application.id)
    setPageError(null)

    try {
      if (cockpitSupported && (candidateAnswers?.length ?? 0) === 0) {
        await handleSeedStarterAnswers()
      }

      let packetVariant = application.resume_variant_id ? assignedVariant : null
      let resumeVariantId = application.resume_variant_id

      if (!packetVariant) {
        let nextContent = assignedVariant.content

        if (job.description.trim()) {
          nextContent = await tailorResumeContentToJob(
            assignedVariant.content,
            job.description,
            projects,
            skills
          )
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
            notes: `Generated for ${job.company || 'selected company'}.`,
            content: nextContent,
          },
          { settings }
        )

        if (createdVariant) {
          packetVariant = createdVariant
          resumeVariantId = createdVariant.id
          setResumeVariants((current) => [
            createdVariant,
            ...current.filter((variant) => variant.id !== createdVariant.id),
          ])
        }
      }

      const nextCoverLetter = await generateCoverLetter(job, packetVariant ?? assignedVariant, skills)
      setCoverLetterDrafts((current) => ({ ...current, [application.id]: nextCoverLetter }))

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
      setPageError(error instanceof Error ? error.message : 'Could not generate this packet.')
    } finally {
      setGeneratingPacketId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteApplication(id)
      setApplications((current) => (current ?? []).filter((application) => application.id !== id))
      setShareLinksByApplication((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      if (selectedApplicationId === id) setSelectedApplicationId(null)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not delete this application.')
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
        const filtered = (current ?? []).filter((entry) => entry.application_id !== generated.application_id)
        return [generated, ...filtered]
      })
      setPrepNoteDrafts((current) => ({ ...current, [generated.application_id]: generated.notes }))
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not generate interview prep.')
    } finally {
      setGeneratingPrepId(null)
    }
  }

  const handleSavePrepNotes = async (prep: InterviewPrepNote, notes: string) => {
    if (!cockpitSupported) return

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
        const filtered = (current ?? []).filter((entry) => entry.application_id !== saved.application_id)
        return [saved, ...filtered]
      })
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Could not save prep notes.')
    } finally {
      setSavingPrepId(null)
    }
  }

  const handleCreateShareLink = async (
    application: ApplicationRecord,
    job: JobPosting | null,
    assignedVariant: ResumeVariant | null
  ) => {
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
      setPageError(error instanceof Error ? error.message : 'Could not create a recruiter packet link.')
    } finally {
      setCreatingShareId(null)
    }
  }

  const handleRevokeShareLink = async (applicationId: string, shareLink: ApplicationShareLink) => {
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
      setPageError(error instanceof Error ? error.message : 'Could not revoke this recruiter packet link.')
    } finally {
      setRevokingShareId(null)
    }
  }

  const handleAddTouchpoint = async (
    application: ApplicationRecord,
    job: JobPosting | null,
    draft: TouchpointDraft
  ) => {
    if (!cockpitSupported || !draft.note.trim()) return

    setAddingTouchpointId(application.id)
    try {
      const linkedContact = draft.contactId ? contactMap.get(draft.contactId) ?? null : null
      const companyWatchlistId = job?.watchlist_id ?? linkedContact?.company_watchlist_id ?? null
      const companyWatchlist = companyWatchlistId ? watchlistMap.get(companyWatchlistId) ?? null : null
      const occurredAt = new Date().toISOString()
      const created = await createContactTouchpoint({
        application_id: application.id,
        contact_id: linkedContact?.id ?? null,
        company_watchlist_id: companyWatchlistId,
        company: job?.company ?? companyWatchlist?.company_name ?? linkedContact?.organization_name ?? '',
        contact_name: linkedContact?.full_name ?? '',
        contact_role: linkedContact?.role_title ?? '',
        channel: draft.channel,
        touchpoint_kind: 'note',
        direction: 'outbound',
        subject: draft.subject.trim(),
        note: draft.note.trim(),
        occurred_at: occurredAt,
        next_follow_up_at: draft.nextFollowUpAt || null,
      })

      if (!created) return
      setTouchpoints((current) => [created, ...(current ?? [])])

      if (linkedContact) {
        const updatedContact = await updateCareerContact(linkedContact.id, {
          last_contact_at: occurredAt,
          next_follow_up_at: draft.nextFollowUpAt || linkedContact.next_follow_up_at,
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
      setPageError(error instanceof Error ? error.message : 'Could not add this touchpoint.')
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
      setPageError(error instanceof Error ? error.message : 'Could not delete this touchpoint.')
    } finally {
      setDeletingTouchpointId(null)
    }
  }

  if (!schemaReady) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Applications</h1>
          <p className="mt-1 text-muted-foreground">
            Run the application foundation migration first to unlock this workspace.
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
          <h1 className="text-3xl font-bold gradient-text">Applications</h1>
          <p className="mt-1 text-muted-foreground">
            Move each saved role from packet work to applied follow-up without leaving this screen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={getAdminPath('jobs')}>
            <Button variant="outline">Discover</Button>
          </Link>
          <Link to={getAdminPath('today')}>
            <Button variant="outline">Today</Button>
          </Link>
        </div>
      </div>

      {!cockpitSupported && (
        <Card className="glass border border-amber-400/20">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Run <code className="rounded bg-black/30 px-1 py-0.5">007_career_cockpit_phase2.sql</code>
            {' '}to enable answer bank, interview prep, recruiter packets, touchpoints, and proof highlights.
          </CardContent>
        </Card>
      )}

      {pageError && (
        <Card className="glass border border-amber-400/20">
          <CardContent className="p-4 text-sm text-amber-100">{pageError}</CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cn(
              'rounded-full border px-3 py-2 text-sm transition-colors',
              activeFilter === option.value
                ? 'border-accent/30 bg-accent/10 text-foreground'
                : 'border-white/10 bg-black/20 text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setActiveFilter(option.value)}
          >
            {option.label} <span className="text-xs text-muted-foreground">({countsByFilter.get(option.value) ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="glass overflow-hidden">
          <CardContent className="p-0">
            <div className="border-b border-white/10 px-4 py-4">
              <p className="text-sm font-semibold text-foreground">{FILTER_OPTIONS.find((option) => option.value === activeFilter)?.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {filteredApplications.length} item{filteredApplications.length === 1 ? '' : 's'}
              </p>
            </div>

            <div className="max-h-[72vh] overflow-y-auto p-3">
              {filteredApplications.length > 0 ? (
                <div className="space-y-2">
                  {filteredApplications.map((application) => {
                    const job = jobMap.get(application.job_posting_id) ?? null
                    const packetReady = isCorePacketReady({
                      resumeVariantId: application.resume_variant_id,
                      coverLetter: application.cover_letter,
                    })
                    const primaryAction =
                      activeFilter === 'needs_tailoring'
                        ? {
                            label: generatingPacketId === application.id ? 'Preparing...' : 'Prepare app',
                            onClick: () =>
                              void handleGeneratePacket(
                                application,
                                job,
                                resumeVariants.find((variant) => variant.id === application.resume_variant_id) ??
                                  primaryVariant
                              ),
                            disabled: generatingPacketId === application.id,
                          }
                        : activeFilter === 'ready_to_apply'
                          ? {
                              label: savingId === application.id ? 'Saving...' : 'Mark applied',
                              onClick: () => void handleStatusChange(application, 'applied'),
                              disabled: savingId === application.id,
                            }
                          : {
                              label: 'Open',
                              onClick: () => setSelectedApplicationId(application.id),
                              disabled: false,
                            }

                    return (
                      <DenseApplicationRow
                        key={application.id}
                        selected={selectedApplication?.id === application.id}
                        title={job?.title || 'Untitled role'}
                        subtitle={[job?.company, job?.location].filter(Boolean).join(' | ')}
                        status={application.status}
                        secondaryMeta={[
                          packetReady ? 'Core packet ready' : 'Needs packet work',
                          application.follow_up_at ? `Follow up ${application.follow_up_at}` : null,
                        ]}
                        description={truncateText(application.notes || job?.description || 'No notes yet.', 160)}
                        onSelect={() => setSelectedApplicationId(application.id)}
                        primaryAction={primaryAction}
                      />
                    )
                  })}
                </div>
              ) : (
                <EmptyPanelState
                  icon={<FileText className="h-4 w-4" />}
                  title="Nothing in this lane"
                  body={emptyLaneMessage(activeFilter)}
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-5">
            {selectedApplication && selectedJob ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold text-foreground">{selectedJob.title || 'Untitled role'}</h2>
                      <StatusBadge status={selectedApplication.status} />
                      <Badge variant={packetChecklist.every((item) => item.ready) ? 'default' : 'outline'}>
                        {isPolishedPacketReady({
                          resumeVariantId: selectedApplication.resume_variant_id,
                          coverLetter: selectedCoverLetter,
                          highlightCount: selectedHighlights.length,
                          followUpAt: selectedApplication.follow_up_at,
                        })
                          ? 'Polished packet'
                          : isCorePacketReady({
                                resumeVariantId: selectedApplication.resume_variant_id,
                                coverLetter: selectedCoverLetter,
                              })
                            ? 'Core packet ready'
                            : 'Needs tailoring'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[selectedJob.company, selectedJob.location].filter(Boolean).join(' | ')}
                    </p>
                    {jobMatchMap.get(selectedJob.id)?.reason_summary && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {jobMatchMap.get(selectedJob.id)?.reason_summary}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="gap-2"
                      disabled={generatingPacketId === selectedApplication.id}
                      onClick={() =>
                        void handleGeneratePacket(selectedApplication, selectedJob, selectedAssignedVariant)
                      }
                    >
                      {generatingPacketId === selectedApplication.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {generatingPacketId === selectedApplication.id ? 'Preparing...' : 'Prepare application'}
                    </Button>
                    {selectedApplication.status !== 'applied' &&
                      selectedApplication.status !== 'interview' &&
                      selectedApplication.status !== 'offer' &&
                      selectedApplication.status !== 'rejected' &&
                      selectedApplication.status !== 'archived' && (
                        <Button
                          variant="outline"
                          className="gap-2"
                          disabled={savingId === selectedApplication.id}
                          onClick={() => void handleStatusChange(selectedApplication, 'applied')}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Mark applied
                        </Button>
                      )}
                    <a href={selectedJob.job_url} target="_blank" rel="noreferrer">
                      <Button variant="outline" className="gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Open posting
                      </Button>
                    </a>
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={deletingId === selectedApplication.id}
                      onClick={() => void handleDelete(selectedApplication.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingId === selectedApplication.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-4">
                  <FieldCard label="Status">
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={selectedApplication.status}
                      onChange={(event) =>
                        void handleStatusChange(selectedApplication, event.target.value as ApplicationStatus)
                      }
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </FieldCard>

                  <FieldCard label="Resume variant">
                    <div className="flex gap-2">
                      <select
                        className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                        value={selectedApplication.resume_variant_id ?? ''}
                        onChange={(event) =>
                          void handlePatch(selectedApplication.id, {
                            resume_variant_id: event.target.value || null,
                          })
                        }
                      >
                        <option value="">No variant assigned</option>
                        {resumeVariants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.name}
                          </option>
                        ))}
                      </select>
                      <Link to={getAdminPath(`resume?application=${selectedApplication.id}`)}>
                        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" title="Edit this resume variant in the Builder">
                          <NotebookPen className="h-4 w-4 text-accent" />
                        </Button>
                      </Link>
                    </div>
                  </FieldCard>

                  <FieldCard label="Applied date">
                    <Input
                      type="date"
                      value={selectedApplication.applied_at ?? ''}
                      onChange={(event) =>
                        void handlePatch(selectedApplication.id, {
                          applied_at: event.target.value || null,
                        })
                      }
                    />
                  </FieldCard>

                  <FieldCard label="Follow-up">
                    <Input
                      type="date"
                      value={selectedApplication.follow_up_at ?? ''}
                      onChange={(event) =>
                        void handlePatch(selectedApplication.id, {
                          follow_up_at: event.target.value || null,
                        })
                      }
                    />
                  </FieldCard>
                </div>

                {followUpPrompt && (
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{followUpPrompt.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{followUpPrompt.description}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() =>
                          void handlePatch(selectedApplication.id, {
                            follow_up_at: followUpPrompt.suggestedDate,
                          })
                        }
                      >
                        <CalendarClock className="h-4 w-4" />
                        Set {followUpPrompt.suggestedDate}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="glass border-white/10">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center gap-2">
                        <NotebookPen className="h-4 w-4 text-accent" />
                        <p className="text-sm font-medium text-foreground">Notes</p>
                      </div>
                      <Textarea
                        rows={10}
                        value={selectedNotes}
                        onChange={(event) =>
                          setNotesDrafts((current) => ({
                            ...current,
                            [selectedApplication.id]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        disabled={savingId === selectedApplication.id || selectedNotes === selectedApplication.notes}
                        onClick={() =>
                          void handlePatch(selectedApplication.id, {
                            notes: selectedNotes,
                          })
                        }
                      >
                        {savingId === selectedApplication.id ? 'Saving...' : 'Save notes'}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="glass border-white/10">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-accent" />
                        <p className="text-sm font-medium text-foreground">Cover letter</p>
                      </div>
                      <Textarea
                        rows={10}
                        value={selectedCoverLetter}
                        onChange={(event) =>
                          setCoverLetterDrafts((current) => ({
                            ...current,
                            [selectedApplication.id]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        disabled={
                          savingId === selectedApplication.id ||
                          selectedCoverLetter === selectedApplication.cover_letter
                        }
                        onClick={() =>
                          void handlePatch(selectedApplication.id, {
                            cover_letter: selectedCoverLetter,
                            status:
                              selectedApplication.status === 'saved' ||
                              selectedApplication.status === 'tailoring'
                                ? isCorePacketReady({
                                    resumeVariantId: selectedApplication.resume_variant_id,
                                    coverLetter: selectedCoverLetter,
                                  })
                                  ? 'ready_to_apply'
                                  : 'tailoring'
                                : selectedApplication.status,
                          })
                        }
                      >
                        {savingId === selectedApplication.id ? 'Saving...' : 'Save cover letter'}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <details open className="rounded-xl border border-white/10 bg-black/20">
                  <summary className="cursor-pointer list-none px-4 py-3">
                    <p className="text-sm font-medium text-foreground">Packet support</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Checklist, answer suggestions, and proof highlights stay here instead of taking over the main page.
                    </p>
                  </summary>
                  <div className="space-y-4 border-t border-white/10 px-4 py-4">
                    <div className="grid gap-3 lg:grid-cols-2">
                      {packetChecklist.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-lg border border-white/10 bg-black/30 px-3 py-3"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant={item.ready ? 'default' : 'outline'}>
                              {item.ready ? 'Ready' : 'Missing'}
                            </Badge>
                            <p className="text-sm font-medium text-foreground">{item.label}</p>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">Suggested answers</p>
                          {cockpitSupported && (candidateAnswers?.length ?? 0) === 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={seedingAnswers}
                              onClick={() => void handleSeedStarterAnswers()}
                            >
                              {seedingAnswers ? 'Seeding...' : 'Seed starter answers'}
                            </Button>
                          )}
                        </div>
                        <div className="mt-3 space-y-2">
                          {selectedSuggestedAnswers.length > 0 ? (
                            selectedSuggestedAnswers.map((answer) => (
                              <div
                                key={answer.id}
                                className="rounded-md border border-white/10 bg-black/20 px-3 py-2"
                              >
                                <p className="text-sm font-medium text-foreground">{answer.label}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{answer.answer}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No reusable answers yet. Seed or write the basics once so you stop retyping them.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                        <p className="text-sm font-medium text-foreground">Proof highlights</p>
                        <div className="mt-3 space-y-2">
                          {selectedHighlights.length > 0 ? (
                            selectedHighlights.map((highlight) => (
                              <div
                                key={highlight.id}
                                className="rounded-md border border-white/10 bg-black/20 px-3 py-2"
                              >
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-foreground">{highlight.title}</p>
                                  <Badge variant="outline">{highlight.source_kind.replace(/_/g, ' ')}</Badge>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">{highlight.summary}</p>
                                {highlight.relevance_reason && (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    Why it matters: {highlight.relevance_reason}
                                  </p>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No role-specific highlights are attached yet.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </details>

                <details className="rounded-xl border border-white/10 bg-black/20">
                  <summary className="cursor-pointer list-none px-4 py-3">
                    <p className="text-sm font-medium text-foreground">Touchpoints</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Recruiter, referral, and outreach notes stay on the application they belong to.
                    </p>
                  </summary>
                  <div className="space-y-4 border-t border-white/10 px-4 py-4">
                    <div className="space-y-2">
                      {selectedTouchpoints.length > 0 ? (
                        selectedTouchpoints.map((touchpoint) => (
                          <div
                            key={touchpoint.id}
                            className="rounded-lg border border-white/10 bg-black/30 px-3 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium text-foreground">
                                    {touchpoint.subject || touchpoint.channel}
                                  </p>
                                  <Badge variant="outline">{touchpoint.channel}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {new Date(touchpoint.occurred_at).toLocaleString()}
                                </p>
                                <p className="mt-2 text-sm text-muted-foreground">{touchpoint.note}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={deletingTouchpointId === touchpoint.id}
                                onClick={() => void handleDeleteTouchpoint(touchpoint.id)}
                              >
                                {deletingTouchpointId === touchpoint.id ? 'Deleting...' : 'Delete'}
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No touchpoints logged yet.</p>
                      )}
                    </div>

                    <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                      <p className="text-sm font-medium text-foreground">Log touchpoint</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <FieldCard label="Contact">
                          <select
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={touchpointDrafts[selectedApplication.id]?.contactId ?? ''}
                            onChange={(event) =>
                              setTouchpointDrafts((current) => ({
                                ...current,
                                [selectedApplication.id]: {
                                  ...(current[selectedApplication.id] ?? EMPTY_TOUCHPOINT_DRAFT),
                                  contactId: event.target.value,
                                },
                              }))
                            }
                          >
                            <option value="">No linked contact</option>
                            {(contacts ?? []).map((contact) => (
                              <option key={contact.id} value={contact.id}>
                                {contact.full_name || 'Untitled contact'}{contact.organization_name ? ` — ${contact.organization_name}` : ''}
                              </option>
                            ))}
                          </select>
                        </FieldCard>
                        <FieldCard label="Channel">
                          <select
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={touchpointDrafts[selectedApplication.id]?.channel ?? 'email'}
                            onChange={(event) =>
                              setTouchpointDrafts((current) => ({
                                ...current,
                                [selectedApplication.id]: {
                                  ...(current[selectedApplication.id] ?? EMPTY_TOUCHPOINT_DRAFT),
                                  channel: event.target.value as ContactTouchpoint['channel'],
                                },
                              }))
                            }
                          >
                            {(['email', 'linkedin', 'phone', 'referral', 'other'] as const).map((channel) => (
                              <option key={channel} value={channel}>
                                {channel}
                              </option>
                            ))}
                          </select>
                        </FieldCard>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                        <FieldCard label="Subject">
                          <Input
                            value={touchpointDrafts[selectedApplication.id]?.subject ?? ''}
                            onChange={(event) =>
                              setTouchpointDrafts((current) => ({
                                ...current,
                                [selectedApplication.id]: {
                                  ...(current[selectedApplication.id] ?? EMPTY_TOUCHPOINT_DRAFT),
                                  subject: event.target.value,
                                },
                              }))
                            }
                          />
                        </FieldCard>
                        <FieldCard label="Next follow-up">
                          <Input
                            type="date"
                            value={touchpointDrafts[selectedApplication.id]?.nextFollowUpAt ?? ''}
                            onChange={(event) =>
                              setTouchpointDrafts((current) => ({
                                ...current,
                                [selectedApplication.id]: {
                                  ...(current[selectedApplication.id] ?? EMPTY_TOUCHPOINT_DRAFT),
                                  nextFollowUpAt: event.target.value,
                                },
                              }))
                            }
                          />
                        </FieldCard>
                      </div>
                      <div className="mt-3 space-y-2">
                        <p className="text-sm font-medium text-foreground">Note</p>
                        <Textarea
                          rows={4}
                          value={touchpointDrafts[selectedApplication.id]?.note ?? ''}
                          onChange={(event) =>
                            setTouchpointDrafts((current) => ({
                              ...current,
                              [selectedApplication.id]: {
                                ...(current[selectedApplication.id] ?? EMPTY_TOUCHPOINT_DRAFT),
                                note: event.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <Button
                        className="mt-3 gap-2"
                        disabled={addingTouchpointId === selectedApplication.id}
                        onClick={() =>
                          void handleAddTouchpoint(
                            selectedApplication,
                            selectedJob,
                            touchpointDrafts[selectedApplication.id] ?? EMPTY_TOUCHPOINT_DRAFT
                          )
                        }
                      >
                        <MessageSquare className="h-4 w-4" />
                        {addingTouchpointId === selectedApplication.id ? 'Saving...' : 'Save touchpoint'}
                      </Button>
                    </div>
                  </div>
                </details>

                <details className="rounded-xl border border-white/10 bg-black/20">
                  <summary className="cursor-pointer list-none px-4 py-3">
                    <p className="text-sm font-medium text-foreground">Interview prep</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Generate prep only when the role is worth preparing for.
                    </p>
                  </summary>
                  <div className="space-y-4 border-t border-white/10 px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="gap-2"
                        disabled={!cockpitSupported || generatingPrepId === selectedApplication.id}
                        onClick={() => void handleGeneratePrep(selectedApplication.id)}
                      >
                        {generatingPrepId === selectedApplication.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {generatingPrepId === selectedApplication.id ? 'Generating...' : 'Generate prep'}
                      </Button>
                    </div>

                    {selectedPrep ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                          <p className="text-sm font-medium text-foreground">Generated summary</p>
                          <p className="mt-2 text-sm text-muted-foreground">{selectedPrep.generated_summary}</p>
                        </div>
                        <div className="grid gap-4 xl:grid-cols-3">
                          <PrepColumn title="Talking points" items={selectedPrep.talking_points} />
                          <PrepColumn title="Technical focus" items={selectedPrep.technical_focus} />
                          <PrepColumn title="Recruiter questions" items={selectedPrep.recruiter_questions} />
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                          <p className="text-sm font-medium text-foreground">Tell me about yourself</p>
                          <p className="mt-2 text-sm text-muted-foreground">{selectedPrep.tell_me_about_yourself}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                          <p className="text-sm font-medium text-foreground">Prep notes</p>
                          <Textarea
                            rows={5}
                            className="mt-3"
                            value={prepNoteDrafts[selectedApplication.id] ?? selectedPrep.notes}
                            onChange={(event) =>
                              setPrepNoteDrafts((current) => ({
                                ...current,
                                [selectedApplication.id]: event.target.value,
                              }))
                            }
                          />
                          <Button
                            className="mt-3"
                            size="sm"
                            disabled={savingPrepId === selectedApplication.id}
                            onClick={() =>
                              void handleSavePrepNotes(
                                selectedPrep,
                                prepNoteDrafts[selectedApplication.id] ?? selectedPrep.notes
                              )
                            }
                          >
                            {savingPrepId === selectedApplication.id ? 'Saving...' : 'Save prep notes'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No prep generated yet. Use this only after the role becomes real enough to justify deeper prep.
                      </p>
                    )}
                  </div>
                </details>

                <details className="rounded-xl border border-white/10 bg-black/20">
                  <summary className="cursor-pointer list-none px-4 py-3">
                    <p className="text-sm font-medium text-foreground">Recruiter packet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Shareable packet links live here once the core packet is ready.
                    </p>
                  </summary>
                  <div className="space-y-4 border-t border-white/10 px-4 py-4">
                    <Button
                      className="gap-2"
                      disabled={
                        !cockpitSupported ||
                        !isCorePacketReady({
                          resumeVariantId: selectedApplication.resume_variant_id,
                          coverLetter: selectedCoverLetter,
                        }) ||
                        creatingShareId === selectedApplication.id
                      }
                      onClick={() =>
                        void handleCreateShareLink(selectedApplication, selectedJob, selectedAssignedVariant)
                      }
                    >
                      <Link2 className="h-4 w-4" />
                      {creatingShareId === selectedApplication.id ? 'Creating...' : 'Create packet link'}
                    </Button>

                    <div className="space-y-2">
                      {selectedShareLinks.length > 0 ? (
                        selectedShareLinks.map((shareLink) => {
                          const isActive = !shareLink.revoked_at && !isExpired(shareLink.expires_at)
                          return (
                            <div
                              key={shareLink.id}
                              className="rounded-lg border border-white/10 bg-black/30 px-3 py-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-foreground">{shareLink.title}</p>
                                    <Badge variant={isActive ? 'default' : 'outline'}>
                                      {isActive ? 'Active' : 'Inactive'}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Expires {new Date(shareLink.expires_at).toLocaleString()}
                                  </p>
                                  {shareLink.share_url && (
                                    <p className="mt-2 truncate text-xs text-muted-foreground">
                                      {shareLink.share_url}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {shareLink.share_url && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-2"
                                      onClick={() => void copyText(shareLink.share_url ?? '', shareLink.id, setCopiedValueId)}
                                    >
                                      <Copy className="h-4 w-4" />
                                      {copiedValueId === shareLink.id ? 'Copied' : 'Copy'}
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={revokingShareId === shareLink.id || Boolean(shareLink.revoked_at)}
                                    onClick={() => void handleRevokeShareLink(selectedApplication.id, shareLink)}
                                  >
                                    {revokingShareId === shareLink.id ? 'Revoking...' : 'Revoke'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No recruiter packet links yet.
                        </p>
                      )}
                    </div>
                  </div>
                </details>
              </div>
            ) : (
              <EmptyPanelState
                icon={<FileText className="h-5 w-5" />}
                title="Select an application"
                body="The selected application opens here with the packet, notes, follow-up, and share tools kept behind one detail panel."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DenseApplicationRow({
  selected,
  title,
  subtitle,
  status,
  secondaryMeta,
  description,
  onSelect,
  primaryAction,
}: {
  selected: boolean
  title: string
  subtitle: string
  status: ApplicationStatus
  secondaryMeta: Array<string | null>
  description: string
  onSelect: () => void
  primaryAction: {
    label: string
    onClick: () => void
    disabled: boolean
  }
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
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle || 'No company or location saved yet.'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {secondaryMeta.filter(Boolean).map((item) => (
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
          <Button size="sm" disabled={primaryAction.disabled} onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
        </div>
      </div>
    </button>
  )
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <Badge className={statusBadgeClassName(status)}>
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}

function FieldCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function PrepColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={`${title}-${item}`} className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-muted-foreground">
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

function EmptyPanelState({
  icon,
  title,
  body,
}: {
  icon: ReactNode
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

function getApplicationBucket(application: ApplicationRecord, today: Date): ApplicationFilter {
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
) {
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
}) {
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
}) {
  return isCorePacketReady({ resumeVariantId, coverLetter }) && highlightCount > 0 && Boolean(followUpAt)
}

function buildFollowUpPrompt(application: ApplicationRecord) {
  if (application.status === 'interview') {
    return {
      label: 'Set 48-hour thank-you follow-up',
      description: 'Interview-stage roles should have a clear thank-you or check-in reminder, not a vague later note.',
      suggestedDate: addDaysFromToday(2),
    }
  }

  if (application.status === 'offer') {
    return {
      label: 'Set offer decision follow-up',
      description: 'Offers need a clear response checkpoint on the calendar.',
      suggestedDate: addDaysFromToday(3),
    }
  }

  if (application.status === 'applied') {
    return {
      label: 'Set 1-week follow-up',
      description: 'Applied roles should carry a concrete next-touch date.',
      suggestedDate: addDaysFromToday(7),
    }
  }

  if (application.follow_up_at) {
    return {
      label: 'Move follow-up forward 3 days',
      description: 'Keep a visible next step attached to the application.',
      suggestedDate: addDaysFromToday(3),
    }
  }

  return {
    label: 'Plan next follow-up',
    description: 'Choose the next touchpoint now so the application does not slip.',
    suggestedDate: addDaysFromToday(3),
  }
}

function buildPacketVariantName(job: JobPosting) {
  const parts = [job.title.trim(), job.company.trim()].filter(Boolean)
  return parts.length > 0 ? `${parts.join(' @ ')} Packet Resume` : 'Tailored Packet Resume'
}

function emptyLaneMessage(filter: ApplicationFilter) {
  if (filter === 'needs_tailoring') {
    return 'Nothing needs tailoring right now. Pull in another role from Discover if you want to build the next packet.'
  }

  if (filter === 'ready_to_apply') {
    return 'No applications are packet-ready yet.'
  }

  if (filter === 'applied') {
    return 'No applied applications are waiting without an overdue follow-up.'
  }

  if (filter === 'follow_up') {
    return 'No follow-up items are due right now.'
  }

  return 'Nothing is closed yet.'
}

async function tailorResumeContentToJob(
  content: ResumeContent,
  jobDescription: string,
  projects: Project[],
  skills: Skill[]
) {
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
          : 'Add work authorization, compensation, and intro answers.',
    },
    {
      label: 'Proof highlights',
      ready: highlightCount > 0,
      detail:
        highlightCount > 0
          ? `${highlightCount} role-specific highlight${highlightCount === 1 ? '' : 's'} ready.`
          : 'No role-specific proof highlights yet.',
    },
    {
      label: 'Interview prep',
      ready: Boolean(prep),
      detail: prep ? 'Generated for this role.' : 'Generate prep when the role becomes interview-worthy.',
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
          ? `${touchpointCount} touchpoint${touchpointCount === 1 ? '' : 's'} logged.`
          : 'No recruiter or referral notes logged yet.',
    },
    {
      label: 'Recruiter packet',
      ready: activeShareLinkCount > 0,
      detail:
        activeShareLinkCount > 0
          ? `${activeShareLinkCount} active share link${activeShareLinkCount === 1 ? '' : 's'}.`
          : 'Create a share link when the packet is polished.',
    },
  ]
}

function statusBadgeClassName(status: ApplicationStatus) {
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

function isExpired(value: string) {
  return new Date(value).getTime() < Date.now()
}

async function copyText(
  value: string,
  id: string,
  setCopiedValueId: React.Dispatch<React.SetStateAction<string | null>>
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

function isApplicationFilter(value: string | null): value is ApplicationFilter {
  return FILTER_OPTIONS.some((option) => option.value === value)
}
