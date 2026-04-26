import { invokeAdminFunction } from '@/lib/functions'
import { isSupabaseConfigured } from '@/lib/supabase'
import { JobPosting, PortfolioSettings, Project, Skill } from '@/types'
import {
  ExperienceItem,
  ResumeExperienceSection,
  ResumeSkillsSection,
  ResumeSummarySection,
  ResumeVariant,
} from '@/types/resume'

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

  return invokeAdminFunction<T>(
    RESUME_AI_FUNCTION,
    { task, payload },
    {
      notReadyMessage: RESUME_AI_NOT_READY_MESSAGE,
      fallbackError: 'Resume AI returned an unexpected response.',
    }
  ).catch((error) => {
    throw new Error(toResumeAiErrorMessage(error instanceof Error ? error.message : undefined))
  })
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
  tags: string[],
  orphanedSkills?: string[]
): Promise<string> {
  const result = await invokeResumeAi<{ bullet: string }>('improve_bullet', {
    bullet,
    projectTitle,
    tags,
    orphanedSkills,
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
  skills: Skill[],
  orphanedSkills?: string[]
): Promise<{ summary: string; bullets: Record<number, string[]> }> {
  return invokeResumeAi<{ summary: string; bullets: Record<number, string[]> }>('tailor_resume', {
    jd,
    currentSummary,
    entries: normalizeExperienceItems(expItems, projects),
    skills: skills.map((skill) => skill.name),
    orphanedSkills,
  })
}

export async function generateCoverLetter(
  job: Pick<JobPosting, 'title' | 'company' | 'location' | 'employment_type' | 'description'>,
  variant: ResumeVariant,
  skills: Skill[]
): Promise<string> {
  const summarySection = variant.content.sections.find(
    (section): section is ResumeSummarySection => section.type === 'summary'
  )
  const experienceSection = variant.content.sections.find(
    (section): section is ResumeExperienceSection => section.type === 'experience'
  )
  const skillsSection = variant.content.sections.find(
    (section): section is ResumeSkillsSection => section.type === 'skills'
  )

  const selectedSkillIds =
    skillsSection?.includedIds === 'all'
      ? null
      : Array.isArray(skillsSection?.includedIds)
        ? new Set(skillsSection.includedIds)
        : null

  const skillNames = skills
    .filter((skill) => !selectedSkillIds || selectedSkillIds.has(skill.id))
    .map((skill) => skill.name)
    .slice(0, 12)

  const experienceEntries =
    experienceSection?.items.slice(0, 3).map((item, index) => ({
      index,
      title: item.kind === 'project' ? item.titleOverride || 'Project' : item.role || 'Experience',
      bullets: item.bullets.filter(Boolean).slice(0, 3),
    })) ?? []

  const result = await invokeResumeAi<{ text: string }>('generate_cover_letter', {
    job: {
      title: job.title,
      company: job.company,
      location: job.location,
      employmentType: job.employment_type,
      description: job.description,
    },
    candidate: {
      name: variant.content.header.name,
      summary: summarySection?.text ?? '',
      skills: skillNames,
      experience: experienceEntries,
    },
  })

  return result.text
}

export async function analyzeJdMatch(
  jd: string,
  resumeText: string
): Promise<{
  score: number
  foundKeywords: string[]
  missingKeywords: string[]
  redFlags: string[]
}> {
  return invokeResumeAi<{
    score: number
    foundKeywords: string[]
    missingKeywords: string[]
    redFlags: string[]
  }>('analyze_jd_match', {
    jd,
    resumeText,
  })
}
