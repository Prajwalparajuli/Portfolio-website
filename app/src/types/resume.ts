/**
 * Resume builder data model.
 * Stored as JSON in settings with key `resume_content`.
 */

export interface ResumeHeader {
  name: string
  /** e.g. "engineer@email.com · San Francisco, CA · linkedin.com/in/x · github.com/x" */
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
  /** IDs of education entries from PortfolioSettings.education (by index) */
  includedIndices: number[]
}

/** An experience entry sourced from a portfolio project */
export interface ProjectExperienceItem {
  kind: 'project'
  projectId: string
  /** Optional override for the title; falls back to project.title */
  titleOverride: string
  /** Company/org label shown on the right of the title row */
  org: string
  dateRange: string
  /** 2–4 bullet points */
  bullets: string[]
}

/** A manually entered experience entry (internship, job, etc.) */
export interface CustomExperienceItem {
  kind: 'custom'
  id: string
  role: string
  org: string
  dateRange: string
  bullets: string[]
}

export type ExperienceItem = ProjectExperienceItem | CustomExperienceItem

export interface ResumeExperienceSection {
  type: 'experience'
  enabled: boolean
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
  /** Soft target for length guidance (words). Default 550 ≈ 1 page */
  targetWords: number
}

export function makeDefaultResumeContent(name = '', contactLine = ''): ResumeContent {
  return {
    header: { name, contactLine },
    sections: [
      { type: 'summary', enabled: true, text: '' },
      { type: 'education', enabled: true, includedIndices: [] },
      { type: 'experience', enabled: true, items: [] },
      { type: 'skills', enabled: true, includedIds: 'all', groupByCategory: true },
    ],
    targetWords: 550,
  }
}
