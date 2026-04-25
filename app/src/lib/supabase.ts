import { createClient } from '@supabase/supabase-js'
import {
  Project,
  Skill,
  PortfolioSettings,
  EducationEntry,
  CandidateProfile,
  JobPosting,
  JobPostingFormData,
  ApplicationRecord,
  ApplicationStatus,
  SavedJobSearch,
  SavedJobSearchInput,
  SavedJobSearchPatch,
  JobSyncRun,
  JobSyncRunInput,
  CandidateEvidenceItem,
  JobMatch,
  CompanyWatchlist,
  CompanyWatchlistInput,
  NotificationPreference,
  NotificationItem,
  CandidateAnswer,
  InterviewPrepNote,
  CareerContact,
  CareerContactInput,
  ContactTouchpoint,
  ProofOfWorkHighlight,
} from '@/types'
import {
  ResumeContent,
  ResumeVariant,
  ResumeVariantType,
  makeDefaultResumeContent,
  normalizeResumeContent,
} from '@/types/resume'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key')

type ResumeVariantRow = {
  id: string
  candidate_profile_id: string | null
  name: string
  variant_type: ResumeVariantType
  is_primary: boolean
  source_job_title: string
  source_job_company: string
  source_job_url: string
  notes: string
  content: ResumeContent
  created_at: string
  updated_at: string
  archived_at: string | null
}

type CandidateProfileRow = {
  id: string
  profile_key: string
  display_name: string
  bio: string
  contact_email: string
  location: string
  linkedin_url: string
  github_url: string
  twitter_url: string
  resume_url: string
  now_line: string
  education: unknown
  created_at: string
  updated_at: string
}

type ResumeWorkspace = {
  candidateProfile: CandidateProfile | null
  variants: ResumeVariant[]
  variantsSupported: boolean
}

type JobPostingRow = {
  id: string
  source: JobPosting['source']
  external_id: string
  watchlist_id?: string | null
  saved_job_search_id?: string | null
  query_label?: string
  title: string
  company: string
  location: string
  remote_type: JobPosting['remote_type']
  employment_type: string
  salary_range: string
  job_url: string
  description: string
  fit_notes: string
  discovery_status?: JobPosting['discovery_status']
  source_text?: string
  embedding_updated_at?: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

type ApplicationRecordRow = {
  id: string
  job_posting_id: string
  resume_variant_id: string | null
  status: ApplicationStatus
  follow_up_at: string | null
  applied_at: string | null
  notes: string
  cover_letter: string
  created_at: string
  updated_at: string
}

type SavedJobSearchRow = {
  id: string
  name: string
  source: SavedJobSearch['source']
  board_or_site: string
  query: string
  location: string
  remote_only: boolean
  result_limit: number
  is_enabled?: boolean
  last_run_at?: string | null
  last_error?: string
  created_at: string
  updated_at: string
}

type JobSyncRunRow = {
  id: string
  saved_job_search_id: string | null
  watchlist_id?: string | null
  run_mode: 'single' | 'enabled_batch'
  status: 'running' | 'success' | 'error'
  source: JobSyncRun['source']
  label: string
  board_or_site: string
  query: string
  location: string
  discovery_status?: string
  discovered_source?: string
  failure_stage?: string
  result_count: number
  imported_count: number
  error_message: string
  metadata?: Record<string, unknown>
  started_at: string
  completed_at: string | null
}

type CandidateEvidenceItemRow = {
  id: string
  source_kind: CandidateEvidenceItem['source_kind']
  source_id: string
  label: string
  content: string
  embedding_updated_at: string | null
  created_at: string
  updated_at: string
}

type JobMatchRow = {
  id: string
  job_posting_id: string
  best_evidence_item_id: string | null
  semantic_score: number
  keyword_score: number
  preference_score: number
  total_score: number
  band: JobMatch['band']
  reason_summary: string
  best_evidence_label: string
  matched_skill_names: string[]
  matched_project_titles: string[]
  matched_keywords: string[]
  missing_signals: string[]
  evidence_item_ids: string[]
  refreshed_at: string
  created_at: string
  updated_at: string
}

type CompanyWatchlistRow = {
  id: string
  company_name: string
  careers_url: string
  source_hint: CompanyWatchlist['source_hint']
  board_or_site: string
  preferred_query: string
  location_hint: string
  priority: CompanyWatchlist['priority']
  is_enabled: boolean
  why_this_company: string
  research_notes: string
  recent_news: string
  competitors: string
  salary_notes: string
  last_researched_at: string | null
  last_discovery_at: string | null
  last_sync_at: string | null
  last_error: string
  created_at: string
  updated_at: string
}

type NotificationPreferenceRow = {
  id: string
  profile_key: string
  email_enabled: boolean
  inbox_enabled: boolean
  strong_match_enabled: boolean
  sync_failure_enabled: boolean
  follow_up_enabled: boolean
  stale_application_enabled: boolean
  weekly_digest_enabled: boolean
  digest_hour: number
  timezone: string
  created_at: string
  updated_at: string
}

type NotificationItemRow = {
  id: string
  type: NotificationItem['type']
  title: string
  body: string
  link_path: string
  channel: NotificationItem['channel']
  is_read: boolean
  application_id: string | null
  job_posting_id: string | null
  company_watchlist_id: string | null
  contact_id: string | null
  due_at: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

type CandidateAnswerRow = {
  id: string
  prompt_key: string
  label: string
  category: string
  answer: string
  created_at: string
  updated_at: string
}

type InterviewPrepNoteRow = {
  id: string
  application_id: string
  generated_summary: string
  talking_points: unknown
  technical_focus: unknown
  recruiter_questions: unknown
  tell_me_about_yourself: string
  notes: string
  created_at: string
  updated_at: string
}

type CareerContactRow = {
  id: string
  company_watchlist_id: string | null
  full_name: string
  role_title: string
  organization_name: string
  relationship_kind: CareerContact['relationship_kind']
  email: string
  linkedin_url: string
  location: string
  introduced_by: string
  notes: string
  next_follow_up_at: string | null
  last_contact_at: string | null
  created_at: string
  updated_at: string
}

type ContactTouchpointRow = {
  id: string
  application_id: string | null
  contact_id: string | null
  company_watchlist_id: string | null
  company: string
  contact_name: string
  contact_role: string
  channel: ContactTouchpoint['channel']
  touchpoint_kind: ContactTouchpoint['touchpoint_kind']
  direction: ContactTouchpoint['direction']
  subject: string
  note: string
  occurred_at: string
  next_follow_up_at: string | null
  created_at: string
  updated_at: string
}

type ProofOfWorkHighlightRow = {
  id: string
  application_id: string | null
  job_posting_id: string | null
  source_kind: ProofOfWorkHighlight['source_kind']
  source_id: string
  title: string
  summary: string
  url: string
  relevance_reason: string
  display_order: number
  created_at: string
  updated_at: string
}

// Auth functions
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  if (!isSupabaseConfigured) return false

  try {
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email?.trim().toLowerCase()
    if (!email) return false

    const adminRpc = await supabase.rpc('is_admin_user')
    if (!adminRpc.error && typeof adminRpc.data === 'boolean') {
      return adminRpc.data
    }

    const { data, error } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', email)
      .maybeSingle()

    if (error) {
      if (isMissingTableError(error)) return false
      console.error('Error checking admin status:', error)
      return false
    }

    return Boolean(data?.email)
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

// Project functions
export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('is_published', true)
    .order('display_order', { ascending: true })
  
  if (error) {
    console.error('Error fetching projects:', error)
    return []
  }
  
  return data || []
}

export async function getAllProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('display_order', { ascending: true })
  
  if (error) {
    console.error('Error fetching all projects:', error)
    return []
  }
  
  return data || []
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()
  
  if (error) {
    console.error('Error fetching project:', error)
    return null
  }
  
  return data
}

/** Columns that always exist on projects (safe for insert/update without migration). */
const PROJECT_WRITE_COLUMNS = [
  'slug', 'title', 'description', 'cover_image', 'tags', 'github_url', 'demo_url',
  'display_order', 'is_published',
] as const

/** Optional column; only include if your DB has run the ask_me_about migration. */
const PROJECT_OPTIONAL_COLUMNS = ['ask_me_about'] as const

function projectPayload(project: Partial<Project>, includeOptional = true): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of PROJECT_WRITE_COLUMNS) {
    if (key in project && project[key as keyof Project] !== undefined) {
      out[key] = project[key as keyof Project]
    }
  }
  if (includeOptional) {
    for (const key of PROJECT_OPTIONAL_COLUMNS) {
      if (key in project && project[key as keyof Project] !== undefined) {
        out[key] = project[key as keyof Project]
      }
    }
  }
  return out
}

