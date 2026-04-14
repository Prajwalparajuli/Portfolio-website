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
  title: string
  company: string
  location: string
  remote_type: JobPosting['remote_type']
  employment_type: string
  salary_range: string
  job_url: string
  description: string
  fit_notes: string
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
  const { data, error } = await supabase
    .from('job_postings')
    .upsert(job, { onConflict: 'source,external_id' })
    .select('*')
    .single()

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
    title: row.title,
    company: row.company ?? '',
    location: row.location ?? '',
    remote_type: row.remote_type ?? 'unknown',
    employment_type: row.employment_type ?? '',
    salary_range: row.salary_range ?? '',
    job_url: row.job_url ?? '',
    description: row.description ?? '',
    fit_notes: row.fit_notes ?? '',
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
