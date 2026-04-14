/**
 * Resume builder data model.
 * Stored as JSON in settings with key `resume_content`.
 */

export interface ResumeHeader {
  name: string
  /** e.g. "Houston TX  prajwal@email.com  713-xxx-xxxx  linkedin.com/in/x  github.com/x" */
  contactLine: string
}

export interface ResumeSummarySection {
  type: 'summary'
  enabled: boolean
  sectionTitle: string
  text: string
}

export interface ResumeEducationSection {
  type: 'education'
  enabled: boolean
  sectionTitle: string
  /** Indices into PortfolioSettings.education to include */
  includedIndices: number[]
}

/** An experience/project entry sourced from a portfolio project */
export interface ProjectExperienceItem {
  kind: 'project'
  projectId: string
  /** Shown as the main title; falls back to project.title */
  titleOverride: string
  /** Optional subtitle after em-dash, e.g. "Hybrid ML Ranking Pipeline" */
  subtitle: string
  /** Primary URL (demo, HuggingFace, etc.) shown below the title */
  url: string
  /** Secondary URL (GitHub) shown on the same line as dateRange */
  githubUrl: string
  /** Company/org label (optional) */
  org: string
  dateRange: string
  /** 2-5 bullet points */
  bullets: string[]
}

/** A manually entered experience entry (internship, job, etc.) */
export interface CustomExperienceItem {
  kind: 'custom'
  id: string
  role: string
  /** Optional subtitle / team name */
  subtitle: string
  /** Link to project/work */
  url: string
  org: string
  dateRange: string
  bullets: string[]
}

export type ExperienceItem = ProjectExperienceItem | CustomExperienceItem

export interface ResumeExperienceSection {
  type: 'experience'
  enabled: boolean
  /** Override the section heading, e.g. "PROJECTS" or "EXPERIENCE" */
  sectionTitle: string
  items: ExperienceItem[]
}

export interface ResumeSkillsSection {
  type: 'skills'
  enabled: boolean
  sectionTitle: string
  /** skill IDs to include; "all" means use everything from the skills table */
  includedIds: string[] | 'all'
  /** Legacy flag kept for compatibility with older saved JSON */
  groupByCategory: boolean
  /** Flat ATS-safe formats when category grouping is not desired */
  displayStyle: 'categorized' | 'comma' | 'pipe' | 'bullet'
}

/** Top-level section union - order of this array = order on resume */
export type ResumeSection =
  | ResumeSummarySection
  | ResumeEducationSection
  | ResumeExperienceSection
  | ResumeSkillsSection

export type ResumeSectionType = ResumeSection['type']

export interface ResumeContent {
  header: ResumeHeader
  sections: ResumeSection[]
  /** Soft target for length guidance (words). Default 600 ~= 1 dense page */
  targetWords: number
}

export type ResumeVariantType = 'master' | 'tailored' | 'snapshot'

export interface ResumeVariant {
  id: string
  candidateProfileId: string | null
  name: string
  variantType: ResumeVariantType
  isPrimary: boolean
  sourceJobTitle: string
  sourceJobCompany: string
  sourceJobUrl: string
  notes: string
  content: ResumeContent
  createdAt: string | null
  updatedAt: string | null
  isFallback?: boolean
}

export const DEFAULT_RESUME_SECTION_ORDER: ResumeSectionType[] = [
  'summary',
  'experience',
  'skills',
  'education',
]

export const RESUME_LAYOUT_PRESETS = {
  projectFirst: ['summary', 'experience', 'skills', 'education'],
  educationFirst: ['summary', 'education', 'experience', 'skills'],
  skillsFirst: ['summary', 'skills', 'experience', 'education'],
} as const satisfies Record<string, ResumeSectionType[]>

export type ResumeLayoutPreset = keyof typeof RESUME_LAYOUT_PRESETS

const DEFAULT_SECTION_TITLES: Record<ResumeSectionType, string> = {
  summary: 'SUMMARY',
  experience: 'PROJECTS',
  skills: 'SKILLS',
  education: 'EDUCATION',
}

export function makeDefaultResumeSection(
  type: ResumeSectionType,
  educationCount = 0
): ResumeSection {
  switch (type) {
    case 'summary':
      return {
        type,
        enabled: true,
        sectionTitle: DEFAULT_SECTION_TITLES.summary,
        text: '',
      }
    case 'experience':
      return {
        type,
        enabled: true,
        sectionTitle: DEFAULT_SECTION_TITLES.experience,
        items: [],
      }
    case 'skills':
      return {
        type,
        enabled: true,
        sectionTitle: DEFAULT_SECTION_TITLES.skills,
        includedIds: 'all',
        groupByCategory: true,
        displayStyle: 'categorized',
      }
    case 'education':
      return {
        type,
        enabled: true,
        sectionTitle: DEFAULT_SECTION_TITLES.education,
        includedIndices: Array.from({ length: educationCount }, (_, index) => index),
      }
  }
}

export function makeDefaultResumeContent(
  name = '',
  contactLine = '',
  educationCount = 0
): ResumeContent {
  return {
    header: { name, contactLine },
    sections: DEFAULT_RESUME_SECTION_ORDER.map((type) =>
      makeDefaultResumeSection(type, educationCount)
    ),
    targetWords: 600,
  }
}

