export interface NarrativeMetric {
  label: string
  value: string
  context?: string
}

export interface NarrativeScreenshot {
  url: string
  caption: string
}

export interface NarrativeChartDataPoint {
  label: string
  value: number
  /** Secondary value for stacked charts */
  value2?: number
  /** Custom color override */
  color?: string
}

export interface NarrativeChart {
  /** Chart type to render */
  type: 'horizontal-bar' | 'stacked-bar' | 'donut'
  /** Chart title */
  title: string
  /** Data points */
  data: NarrativeChartDataPoint[]
  /** Format for values */
  valueFormat?: 'percent' | 'number' | 'currency'
  /** X-axis label */
  xLabel?: string
  /** Y-axis label */
  yLabel?: string
  /** Labels for stacked chart legend */
  legend?: string[]
  /** Accent note below chart */
  insight?: string
}

export interface NarrativeCallout {
  title: string
  value: string
  description: string
  type: 'success' | 'warning' | 'info' | 'critical'
}

export interface NarrativePipelineStep {
  label: string
  detail: string
  icon?: string
}

export interface NarrativeTheme {
  /** CSS color for accent elements */
  accent: string
  /** Secondary accent for gradients */
  accentAlt?: string
  /** Layout variant changes the overall page feel */
  variant?: 'default' | 'dashboard' | 'showcase' | 'research'
}

export interface StructuredNarrative {
  hook: string
  problem: string
  approach: string
  results: string[]
  learned: string[]
  summary: string
  /** Quantified metrics displayed as stat cards */
  metrics?: NarrativeMetric[]
  /** Screenshots/diagrams carousel */
  screenshots?: NarrativeScreenshot[]
  /** Architecture diagram (Mermaid source or image URL) */
  architecture?: string
  /** Specific tech decisions worth calling out */
  techHighlights?: string[]
  /** Demo URL override (if different from project.demo_url) */
  demoUrl?: string
  /** Interactive data visualizations */
  charts?: NarrativeChart[]
  /** Per-project visual theme */
  theme?: NarrativeTheme
  /** Prominent finding/result callout cards */
  callouts?: NarrativeCallout[]
  /** Visual pipeline steps */
  pipelineSteps?: NarrativePipelineStep[]
  /** Path to demo video/webp recording */
  demoVideo?: string
  /** URL for inline iframe embed (compact preview) */
  embedUrl?: string
}

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
  /** AI-generated structured project narrative */
  structured_narrative?: StructuredNarrative | null
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
  /** Headshot URL for hero section */
  photo_url?: string
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

export type JobSource =
  | 'manual'
  | 'greenhouse'
  | 'lever'
  | 'usajobs'
  | 'workday'
  | 'ashby'
  | 'smartrecruiters'
  | 'icims'
  | 'workable'
  | 'jobvite'
  | 'adzuna'
  | 'google_jobs'
export type JobRemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown'
export type JobSearchSource = Exclude<JobSource, 'manual'>
export type JobSyncSource = JobSearchSource | 'generic'
export type CompanyWatchlistSourceHint = 'auto' | Exclude<JobSearchSource, 'usajobs'> | 'generic'
export type JobDiscoveryStatus = 'manual' | 'discovered' | 'snapshot' | 'unsupported' | 'error'
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
  watchlist_id: string | null
  saved_job_search_id: string | null
  query_label: string
  title: string
  company: string
  location: string
  remote_type: JobRemoteType
  employment_type: string
  salary_range: string
  job_url: string
  description: string
  fit_notes: string
  discovery_status: JobDiscoveryStatus
  source_text: string
  embedding_updated_at: string | null
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

export interface SavedJobSearch {
  id: string
  name: string
  source: JobSearchSource
  board_or_site: string
  query: string
  location: string
  remote_only: boolean
  result_limit: number
  is_enabled: boolean
  last_run_at: string | null
  last_error: string
  created_at: string
  updated_at: string
}

export interface SavedJobSearchInput {
  name: string
  source: JobSearchSource
  board_or_site: string
  query: string
  location: string
  remote_only: boolean
  result_limit: number
}

export type SavedJobSearchPatch = Partial<
  SavedJobSearchInput &
    Pick<SavedJobSearch, 'is_enabled' | 'last_run_at' | 'last_error'>
>

export type JobSyncRunMode = 'single' | 'enabled_batch'
export type JobSyncRunStatus = 'running' | 'success' | 'error'

export interface JobSyncRun {
  id: string
  saved_job_search_id: string | null
  watchlist_id: string | null
  run_mode: JobSyncRunMode
  status: JobSyncRunStatus
  source: JobSyncSource
  label: string
  board_or_site: string
  query: string
  location: string
  discovery_status: string
  discovered_source: string
  failure_stage: string
  result_count: number
  imported_count: number
  error_message: string
  metadata: Record<string, unknown>
  started_at: string
  completed_at: string | null
}

export interface JobSyncRunInput {
  saved_job_search_id: string | null
  watchlist_id: string | null
  run_mode: JobSyncRunMode
  status: JobSyncRunStatus
  source: JobSyncSource
  label: string
  board_or_site: string
  query: string
  location: string
  discovery_status: string
  discovered_source: string
  failure_stage: string
  result_count: number
  imported_count: number
  error_message: string
  metadata: Record<string, unknown>
  started_at?: string
  completed_at: string | null
}

