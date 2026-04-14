export interface Project {
  id: string
  slug: string
  title: string
  description: string
  cover_image: string | null
  tags: string[]
  github_url: string | null
  demo_url: string | null
  display_order: number
  is_published: boolean
  created_at: string
  updated_at: string
  /** Optional conversation starter, e.g. "Ask me about: scaling to 1M users" */
  ask_me_about: string | null
}

export interface Skill {
  id: string
  name: string
  category: string
  color: string
  created_at: string
}

export interface Settings {
  id: string
  key: string
  value: string
  updated_at: string
}

export interface ProjectImage {
  id: string
  project_id: string
  image_url: string
  caption: string | null
  display_order: number
  created_at: string
}

export type ProjectFormData = Omit<Project, 'id' | 'created_at' | 'updated_at'>

export interface EducationEntry {
  type: 'education' | 'certification'
  title: string
  issuer: string
  date: string
  url?: string
}

export interface PortfolioSettings {
  bio: string
  contact_email: string
  resume_url: string
  linkedin_url: string
  github_url: string
  twitter_url: string
  site_title: string
  site_description: string
  /** Short status line, e.g. "Building X" / "Open to ML roles" */
  now_line: string
  /** e.g. "San Francisco, CA" */
  location: string
  /** Education and certifications for credibility section */
  education: EducationEntry[]
}

export interface CandidateProfile {
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
  education: EducationEntry[]
  created_at: string
  updated_at: string
}

export type JobSource = 'manual' | 'greenhouse' | 'lever' | 'usajobs'
export type JobRemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown'
export type JobSearchSource = Exclude<JobSource, 'manual'>
export type ApplicationStatus =
  | 'saved'
  | 'tailoring'
  | 'ready_to_apply'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'archived'

export interface JobPosting {
  id: string
  source: JobSource
  external_id: string
  title: string
  company: string
  location: string
  remote_type: JobRemoteType
  employment_type: string
  salary_range: string
  job_url: string
  description: string
  fit_notes: string
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type JobPostingFormData = Omit<JobPosting, 'id' | 'created_at' | 'updated_at' | 'archived_at'>

export interface ApplicationRecord {
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

export interface JobFitAssessment {
  score: number
  band: 'strong' | 'review' | 'low'
  matchedSkills: string[]
  matchedProjects: string[]
  matchedKeywords: string[]
  summary: string
}

export interface ExternalJobSearchRequest {
  source: JobSearchSource
  query: string
  location: string
  boardOrSite: string
  remoteOnly: boolean
  limit: number
}

export interface ExternalJobSearchResult {
  source: JobSearchSource
  external_id: string
  source_label: string
  title: string
  company: string
  location: string
  remote_type: JobRemoteType
  employment_type: string
  salary_range: string
  job_url: string
  description: string
}
