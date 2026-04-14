import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { PortfolioSettings, Project, Skill } from '@/types'
import { ExperienceItem } from '@/types/resume'

const RESUME_AI_FUNCTION = 'resume-ai'
const RESUME_AI_NOT_READY_MESSAGE =
  'AI resume tools are not ready yet. Deploy the Supabase Edge Function "resume-ai" and set GEMINI_API_KEY in Supabase secrets.'

type ResumeAiProjectInput = {
  title: string
  description: string
  tags: string[]
}

type ResumeAiExperienceInput = {
  index: number
  title: string
  tags: string[]
  bullets: string[]
}

type ResumeAiResponse<T> = {
  data: T
}

function normalizeProject(project: Project): ResumeAiProjectInput {
  return {
    title: project.title,
    description: project.description,
    tags: project.tags ?? [],
  }
}

function normalizeExperienceItems(items: ExperienceItem[], projects: Project[]): ResumeAiExperienceInput[] {
  return items.map((item, index) => {
    if (item.kind === 'project') {
      const linkedProject = projects.find((project) => project.id === item.projectId)
      return {
        index,
        title: item.titleOverride || linkedProject?.title || 'Untitled project',
        tags: linkedProject?.tags ?? [],
        bullets: item.bullets,
      }
    }

    return {
      index,
      title: item.role || 'Custom experience',
      tags: [],
      bullets: item.bullets,
    }
  })
}

function toResumeAiErrorMessage(message?: string): string {
  const text = message?.trim() || 'Resume AI request failed.'

  if (/Failed to send a request|FunctionsFetchError|404|network/i.test(text)) {
    return RESUME_AI_NOT_READY_MESSAGE
  }

  return text
}

async function invokeResumeAi<T>(task: string, payload: Record<string, unknown>): Promise<T> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured for secure AI features.')
  }

  const { data, error } = await supabase.functions.invoke(RESUME_AI_FUNCTION, {
    body: { task, payload },
  })

  if (error) {
    throw new Error(toResumeAiErrorMessage(error.message))
  }

  if (!data || typeof data !== 'object' || !('data' in data)) {
    throw new Error('Resume AI returned an unexpected response.')
  }

  return (data as ResumeAiResponse<T>).data
}

export async function generateResumeBullets(project: Project): Promise<string[]> {
  const result = await invokeResumeAi<{ bullets: string[] }>('generate_bullets', {
    project: normalizeProject(project),
  })

  return result.bullets
}

export async function generateResumeSummary(
  settings: PortfolioSettings,
  skills: Skill[],
  projects: Project[],
  expItems: ExperienceItem[]
): Promise<string> {
  const result = await invokeResumeAi<{ text: string }>('generate_summary', {
    settings: {
      location: settings.location,
      education: (settings.education ?? []).map((entry) => ({
        title: entry.title,
        issuer: entry.issuer,
        date: entry.date,
      })),
    },
    skills: skills.map((skill) => skill.name),
    projects: projects.map(normalizeProject),
    experienceItems: normalizeExperienceItems(expItems, projects),
  })

  return result.text
}

export async function improveResumeBullet(
  bullet: string,
  projectTitle: string,
  tags: string[]
): Promise<string> {
  const result = await invokeResumeAi<{ bullet: string }>('improve_bullet', {
    bullet,
    projectTitle,
    tags,
  })

  return result.bullet
}

export async function generateResumeSubtitle(project: Project): Promise<string> {
  const result = await invokeResumeAi<{ subtitle: string }>('generate_subtitle', {
    project: normalizeProject(project),
  })

  return result.subtitle
}

export async function tailorResumeToJob(
  jd: string,
  currentSummary: string,
  expItems: ExperienceItem[],
  projects: Project[],
  skills: Skill[]
): Promise<{ summary: string; bullets: Record<number, string[]> }> {
  return invokeResumeAi<{ summary: string; bullets: Record<number, string[]> }>('tailor_resume', {
    jd,
    currentSummary,
    entries: normalizeExperienceItems(expItems, projects),
    skills: skills.map((skill) => skill.name),
  })
}

