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
  text: string
}

export interface ResumeEducationSection {
  type: 'education'
  enabled: boolean
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
  /** 2–5 bullet points */
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
  /** Override the section heading, e.g. "PROJECT" or "EXPERIENCE" */
  sectionTitle: string
  items: ExperienceItem[]
}

export interface ResumeSkillsSection {
  type: 'skills'
  enabled: boolean
  /** skill IDs to include; "all" means use everything from the skills table */
  includedIds: string[] | 'all'
  /** Group skills by category in the preview */
  groupByCategory: boolean
}

/** Top-level section union — order of this array = order on resume */
export type ResumeSection =
  | ResumeSummarySection
  | ResumeEducationSection
  | ResumeExperienceSection
  | ResumeSkillsSection

export interface ResumeContent {
  header: ResumeHeader
  sections: ResumeSection[]
  /** Soft target for length guidance (words). Default 600 ≈ 1 dense page */
  targetWords: number
}

export function makeDefaultResumeContent(name = '', contactLine = ''): ResumeContent {
  return {
    header: { name, contactLine },
    sections: [
      { type: 'summary', enabled: true, text: '' },
      { type: 'experience', enabled: true, sectionTitle: 'PROJECT', items: [] },
      { type: 'skills', enabled: true, includedIds: 'all', groupByCategory: true },
      { type: 'education', enabled: true, includedIndices: [] },
    ],
    targetWords: 600,
  }
}
