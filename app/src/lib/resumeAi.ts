import { invokeAdminFunction } from '@/lib/functions'
import { isSupabaseConfigured } from '@/lib/supabase'
import { JobPosting, PortfolioSettings, Project, Skill } from '@/types'
import {
  ExperienceItem,
  ProjectExperienceItem,
  ResumeExperienceSection,
  ResumeSkillsSection,
  ResumeSummarySection,
  ResumeVariant,
} from '@/types/resume'
import { getProjectNarrative } from '@/lib/publicPortfolio'
import { narrativeOverrides } from '@/lib/narrativeOverrides'

const RESUME_AI_FUNCTION = 'resume-ai'
const RESUME_AI_NOT_READY_MESSAGE =
  'AI resume tools are not ready yet. Deploy the Supabase Edge Function "resume-ai" and set GEMINI_API_KEY in Supabase secrets.'

type ResumeAiProjectInput = {
  id: string
  title: string
  description: string
  tags: string[]
  evidence: string
}

type ResumeAiExperienceInput = {
  index: number
  sourceId: string
  kind: 'project' | 'custom'
  title: string
  tags: string[]
  bullets: string[]
}

function normalizeProject(project: Project): ResumeAiProjectInput {
  const structured = project.structured_narrative ?? narrativeOverrides[project.slug] ?? null
  const narrative = getProjectNarrative({ ...project, structured_narrative: structured })
  const evidence = [
    narrative.hook,
    narrative.summary,
    narrative.plainText,
    ...(structured?.results ?? []),
    ...(structured?.techHighlights ?? []),
    ...(structured?.metrics ?? []).map((metric) =>
      [metric.label, metric.value, metric.context].filter(Boolean).join(': ')
    ),
    ...(structured?.callouts ?? []).map((callout) =>
      [callout.title, callout.value, callout.description].filter(Boolean).join(': ')
    ),
    ...(structured?.pipelineSteps ?? []).map((step) => `${step.label}: ${step.detail}`),
    project.ask_me_about ?? '',
  ].filter(Boolean).join(' | ')

  return {
    id: project.id,
    title: project.title,
    description: project.description,
    tags: project.tags ?? [],
    evidence: evidence.slice(0, 5000),
  }
}

function normalizeExperienceItems(items: ExperienceItem[], projects: Project[]): ResumeAiExperienceInput[] {
  return items.map((item, index) => {
    if (item.kind === 'project') {
      const linkedProject = projects.find((project) => project.id === item.projectId)
      return {
        index,
        sourceId: item.projectId,
        kind: 'project',
        title: item.titleOverride || linkedProject?.title || 'Untitled project',
        tags: linkedProject?.tags ?? [],
        bullets: item.bullets,
      }
    }

    return {
      index,
      sourceId: item.id,
      kind: 'custom',
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
): Promise<{
  summary: string
  items: ExperienceItem[]
  selectedSkillIds: string[]
  selectedProjectIds: string[]
  jobTitle: string
  jobCompany: string
}> {
  const result = await invokeResumeAi<{
    summary: string
    selectedEntries: Array<{
      kind: 'project' | 'custom'
      sourceId: string
      bullets: string[]
    }>
    selectedSkillIds: string[]
    jobTitle?: string
    jobCompany?: string
  }>('tailor_resume', {
    jd,
    currentSummary,
    entries: normalizeExperienceItems(expItems, projects),
    projects: projects.map(normalizeProject),
    skills: skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      category: skill.category,
    })),
    orphanedSkills,
  })

  const projectById = new Map(projects.map((project) => [project.id, project]))
  const currentProjectItems = new Map(
    expItems
      .filter((item): item is ProjectExperienceItem => item.kind === 'project')
      .map((item) => [item.projectId, item])
  )
  const customItems = new Map(
    expItems
      .filter((item) => item.kind === 'custom')
      .map((item) => [item.id, item])
  )
  const selectedItems: ExperienceItem[] = []
  const selectedProjectIds: string[] = []
  const seen = new Set<string>()

  for (const selection of result.selectedEntries ?? []) {
    if (!selection || typeof selection.sourceId !== 'string') continue
    const key = `${selection.kind}:${selection.sourceId}`
    if (seen.has(key)) continue
    const bullets = Array.isArray(selection.bullets)
      ? selection.bullets.filter((bullet) => typeof bullet === 'string' && bullet.trim().length > 20).slice(0, 4)
      : []
    if (bullets.length === 0) continue

    if (selection.kind === 'custom') {
      const existing = customItems.get(selection.sourceId)
      if (!existing) continue
      selectedItems.push({ ...existing, bullets })
      seen.add(key)
      continue
    }

    const project = projectById.get(selection.sourceId)
    if (!project) continue
    const existing = currentProjectItems.get(project.id)
    selectedItems.push(existing
      ? { ...existing, bullets }
      : {
          kind: 'project',
          projectId: project.id,
          titleOverride: project.title,
          subtitle: '',
          url: project.demo_url ?? '',
          githubUrl: project.github_url?.replace(/^https?:\/\//, '') ?? '',
          org: '',
          dateRange: '',
          bullets,
        })
    selectedProjectIds.push(project.id)
    seen.add(key)
  }

  const validSkillIds = new Set(skills.map((skill) => skill.id))
  const selectedSkillIds = (result.selectedSkillIds ?? [])
    .filter((id) => typeof id === 'string' && validSkillIds.has(id))
    .filter((id, index, all) => all.indexOf(id) === index)
    .slice(0, 18)

  return {
    summary: result.summary?.trim() || currentSummary,
    items: selectedItems.length > 0 ? selectedItems : expItems,
    selectedSkillIds,
    selectedProjectIds,
    jobTitle: result.jobTitle?.trim() ?? '',
    jobCompany: result.jobCompany?.trim() ?? '',
  }
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