export async function createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project | null> {
  let payload = projectPayload(project, true)
  let { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select()
    .single()

  if (error && (error.code === '42703' || /column.*does not exist|ask_me_about/i.test(error.message))) {
    payload = projectPayload(project, false)
    const retry = await supabase.from('projects').insert(payload).select().single()
    if (retry.error) {
      console.error('Error creating project:', retry.error)
      throw retry.error
    }
    return retry.data
  }

  if (error) {
    console.error('Error creating project:', error)
    throw error
  }

  return data
}

export async function updateProject(id: string, project: Partial<Project>): Promise<Project | null> {
  let payload = projectPayload(project, true)
  let { data, error } = await supabase
    .from('projects')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error && (error.code === '42703' || /column.*does not exist|ask_me_about/i.test(error.message))) {
    payload = projectPayload(project, false)
    const retry = await supabase.from('projects').update(payload).eq('id', id).select().single()
    if (retry.error) {
      console.error('Error updating project:', retry.error)
      throw retry.error
    }
    return retry.data
  }

  if (error) {
    console.error('Error updating project:', error)
    throw error
  }

  return data
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Error deleting project:', error)
    throw error
  }
}

export async function reorderProjects(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('projects')
      .update({ display_order: i + 1 })
      .eq('id', orderedIds[i])
    
    if (error) {
      console.error('Error reordering projects:', error)
      throw error
    }
  }
}