export function reorderResumeSections(
  sections: ResumeSection[],
  orderedTypes: ResumeSectionType[]
): ResumeSection[] {
  const lookup = new Map<ResumeSectionType, ResumeSection>(
    sections.map((section) => [section.type, section])
  )

  const types = Array.from(
    new Set([
      ...orderedTypes.filter(isResumeSectionType),
      ...sections.map((section) => section.type),
      ...DEFAULT_RESUME_SECTION_ORDER,
    ])
  )

  return types
    .map((type) => lookup.get(type))
    .filter((section): section is ResumeSection => Boolean(section))
}

export function normalizeResumeContent(
  content: ResumeContent | null | undefined,
  options?: {
    name?: string
    contactLine?: string
    educationCount?: number
  }
): ResumeContent {
  const educationCount = options?.educationCount ?? 0
  const fallback = makeDefaultResumeContent(
    options?.name ?? '',
    options?.contactLine ?? '',
    educationCount
  )

  if (!content) return fallback

  const sourceSections = Array.isArray(content.sections) ? content.sections : []
  const orderedTypes = Array.from(
    new Set([
      ...sourceSections
        .map((section) => section?.type)
        .filter(isResumeSectionType),
      ...DEFAULT_RESUME_SECTION_ORDER,
    ])
  )

  const normalizedSections = orderedTypes.map((type) => {
    const section = sourceSections.find((item) => item?.type === type)
    const defaults = makeDefaultResumeSection(type, educationCount)

    if (!section) return defaults

    switch (type) {
      case 'summary': {
        const current = section as ResumeSummarySection
        const summaryDefaults = defaults as ResumeSummarySection
        return {
          ...summaryDefaults,
          enabled: typeof current.enabled === 'boolean' ? current.enabled : summaryDefaults.enabled,
          sectionTitle:
            typeof current.sectionTitle === 'string' && current.sectionTitle.trim()
              ? current.sectionTitle.trim()
              : summaryDefaults.sectionTitle,
          text: typeof current.text === 'string' ? current.text : summaryDefaults.text,
        }
      }
      case 'experience': {
        const current = section as ResumeExperienceSection
        const experienceDefaults = defaults as ResumeExperienceSection
        return {
          ...experienceDefaults,
          enabled: typeof current.enabled === 'boolean' ? current.enabled : experienceDefaults.enabled,
          sectionTitle:
            typeof current.sectionTitle === 'string' && current.sectionTitle.trim()
              ? current.sectionTitle.trim()
              : experienceDefaults.sectionTitle,
          items: Array.isArray(current.items) ? current.items : experienceDefaults.items,
        }
      }
      case 'skills': {
        const current = section as ResumeSkillsSection
        const skillsDefaults = defaults as ResumeSkillsSection
        const displayStyle = isSkillsDisplayStyle(current.displayStyle)
          ? current.displayStyle
          : current.groupByCategory
            ? 'categorized'
            : 'comma'

        return {
          ...skillsDefaults,
          enabled: typeof current.enabled === 'boolean' ? current.enabled : skillsDefaults.enabled,
          sectionTitle:
            typeof current.sectionTitle === 'string' && current.sectionTitle.trim()
              ? current.sectionTitle.trim()
              : skillsDefaults.sectionTitle,
          includedIds:
            current.includedIds === 'all'
              ? 'all'
              : Array.isArray(current.includedIds)
                ? current.includedIds.filter(
                    (id): id is string => typeof id === 'string' && id.length > 0
                  )
                : skillsDefaults.includedIds,
          groupByCategory: displayStyle === 'categorized',
          displayStyle,
        }
      }
      case 'education': {
        const current = section as ResumeEducationSection
        const educationDefaults = defaults as ResumeEducationSection
        return {
          ...educationDefaults,
          enabled: typeof current.enabled === 'boolean' ? current.enabled : educationDefaults.enabled,
          sectionTitle:
            typeof current.sectionTitle === 'string' && current.sectionTitle.trim()
              ? current.sectionTitle.trim()
              : educationDefaults.sectionTitle,
          includedIndices: Array.isArray(current.includedIndices)
            ? current.includedIndices.filter((index): index is number => Number.isInteger(index))
            : educationDefaults.includedIndices,
        }
      }
    }
  })

  return {
    header: {
      name: content.header?.name ?? fallback.header.name,
      contactLine: content.header?.contactLine ?? fallback.header.contactLine,
    },
    sections: reorderResumeSections(normalizedSections, orderedTypes),
    targetWords:
      typeof content.targetWords === 'number' && Number.isFinite(content.targetWords)
        ? content.targetWords
        : fallback.targetWords,
  }
}

function isResumeSectionType(value: unknown): value is ResumeSectionType {
  return typeof value === 'string' && DEFAULT_RESUME_SECTION_ORDER.includes(value as ResumeSectionType)
}

function isSkillsDisplayStyle(
  value: unknown
): value is ResumeSkillsSection['displayStyle'] {
  return value === 'categorized' || value === 'comma' || value === 'pipe' || value === 'bullet'
}
