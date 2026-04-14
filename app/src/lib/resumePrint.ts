import { ResumeContent } from '@/types/resume'
import { PortfolioSettings, Project, Skill } from '@/types'

export interface ResumePrintDraft {
  resume: ResumeContent
  settings: PortfolioSettings
  projects: Project[]
  skills: Skill[]
}

const RESUME_PRINT_DRAFT_KEY = 'resume-print-draft'

export function saveResumePrintDraft(draft: ResumePrintDraft) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(RESUME_PRINT_DRAFT_KEY, JSON.stringify(draft))
}

export function loadResumePrintDraft(): ResumePrintDraft | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(RESUME_PRINT_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ResumePrintDraft
  } catch {
    return null
  }
}