export async function uploadProjectImage(file: File, projectId: string): Promise<string | null> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${projectId}-${Date.now()}.${fileExt}`
  
  const { error: uploadError } = await supabase.storage
    .from('project-covers')
    .upload(fileName, file)
  
  if (uploadError) {
    console.error('Error uploading image:', uploadError)
    throw uploadError
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from('project-covers')
    .getPublicUrl(fileName)
  
  return publicUrl
}

// Skills functions
export async function getSkills(): Promise<Skill[]> {
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('name', { ascending: true })
  
  if (error) {
    console.error('Error fetching skills:', error)
    return []
  }
  
  return data || []
}

export async function createSkill(name: string, category: string = 'technical', color: string = '#3b82f6'): Promise<Skill | null> {
  const { data, error } = await supabase
    .from('skills')
    .insert({ name, category, color })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating skill:', error)
    throw error
  }
  
  return data
}

export async function deleteSkill(id: string): Promise<void> {
  const { error } = await supabase
    .from('skills')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Error deleting skill:', error)
    throw error
  }
}

// Settings functions
export async function getSettings(): Promise<PortfolioSettings> {
  if (!isSupabaseConfigured) return getDefaultSettings()
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')

    if (error) {
      console.error('Error fetching settings:', error)
      return getDefaultSettings()
    }

    const settings = data?.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>) || {}

    return {
      bio: settings.bio || getDefaultSettings().bio,
      contact_email: settings.contact_email || getDefaultSettings().contact_email,
      resume_url: settings.resume_url || '',
      linkedin_url: settings.linkedin_url || '',
      github_url: settings.github_url || '',
      twitter_url: settings.twitter_url || '',
      site_title: settings.site_title || getDefaultSettings().site_title,
      site_description: settings.site_description || getDefaultSettings().site_description,
      now_line: settings.now_line ?? getDefaultSettings().now_line,
      location: settings.location ?? getDefaultSettings().location,
      education: parseEducation(settings.education),
      photo_url: settings.photo_url || '',
    }
  } catch (e) {
    console.error('Error fetching settings:', e)
    return getDefaultSettings()
  }
}

export async function updateSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value }, { onConflict: 'key' })
  
  if (error) {
    console.error('Error updating setting:', error)
    throw error
  }
}

// Contact form (public submit)
export async function submitContactMessage(data: { name: string; email: string; message: string }): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Contact is temporarily unavailable.')
  const { error } = await supabase.from('contact_messages').insert(data)
  if (error) throw error
}

// Admin activity log (authenticated only; no-op when not authenticated)
export interface ActivityEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown>
  created_at: string
}

export async function getActivityLog(limit = 50): Promise<ActivityEntry[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('admin_activity')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('Error fetching activity:', error)
    return []
  }
  return (data || []) as ActivityEntry[]
}

export async function logActivity(
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    await supabase.from('admin_activity').insert({
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      details: details ?? {},
    })
  } catch {
    // ignore when not authenticated
  }
}

export async function uploadResume(file: File): Promise<string | null> {
  const fileName = `resume-${Date.now()}.pdf`
  
  const { error: uploadError } = await supabase.storage
    .from('resume')
    .upload(fileName, file, {
      contentType: 'application/pdf',
    })
  
  if (uploadError) {
    console.error('Error uploading resume:', uploadError)
    throw uploadError
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from('resume')
    .getPublicUrl(fileName)
  
  await updateSetting('resume_url', publicUrl)
  
  return publicUrl
}

// Resume content (structured builder data)
export async function getResumeContent(): Promise<ResumeContent | null> {
  const storedVariants = await getStoredResumeVariants()
  if (storedVariants && storedVariants.length > 0) {
    return storedVariants.find((variant) => variant.isPrimary)?.content ?? storedVariants[0].content
  }

  return getLegacyResumeContent()
}

export async function getResumeWorkspace(settings?: PortfolioSettings): Promise<ResumeWorkspace> {
  const [candidateProfile, storedVariants, legacyContent] = await Promise.all([
    getCandidateProfile(),
    getStoredResumeVariants(),
    getLegacyResumeContent(),
  ])

  const defaults = buildResumeDefaults(settings)
  const variantsSupported = storedVariants !== null

  if (storedVariants && storedVariants.length > 0) {
    return {
      candidateProfile,
      variants: storedVariants.map((variant) => ({
        ...variant,
        content: normalizeResumeContent(variant.content, defaults),
      })),
      variantsSupported,
    }
  }

  return {
    candidateProfile,
    variants: [
      {
        id: variantsSupported ? 'resume-variant-draft-master' : 'resume-variant-legacy-master',
        candidateProfileId: candidateProfile?.id ?? null,
        name: 'Master Resume',
        variantType: 'master',
        isPrimary: true,
        sourceJobTitle: '',
        sourceJobCompany: '',
        sourceJobUrl: '',
        notes: '',
        content: normalizeResumeContent(
          legacyContent ?? makeDefaultResumeContent(defaults.name, defaults.contactLine, defaults.educationCount),
          defaults
        ),
        createdAt: null,
        updatedAt: null,
        isFallback: true,
      },
    ],
    variantsSupported,
  }
}

export async function syncCandidateProfileFromSettings(
  settings: PortfolioSettings
): Promise<CandidateProfile | null> {
  if (!isSupabaseConfigured) return null

  const payload = {
    profile_key: 'primary',
    display_name: settings.site_title || '',
    bio: settings.bio || '',
    contact_email: settings.contact_email || '',
    location: settings.location || '',
    linkedin_url: settings.linkedin_url || '',
    github_url: settings.github_url || '',
    twitter_url: settings.twitter_url || '',
    resume_url: settings.resume_url || '',
    now_line: settings.now_line || '',
    education: settings.education ?? [],
  }

  try {
    const { data, error } = await supabase
      .from('candidate_profiles')
      .upsert(payload, { onConflict: 'profile_key' })
      .select('*')
      .single()

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error syncing candidate profile:', error)
      return null
    }

    return mapCandidateProfileRow(data as CandidateProfileRow)
  } catch (error) {
    console.error('Error syncing candidate profile:', error)
    return null
  }
}

export async function saveResumeVariant(
  variant: ResumeVariant,
  options?: { settings?: PortfolioSettings }
): Promise<ResumeVariant> {
  const defaults = buildResumeDefaults(options?.settings)
  const normalizedContent = normalizeResumeContent(variant.content, defaults)
  const candidateProfile =
    options?.settings ? await syncCandidateProfileFromSettings(options.settings) : null
  const payload = {
    candidate_profile_id: candidateProfile?.id ?? variant.candidateProfileId ?? null,
    name: variant.name.trim() || (variant.isPrimary ? 'Master Resume' : 'Resume Variant'),
    variant_type: variant.variantType,
    is_primary: variant.isPrimary,
    source_job_title: variant.sourceJobTitle.trim(),
    source_job_company: variant.sourceJobCompany.trim(),
    source_job_url: variant.sourceJobUrl.trim(),
    notes: variant.notes.trim(),
    content: normalizedContent,
  }

  const storedVariants = await getStoredResumeVariants()
  const variantsSupported = storedVariants !== null

  if (!variantsSupported) {
    await setLegacyResumeContent(normalizedContent)
    return {
      ...variant,
      candidateProfileId: candidateProfile?.id ?? variant.candidateProfileId,
      name: payload.name,
      content: normalizedContent,
      updatedAt: new Date().toISOString(),
      createdAt: variant.createdAt ?? new Date().toISOString(),
      isFallback: true,
    }
  }

  if (payload.is_primary) {
    await clearPrimaryResumeVariant(variant.isFallback ? undefined : variant.id)
  }

  const persist = variant.isFallback
    ? supabase.from('resume_variants').insert(payload).select('*').single()
    : supabase.from('resume_variants').update(payload).eq('id', variant.id).select('*').single()

  const { data, error } = await persist

  if (error) {
    console.error('Error saving resume variant:', error)
    throw error
  }

  if (payload.is_primary) {
    await setLegacyResumeContent(normalizedContent)
  }

  return mapResumeVariantRow(data as ResumeVariantRow)
}

export async function createResumeVariant(
  variant: Omit<ResumeVariant, 'id' | 'createdAt' | 'updatedAt' | 'isFallback'>,
  options?: { settings?: PortfolioSettings }
): Promise<ResumeVariant | null> {
  const storedVariants = await getStoredResumeVariants()
  if (storedVariants === null) return null

  return saveResumeVariant(
    {
      ...variant,
      id: 'resume-variant-new',
      createdAt: null,
      updatedAt: null,
      isFallback: true,
    },
    options
  )
}

export async function deleteResumeVariant(id: string): Promise<boolean> {
  const storedVariants = await getStoredResumeVariants()
  if (storedVariants === null) return false

  const { error } = await supabase
    .from('resume_variants')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting resume variant:', error)
    throw error
  }

  return true
}

export async function updateResumeContent(content: ResumeContent): Promise<void> {
  const storedVariants = await getStoredResumeVariants()
  const primaryVariant =
    storedVariants?.find((variant) => variant.isPrimary) ??
    storedVariants?.find((variant) => variant.variantType === 'master')

  if (primaryVariant) {
    await saveResumeVariant({
      ...primaryVariant,
      content,
      isPrimary: true,
      variantType: primaryVariant.variantType === 'snapshot' ? 'master' : primaryVariant.variantType,
    })
    return
  }

  if (storedVariants !== null) {
    await saveResumeVariant({
      id: 'resume-variant-new-master',
      candidateProfileId: null,
      name: 'Master Resume',
      variantType: 'master',
      isPrimary: true,
      sourceJobTitle: '',
      sourceJobCompany: '',
      sourceJobUrl: '',
      notes: '',
      content,
      createdAt: null,
      updatedAt: null,
      isFallback: true,
    })
    return
  }

  await setLegacyResumeContent(content)
}

export async function getJobPostings(): Promise<JobPosting[] | null> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .is('archived_at', null)
      .order('updated_at', { ascending: false })

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error fetching job postings:', error)
      return []
    }

    return (data ?? []).map((row) => mapJobPostingRow(row as JobPostingRow))
  } catch (error) {
    console.error('Error fetching job postings:', error)
    return []
  }
}

export async function createJobPosting(job: JobPostingFormData): Promise<JobPosting | null> {
  const { data, error } = await supabase
    .from('job_postings')
    .insert(job)
    .select('*')
    .single()

  if (error) {
    console.error('Error creating job posting:', error)
    throw error
  }

  return mapJobPostingRow(data as JobPostingRow)
}

export async function upsertImportedJobPosting(job: JobPostingFormData): Promise<JobPosting | null> {
  const externalId = job.external_id?.trim() ?? ''

  if (!externalId) {
    return createJobPosting(job)
  }

  const existing = await supabase
    .from('job_postings')
    .select('id')
    .eq('source', job.source)
    .eq('external_id', externalId)
    .maybeSingle()

  if (existing.error) {
    console.error('Error looking up imported job posting:', existing.error)
    throw existing.error
  }

  const write = existing.data?.id
    ? await supabase
        .from('job_postings')
        .update(job)
        .eq('id', existing.data.id)
        .select('*')
        .single()
    : await supabase
        .from('job_postings')
        .insert(job)
        .select('*')
        .single()

  const { data, error } = write

  if (error) {
    console.error('Error importing job posting:', error)
    throw error
  }

  return mapJobPostingRow(data as JobPostingRow)
}

export async function updateJobPosting(
  id: string,
  patch: Partial<Pick<JobPosting, 'title' | 'company' | 'location' | 'remote_type' | 'employment_type' | 'salary_range' | 'job_url' | 'description' | 'fit_notes' | 'archived_at'>>
): Promise<JobPosting | null> {
  const { data, error } = await supabase
    .from('job_postings')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating job posting:', error)
    throw error
  }

  return mapJobPostingRow(data as JobPostingRow)
}

export async function deleteJobPosting(id: string): Promise<void> {
  const { error } = await supabase
    .from('job_postings')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting job posting:', error)
    throw error
  }
}

export async function getApplications(): Promise<ApplicationRecord[] | null> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error fetching applications:', error)
      return []
    }

    return (data ?? []).map((row) => mapApplicationRecordRow(row as ApplicationRecordRow))
  } catch (error) {
    console.error('Error fetching applications:', error)
    return []
  }
}

export async function saveApplication(
  application: Omit<ApplicationRecord, 'id' | 'created_at' | 'updated_at'>
): Promise<ApplicationRecord | null> {
  const { data, error } = await supabase
    .from('applications')
    .upsert(application, { onConflict: 'job_posting_id' })
    .select('*')
    .single()

  if (error) {
    console.error('Error saving application:', error)
    throw error
  }

  return mapApplicationRecordRow(data as ApplicationRecordRow)
}

export async function updateApplication(
  id: string,
  patch: Partial<Pick<ApplicationRecord, 'resume_variant_id' | 'status' | 'follow_up_at' | 'applied_at' | 'notes' | 'cover_letter'>>
): Promise<ApplicationRecord | null> {
  const { data, error } = await supabase
    .from('applications')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating application:', error)
    throw error
  }

  return mapApplicationRecordRow(data as ApplicationRecordRow)
}

export async function deleteApplication(id: string): Promise<void> {
  const { error } = await supabase
    .from('applications')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting application:', error)
    throw error
  }
}

export async function getSavedJobSearches(): Promise<SavedJobSearch[] | null> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('saved_job_searches')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error fetching saved job searches:', error)
      return []
    }

    return (data ?? []).map((row) => mapSavedJobSearchRow(row as SavedJobSearchRow))
  } catch (error) {
    console.error('Error fetching saved job searches:', error)
    return []
  }
}

export async function createSavedJobSearch(
  payload: SavedJobSearchInput
): Promise<SavedJobSearch | null> {
  const { data, error } = await supabase
    .from('saved_job_searches')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    console.error('Error creating saved job search:', error)
    throw error
  }

  return mapSavedJobSearchRow(data as SavedJobSearchRow)
}

export async function updateSavedJobSearch(
  id: string,
  patch: SavedJobSearchPatch
): Promise<SavedJobSearch | null> {
  const { data, error } = await supabase
    .from('saved_job_searches')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating saved job search:', error)
    throw error
  }

  return mapSavedJobSearchRow(data as SavedJobSearchRow)
}

export async function deleteSavedJobSearch(id: string): Promise<void> {
  const { error } = await supabase
    .from('saved_job_searches')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting saved job search:', error)
    throw error
  }
}

export async function getJobSyncRuns(limit = 12): Promise<JobSyncRun[] | null> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('job_sync_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error fetching job sync runs:', error)
      return []
    }

    return (data ?? []).map((row) => mapJobSyncRunRow(row as JobSyncRunRow))
  } catch (error) {
    console.error('Error fetching job sync runs:', error)
    return []
  }
}

export async function createJobSyncRun(payload: JobSyncRunInput): Promise<JobSyncRun | null> {
  const { data, error } = await supabase
    .from('job_sync_runs')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    console.error('Error creating job sync run:', error)
    throw error
  }

  return mapJobSyncRunRow(data as JobSyncRunRow)
}

export async function updateJobSyncRun(
  id: string,
  patch: Partial<JobSyncRunInput>
): Promise<JobSyncRun | null> {
  const { data, error } = await supabase
    .from('job_sync_runs')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating job sync run:', error)
    throw error
  }

  return mapJobSyncRunRow(data as JobSyncRunRow)
}

export async function getCandidateEvidenceItems(): Promise<CandidateEvidenceItem[] | null> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('candidate_evidence_items')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error fetching candidate evidence:', error)
      return []
    }

    return (data ?? []).map((row) => mapCandidateEvidenceItemRow(row as CandidateEvidenceItemRow))
  } catch (error) {
    console.error('Error fetching candidate evidence:', error)
    return []
  }
}

export async function getJobMatches(): Promise<JobMatch[] | null> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('job_matches')
      .select('*')
      .order('total_score', { ascending: false })

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error fetching job matches:', error)
      return []
    }

    return (data ?? []).map((row) => mapJobMatchRow(row as JobMatchRow))
  } catch (error) {
    console.error('Error fetching job matches:', error)
    return []
  }
}

export async function getCompanyWatchlists(): Promise<CompanyWatchlist[] | null> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('company_watchlists')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error fetching company watchlists:', error)
      return []
    }

    return (data ?? []).map((row) => mapCompanyWatchlistRow(row as CompanyWatchlistRow))
  } catch (error) {
    console.error('Error fetching company watchlists:', error)
    return []
  }
}

export async function createCompanyWatchlist(
  payload: CompanyWatchlistInput
): Promise<CompanyWatchlist | null> {
  const { data, error } = await supabase
    .from('company_watchlists')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    console.error('Error creating company watchlist:', error)
    throw error
  }

  return mapCompanyWatchlistRow(data as CompanyWatchlistRow)
}

export async function updateCompanyWatchlist(
  id: string,
  patch: Partial<
    CompanyWatchlistInput &
      Pick<CompanyWatchlist, 'last_discovery_at' | 'last_sync_at' | 'last_error' | 'last_researched_at'>
  >
): Promise<CompanyWatchlist | null> {
  const { data, error } = await supabase
    .from('company_watchlists')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating company watchlist:', error)
    throw error
  }

  return mapCompanyWatchlistRow(data as CompanyWatchlistRow)
}

export async function deleteCompanyWatchlist(id: string): Promise<void> {
  const { error } = await supabase
    .from('company_watchlists')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting company watchlist:', error)
    throw error
  }
}

export async function getCareerContacts(): Promise<CareerContact[] | null> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('career_contacts')
      .select('*')
      .order('next_follow_up_at', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false })

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error fetching career contacts:', error)
      return []
    }

    return (data ?? []).map((row) => mapCareerContactRow(row as CareerContactRow))
  } catch (error) {
    console.error('Error fetching career contacts:', error)
    return []
  }
}

export async function createCareerContact(payload: CareerContactInput): Promise<CareerContact | null> {
  const { data, error } = await supabase
    .from('career_contacts')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    console.error('Error creating career contact:', error)
    throw error
  }

  return mapCareerContactRow(data as CareerContactRow)
}

export async function updateCareerContact(
  id: string,
  patch: Partial<CareerContactInput>
): Promise<CareerContact | null> {
  const { data, error } = await supabase
    .from('career_contacts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating career contact:', error)
    throw error
  }

  return mapCareerContactRow(data as CareerContactRow)
}

export async function deleteCareerContact(id: string): Promise<void> {
  const { error } = await supabase
    .from('career_contacts')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting career contact:', error)
    throw error
  }
}

export async function getNotificationPreferences(): Promise<NotificationPreference | null> {
  if (!isSupabaseConfigured) return null

  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('profile_key', 'primary')
      .maybeSingle()

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error fetching notification preferences:', error)
      return null
    }

    return data ? mapNotificationPreferenceRow(data as NotificationPreferenceRow) : null
  } catch (error) {
    console.error('Error fetching notification preferences:', error)
    return null
  }
}

export async function saveNotificationPreferences(
  patch: Partial<Omit<NotificationPreference, 'id' | 'created_at' | 'updated_at'>>
): Promise<NotificationPreference | null> {
  const payload = {
    profile_key: 'primary',
    ...patch,
  }

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(payload, { onConflict: 'profile_key' })
    .select('*')
    .single()

  if (error) {
    console.error('Error saving notification preferences:', error)
    throw error
  }

  return mapNotificationPreferenceRow(data as NotificationPreferenceRow)
}

export async function getNotificationItems(limit = 50): Promise<NotificationItem[] | null> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('notification_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error fetching notification items:', error)
      return []
    }

    return (data ?? []).map((row) => mapNotificationItemRow(row as NotificationItemRow))
  } catch (error) {
    console.error('Error fetching notification items:', error)
    return []
  }
}

export async function updateNotificationItem(
  id: string,
  patch: Partial<Pick<NotificationItem, 'is_read' | 'sent_at'>>
): Promise<NotificationItem | null> {
  const { data, error } = await supabase
    .from('notification_items')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating notification item:', error)
    throw error
  }

  return mapNotificationItemRow(data as NotificationItemRow)
}

export async function getCandidateAnswers(): Promise<CandidateAnswer[] | null> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('candidate_answers')
      .select('*')
      .order('category', { ascending: true })
      .order('label', { ascending: true })

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error fetching candidate answers:', error)
      return []
    }

    return (data ?? []).map((row) => mapCandidateAnswerRow(row as CandidateAnswerRow))
  } catch (error) {
    console.error('Error fetching candidate answers:', error)
    return []
  }
}

export async function upsertCandidateAnswer(
  payload: Pick<CandidateAnswer, 'prompt_key' | 'label' | 'category' | 'answer'>
): Promise<CandidateAnswer | null> {
  const { data, error } = await supabase
    .from('candidate_answers')
    .upsert(payload, { onConflict: 'prompt_key' })
    .select('*')
    .single()

  if (error) {
    console.error('Error saving candidate answer:', error)
    throw error
  }

  return mapCandidateAnswerRow(data as CandidateAnswerRow)
}

export async function deleteCandidateAnswer(id: string): Promise<void> {
  const { error } = await supabase
    .from('candidate_answers')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting candidate answer:', error)
    throw error
  }
}

export async function getInterviewPrepNotes(): Promise<InterviewPrepNote[] | null> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('interview_prep_notes')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error fetching interview prep notes:', error)
      return []
    }

    return (data ?? []).map((row) => mapInterviewPrepNoteRow(row as InterviewPrepNoteRow))
  } catch (error) {
    console.error('Error fetching interview prep notes:', error)
    return []
  }
}

export async function saveInterviewPrepNote(
  payload: Omit<InterviewPrepNote, 'id' | 'created_at' | 'updated_at'>
): Promise<InterviewPrepNote | null> {
  const { data, error } = await supabase
    .from('interview_prep_notes')
    .upsert({
      application_id: payload.application_id,
      generated_summary: payload.generated_summary,
      talking_points: payload.talking_points,
      technical_focus: payload.technical_focus,
      recruiter_questions: payload.recruiter_questions,
      tell_me_about_yourself: payload.tell_me_about_yourself,
      notes: payload.notes,
    }, { onConflict: 'application_id' })
    .select('*')
    .single()

  if (error) {
    console.error('Error saving interview prep note:', error)
    throw error
  }

  return mapInterviewPrepNoteRow(data as InterviewPrepNoteRow)
}

export async function getContactTouchpoints(): Promise<ContactTouchpoint[] | null> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('contact_touchpoints')
      .select('*')
      .order('occurred_at', { ascending: false })

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error fetching contact touchpoints:', error)
      return []
    }

    return (data ?? []).map((row) => mapContactTouchpointRow(row as ContactTouchpointRow))
  } catch (error) {
    console.error('Error fetching contact touchpoints:', error)
    return []
  }
}

export async function createContactTouchpoint(
  payload: Omit<ContactTouchpoint, 'id' | 'created_at' | 'updated_at'>
): Promise<ContactTouchpoint | null> {
  const { data, error } = await supabase
    .from('contact_touchpoints')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    console.error('Error creating contact touchpoint:', error)
    throw error
  }

  return mapContactTouchpointRow(data as ContactTouchpointRow)
}

export async function deleteContactTouchpoint(id: string): Promise<void> {
  const { error } = await supabase
    .from('contact_touchpoints')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting contact touchpoint:', error)
    throw error
  }
}

export async function getProofOfWorkHighlights(): Promise<ProofOfWorkHighlight[] | null> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('proof_of_work_highlights')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error fetching proof of work highlights:', error)
      return []
    }

    return (data ?? []).map((row) => mapProofOfWorkHighlightRow(row as ProofOfWorkHighlightRow))
  } catch (error) {
    console.error('Error fetching proof of work highlights:', error)
    return []
  }
}

async function getLegacyResumeContent(): Promise<ResumeContent | null> {
  if (!isSupabaseConfigured) return null
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'resume_content')
      .maybeSingle()
    if (error || !data) return null
    return JSON.parse(data.value) as ResumeContent
  } catch {
    return null
  }
}

async function setLegacyResumeContent(content: ResumeContent): Promise<void> {
  await updateSetting('resume_content', JSON.stringify(content))
}

async function getCandidateProfile(): Promise<CandidateProfile | null> {
  if (!isSupabaseConfigured) return null
  try {
    const { data, error } = await supabase
      .from('candidate_profiles')
      .select('*')
      .eq('profile_key', 'primary')
      .maybeSingle()

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error fetching candidate profile:', error)
      return null
    }

    if (!data) return null
    return mapCandidateProfileRow(data as CandidateProfileRow)
  } catch (error) {
    console.error('Error fetching candidate profile:', error)
    return null
  }
}

async function getStoredResumeVariants(): Promise<ResumeVariant[] | null> {
  if (!isSupabaseConfigured) return null
  try {
    const { data, error } = await supabase
      .from('resume_variants')
      .select('*')
      .is('archived_at', null)
      .order('is_primary', { ascending: false })
      .order('updated_at', { ascending: false })

    if (error) {
      if (isMissingTableError(error)) return null
      console.error('Error fetching resume variants:', error)
      return []
    }

    return (data ?? []).map((row) => mapResumeVariantRow(row as ResumeVariantRow))
  } catch (error) {
    console.error('Error fetching resume variants:', error)
    return []
  }
}

async function clearPrimaryResumeVariant(excludeId?: string): Promise<void> {
  let query = supabase
    .from('resume_variants')
    .update({ is_primary: false })
    .eq('is_primary', true)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { error } = await query
  if (error && !isMissingTableError(error)) {
    console.error('Error clearing primary resume variant:', error)
    throw error
  }
}

function buildResumeDefaults(settings?: PortfolioSettings) {
  return {
    name: settings?.site_title || '',
    contactLine: buildContactLineFromSettings(settings),
    educationCount: settings?.education.length ?? 0,
  }
}

function buildContactLineFromSettings(settings?: PortfolioSettings): string {
  if (!settings) return ''

  const parts: string[] = []
  if (settings.location) parts.push(settings.location)
  if (settings.contact_email) parts.push(settings.contact_email)
  if (settings.linkedin_url) parts.push(settings.linkedin_url.replace(/^https?:\/\//, ''))
  if (settings.github_url) parts.push(settings.github_url.replace(/^https?:\/\//, ''))

  return parts.join('  ')
}

function mapJobPostingRow(row: JobPostingRow): JobPosting {
  return {
    id: row.id,
    source: row.source,
    external_id: row.external_id ?? '',
    watchlist_id: row.watchlist_id ?? null,
    saved_job_search_id: row.saved_job_search_id ?? null,
    query_label: row.query_label ?? '',
    title: row.title,
    company: row.company ?? '',
    location: row.location ?? '',
    remote_type: row.remote_type ?? 'unknown',
    employment_type: row.employment_type ?? '',
    salary_range: row.salary_range ?? '',
    job_url: row.job_url ?? '',
    description: row.description ?? '',
    fit_notes: row.fit_notes ?? '',
    discovery_status: row.discovery_status ?? 'manual',
    source_text: row.source_text ?? '',
    embedding_updated_at: row.embedding_updated_at ?? null,
    archived_at: row.archived_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapApplicationRecordRow(row: ApplicationRecordRow): ApplicationRecord {
  return {
    id: row.id,
    job_posting_id: row.job_posting_id,
    resume_variant_id: row.resume_variant_id ?? null,
    status: row.status,
    follow_up_at: row.follow_up_at ?? null,
    applied_at: row.applied_at ?? null,
    notes: row.notes ?? '',
    cover_letter: row.cover_letter ?? '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapResumeVariantRow(row: ResumeVariantRow): ResumeVariant {
  return {
    id: row.id,
    candidateProfileId: row.candidate_profile_id,
    name: row.name,
    variantType: row.variant_type,
    isPrimary: row.is_primary,
    sourceJobTitle: row.source_job_title ?? '',
    sourceJobCompany: row.source_job_company ?? '',
    sourceJobUrl: row.source_job_url ?? '',
    notes: row.notes ?? '',
    content: row.content,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

function mapSavedJobSearchRow(row: SavedJobSearchRow): SavedJobSearch {
  return {
    id: row.id,
    name: row.name,
    source: row.source,
    board_or_site: row.board_or_site ?? '',
    query: row.query ?? '',
    location: row.location ?? '',
    remote_only: row.remote_only ?? false,
    result_limit: row.result_limit ?? 20,
    is_enabled: row.is_enabled ?? true,
    last_run_at: row.last_run_at ?? null,
    last_error: row.last_error ?? '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapJobSyncRunRow(row: JobSyncRunRow): JobSyncRun {
  return {
    id: row.id,
    saved_job_search_id: row.saved_job_search_id ?? null,
    watchlist_id: row.watchlist_id ?? null,
    run_mode: row.run_mode,
    status: row.status,
    source: row.source,
    label: row.label ?? '',
    board_or_site: row.board_or_site ?? '',
    query: row.query ?? '',
    location: row.location ?? '',
    discovery_status: row.discovery_status ?? '',
    discovered_source: row.discovered_source ?? '',
    failure_stage: row.failure_stage ?? '',
    result_count: row.result_count ?? 0,
    imported_count: row.imported_count ?? 0,
    error_message: row.error_message ?? '',
    metadata: row.metadata ?? {},
    started_at: row.started_at,
    completed_at: row.completed_at ?? null,
  }
}

function mapCandidateEvidenceItemRow(row: CandidateEvidenceItemRow): CandidateEvidenceItem {
  return {
    id: row.id,
    source_kind: row.source_kind,
    source_id: row.source_id ?? '',
    label: row.label ?? '',
    content: row.content ?? '',
    embedding_updated_at: row.embedding_updated_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapJobMatchRow(row: JobMatchRow): JobMatch {
  return {
    id: row.id,
    job_posting_id: row.job_posting_id,
    best_evidence_item_id: row.best_evidence_item_id ?? null,
    semantic_score: Number(row.semantic_score ?? 0),
    keyword_score: Number(row.keyword_score ?? 0),
    preference_score: Number(row.preference_score ?? 0),
    total_score: Number(row.total_score ?? 0),
    band: row.band ?? 'low',
    reason_summary: row.reason_summary ?? '',
    best_evidence_label: row.best_evidence_label ?? '',
    matched_skill_names: Array.isArray(row.matched_skill_names) ? row.matched_skill_names : [],
    matched_project_titles: Array.isArray(row.matched_project_titles) ? row.matched_project_titles : [],
    matched_keywords: Array.isArray(row.matched_keywords) ? row.matched_keywords : [],
    missing_signals: Array.isArray(row.missing_signals) ? row.missing_signals : [],
    evidence_item_ids: Array.isArray(row.evidence_item_ids) ? row.evidence_item_ids : [],
    refreshed_at: row.refreshed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapCompanyWatchlistRow(row: CompanyWatchlistRow): CompanyWatchlist {
  return {
    id: row.id,
    company_name: row.company_name ?? '',
    careers_url: row.careers_url ?? '',
    source_hint: row.source_hint ?? 'auto',
    board_or_site: row.board_or_site ?? '',
    preferred_query: row.preferred_query ?? '',
    location_hint: row.location_hint ?? '',
    priority: row.priority ?? 'medium',
    is_enabled: row.is_enabled ?? true,
    why_this_company: row.why_this_company ?? '',
    research_notes: row.research_notes ?? '',
    recent_news: row.recent_news ?? '',
    competitors: row.competitors ?? '',
    salary_notes: row.salary_notes ?? '',
    last_researched_at: row.last_researched_at ?? null,
    last_discovery_at: row.last_discovery_at ?? null,
    last_sync_at: row.last_sync_at ?? null,
    last_error: row.last_error ?? '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapNotificationPreferenceRow(row: NotificationPreferenceRow): NotificationPreference {
  return {
    id: row.id,
    profile_key: row.profile_key,
    email_enabled: row.email_enabled ?? true,
    inbox_enabled: row.inbox_enabled ?? true,
    strong_match_enabled: row.strong_match_enabled ?? true,
    sync_failure_enabled: row.sync_failure_enabled ?? true,
    follow_up_enabled: row.follow_up_enabled ?? true,
    stale_application_enabled: row.stale_application_enabled ?? true,
    weekly_digest_enabled: row.weekly_digest_enabled ?? true,
    digest_hour: Number(row.digest_hour ?? 8),
    timezone: row.timezone ?? 'America/Chicago',
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapNotificationItemRow(row: NotificationItemRow): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title ?? '',
    body: row.body ?? '',
    link_path: row.link_path ?? '',
    channel: row.channel ?? 'inbox',
    is_read: row.is_read ?? false,
    application_id: row.application_id ?? null,
    job_posting_id: row.job_posting_id ?? null,
    company_watchlist_id: row.company_watchlist_id ?? null,
    contact_id: row.contact_id ?? null,
    due_at: row.due_at ?? null,
    sent_at: row.sent_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapCareerContactRow(row: CareerContactRow): CareerContact {
  return {
    id: row.id,
    company_watchlist_id: row.company_watchlist_id ?? null,
    full_name: row.full_name ?? '',
    role_title: row.role_title ?? '',
    organization_name: row.organization_name ?? '',
    relationship_kind: row.relationship_kind ?? 'networking',
    email: row.email ?? '',
    linkedin_url: row.linkedin_url ?? '',
    location: row.location ?? '',
    introduced_by: row.introduced_by ?? '',
    notes: row.notes ?? '',
    next_follow_up_at: row.next_follow_up_at ?? null,
    last_contact_at: row.last_contact_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapCandidateAnswerRow(row: CandidateAnswerRow): CandidateAnswer {
  return {
    id: row.id,
    prompt_key: row.prompt_key ?? '',
    label: row.label ?? '',
    category: row.category ?? 'general',
    answer: row.answer ?? '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapInterviewPrepNoteRow(row: InterviewPrepNoteRow): InterviewPrepNote {
  return {
    id: row.id,
    application_id: row.application_id,
    generated_summary: row.generated_summary ?? '',
    talking_points: parseStringArray(row.talking_points),
    technical_focus: parseStringArray(row.technical_focus),
    recruiter_questions: parseStringArray(row.recruiter_questions),
    tell_me_about_yourself: row.tell_me_about_yourself ?? '',
    notes: row.notes ?? '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapContactTouchpointRow(row: ContactTouchpointRow): ContactTouchpoint {
  return {
    id: row.id,
    application_id: row.application_id ?? null,
    contact_id: row.contact_id ?? null,
    company_watchlist_id: row.company_watchlist_id ?? null,
    company: row.company ?? '',
    contact_name: row.contact_name ?? '',
    contact_role: row.contact_role ?? '',
    channel: row.channel ?? 'email',
    touchpoint_kind: row.touchpoint_kind ?? 'note',
    direction: row.direction ?? 'outbound',
    subject: row.subject ?? '',
    note: row.note ?? '',
    occurred_at: row.occurred_at,
    next_follow_up_at: row.next_follow_up_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapProofOfWorkHighlightRow(row: ProofOfWorkHighlightRow): ProofOfWorkHighlight {
  return {
    id: row.id,
    application_id: row.application_id ?? null,
    job_posting_id: row.job_posting_id ?? null,
    source_kind: row.source_kind,
    source_id: row.source_id ?? '',
    title: row.title ?? '',
    summary: row.summary ?? '',
    url: row.url ?? '',
    relevance_reason: row.relevance_reason ?? '',
    display_order: Number(row.display_order ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapCandidateProfileRow(row: CandidateProfileRow): CandidateProfile {
  return {
    id: row.id,
    profile_key: row.profile_key,
    display_name: row.display_name,
    bio: row.bio,
    contact_email: row.contact_email,
    location: row.location,
    linkedin_url: row.linkedin_url,
    github_url: row.github_url,
    twitter_url: row.twitter_url,
    resume_url: row.resume_url,
    now_line: row.now_line,
    education: parseEducationJSON(row.education),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function parseEducationJSON(value: unknown): EducationEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is EducationEntry =>
      Boolean(entry) &&
      typeof entry === 'object' &&
      'title' in entry &&
      'issuer' in entry &&
      'date' in entry
  )
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; message?: string; details?: string; hint?: string }
  const haystack = [candidate.message, candidate.details, candidate.hint].filter(Boolean).join(' ')
  return (
    candidate.code === '42P01' ||
    candidate.code === 'PGRST205' ||
    /relation .* does not exist|table .* does not exist|schema cache|Could not find the table/i.test(
      haystack
    )
  )
}

function parseEducation(value: string | undefined): EducationEntry[] {
  if (!value) return []
  try {
    const arr = JSON.parse(value) as unknown
    return Array.isArray(arr) ? arr.filter((e): e is EducationEntry => e && typeof e === 'object' && 'title' in e && 'issuer' in e && 'date' in e) : []
  } catch {
    return []
  }
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
}

function getDefaultSettings(): PortfolioSettings {
  const contactEmail =
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_CONTACT_EMAIL?.trim() ||
    'your.email@example.com'
  return {
    bio: 'Data Scientist and AI Engineer passionate about building intelligent systems that solve real-world problems.',
    contact_email: contactEmail,
    resume_url: '',
    linkedin_url: '',
    github_url: '',
    twitter_url: '',
    site_title: 'AI Portfolio',
    site_description: 'Portfolio of a Data Scientist & AI Engineer',
    now_line: '',
    location: '',
    education: [],
  }
}