export interface CandidateEvidenceItem {
  id: string
  source_kind: 'skill' | 'project' | 'resume_summary' | 'resume_bullet' | 'custom_experience'
  source_id: string
  label: string
  content: string
  embedding_updated_at: string | null
  created_at: string
  updated_at: string
}

export interface JobMatch {
  id: string
  job_posting_id: string
  best_evidence_item_id: string | null
  semantic_score: number
  keyword_score: number
  preference_score: number
  total_score: number
  band: 'strong' | 'review' | 'low'
  reason_summary: string
  best_evidence_label: string
  matched_skill_names: string[]
  matched_project_titles: string[]
  matched_keywords: string[]
  missing_signals: string[]
  evidence_item_ids: string[]
  refreshed_at: string
  created_at: string
  updated_at: string
}

export interface CompanyWatchlist {
  id: string
  company_name: string
  careers_url: string
  source_hint: CompanyWatchlistSourceHint
  board_or_site: string
  preferred_query: string
  location_hint: string
  priority: 'high' | 'medium' | 'low'
  is_enabled: boolean
  why_this_company: string
  research_notes: string
  recent_news: string
  competitors: string
  salary_notes: string
  last_researched_at: string | null
  last_discovery_at: string | null
  last_sync_at: string | null
  last_error: string
  created_at: string
  updated_at: string
}

export interface CompanyWatchlistInput {
  company_name: string
  careers_url: string
  source_hint: CompanyWatchlist['source_hint']
  board_or_site: string
  preferred_query: string
  location_hint: string
  priority: CompanyWatchlist['priority']
  is_enabled: boolean
  why_this_company: string
  research_notes: string
  recent_news: string
  competitors: string
  salary_notes: string
}

export interface NotificationPreference {
  id: string
  profile_key: string
  email_enabled: boolean
  inbox_enabled: boolean
  strong_match_enabled: boolean
  sync_failure_enabled: boolean
  follow_up_enabled: boolean
  stale_application_enabled: boolean
  weekly_digest_enabled: boolean
  digest_hour: number
  timezone: string
  created_at: string
  updated_at: string
}

export interface NotificationItem {
  id: string
  type: 'strong_match' | 'sync_failure' | 'follow_up_due' | 'contact_follow_up' | 'stale_application' | 'system'
  title: string
  body: string
  link_path: string
  channel: 'inbox' | 'email' | 'both'
  is_read: boolean
  application_id: string | null
  job_posting_id: string | null
  company_watchlist_id: string | null
  contact_id: string | null
  due_at: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export interface ApplicationShareLink {
  id: string
  application_id: string
  resume_variant_id: string | null
  title: string
  expires_at: string
  revoked_at: string | null
  last_accessed_at: string | null
  access_count: number
  created_at: string
  updated_at: string
  share_url?: string
}

export interface CandidateAnswer {
  id: string
  prompt_key: string
  label: string
  category: string
  answer: string
  created_at: string
  updated_at: string
}

export interface InterviewPrepNote {
  id: string
  application_id: string
  generated_summary: string
  talking_points: string[]
  technical_focus: string[]
  recruiter_questions: string[]
  tell_me_about_yourself: string
  notes: string
  created_at: string
  updated_at: string
}

export interface CareerContact {
  id: string
  company_watchlist_id: string | null
  full_name: string
  role_title: string
  organization_name: string
  relationship_kind: 'recruiter' | 'hiring_manager' | 'employee' | 'alumni' | 'referral' | 'networking' | 'other'
  email: string
  linkedin_url: string
  location: string
  introduced_by: string
  notes: string
  next_follow_up_at: string | null
  last_contact_at: string | null
  created_at: string
  updated_at: string
}

export interface CareerContactInput {
  company_watchlist_id: string | null
  full_name: string
  role_title: string
  organization_name: string
  relationship_kind: CareerContact['relationship_kind']
  email: string
  linkedin_url: string
  location: string
  introduced_by: string
  notes: string
  next_follow_up_at: string | null
  last_contact_at: string | null
}

export interface ContactTouchpoint {
  id: string
  application_id: string | null
  contact_id: string | null
  company_watchlist_id: string | null
  company: string
  contact_name: string
  contact_role: string
  channel: 'email' | 'linkedin' | 'phone' | 'referral' | 'other'
  touchpoint_kind: 'outreach' | 'reply' | 'meeting' | 'informational_interview' | 'referral' | 'recruiter_screen' | 'thank_you' | 'note'
  direction: 'outbound' | 'inbound'
  subject: string
  note: string
  occurred_at: string
  next_follow_up_at: string | null
  created_at: string
  updated_at: string
}

export interface ProofOfWorkHighlight {
  id: string
  application_id: string | null
  job_posting_id: string | null
  source_kind: 'project' | 'resume_bullet' | 'custom_experience'
  source_id: string
  title: string
  summary: string
  url: string
  relevance_reason: string
  display_order: number
  created_at: string
  updated_at: string
}
