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
