import { createClient } from '@supabase/supabase-js'
import { Project, Skill, PortfolioSettings, EducationEntry } from '@/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key')

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

// Admin activity log (authenticated only; no-op when using secret-key)
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
    // ignore when not authenticated (e.g. secret-key mode)
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
