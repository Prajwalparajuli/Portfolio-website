import { CandidateProfile, JobFitAssessment, JobPosting, Project, Skill } from '@/types'
import { ResumeEducationSection, ResumeVariant } from '@/types/resume'

type ScoreJobFitArgs = {
  job: Pick<JobPosting, 'title' | 'company' | 'description' | 'location' | 'employment_type'>
  skills: Skill[]
  projects: Project[]
  resumeVariant?: ResumeVariant | null
  candidateProfile?: CandidateProfile | null
}

const STOP_WORDS = new Set([
  'about', 'across', 'after', 'against', 'also', 'amp', 'among', 'and', 'are', 'been', 'being',
  'best', 'build', 'building', 'can', 'candidate', 'candidates', 'com', 'company', 'could',
  'data', 'deliver', 'experience', 'for', 'from', 'great', 'have', 'help', 'http', 'https',
  'including', 'into', 'job', 'jobs', 'knowledge', 'looking', 'more', 'must', 'nbsp', 'new',
  'one', 'our', 'people', 'position', 'positions', 'preferred', 'required', 'responsibilities',
  'responsibility', 'role', 'seeking', 'strong', 'support', 'team', 'teams', 'that', 'the',
  'their', 'them', 'they', 'this', 'through', 'using', 'will', 'with', 'work', 'works', 'www',
  'year', 'years', 'you', 'your',
])

const AI_FOCUS_SKILLS = new Set([
  'Computer Vision',
  'Data Science',
  'Deep Learning',
  'Machine Learning',
  'NLP',
  'Python',
  'PyTorch',
  'SQL',
  'TensorFlow',
])

const FRONTEND_FOCUS_SKILLS = new Set([
  'React',
  'TypeScript',
  'UI/UX',
])

const CORE_AI_TITLE_PHRASES = [
  'ai engineer',
  'machine learning engineer',
  'applied ai',
  'applied scientist',
  'research scientist',
  'data scientist',
  'decision scientist',
  'computer vision',
  'nlp',
]

const ADJACENT_ANALYST_TITLE_PHRASES = [
  'data analyst',
  'business intelligence analyst',
  'bi analyst',
  'analytics analyst',
  'operations research analyst',
  'operations analyst',
  'management analyst',
  'management and program analyst',
  'program analyst',
  'business systems analyst',
  'systems analyst',
  'supply chain analyst',
  'logistics analyst',
  'risk analyst',
  'financial analyst',
  'fraud analyst',
  'reporting analyst',
  'process improvement analyst',
  'quality analyst',
  'research analyst',
  'market analyst',
  'economic analyst',
  'quantitative analyst',
]

const OFF_TARGET_ENGINEERING_TITLE_PHRASES = [
  'industrial engineer',
  'process engineer',
  'quality engineer',
  'systems engineer',
  'operations engineer',
  'manufacturing engineer',
  'reliability engineer',
]

const DESCRIPTION_SIGNAL_PHRASES = [
  'artificial intelligence',
  'machine learning',
  'deep learning',
  'data science',
  'data analytics',
  'analytics',
  'business intelligence',
  'sql',
  'python',
  'statistics',
  'statistical modeling',
  'predictive modeling',
  'forecasting',
  'optimization',
  'operations research',
  'decision support',
  'dashboard',
  'reporting',
  'tableau',
  'power bi',
  'looker',
  'supply chain',
  'logistics',
  'risk',
  'risk modeling',
  'fraud',
  'process improvement',
  'quality improvement',
  'simulation',
  'linear programming',
  'regression',
  'model development',
  'algorithms',
  'systems engineering',
  'process engineering',
]

const INDIVIDUAL_CONTRIBUTOR_SIGNAL_PHRASES = [
  'artificial intelligence',
  'machine learning',
  'deep learning',
  'data science',
  'data analytics',
  'sql',
  'python',
  'statistical modeling',
  'predictive modeling',
  'model development',
  'forecasting',
  'optimization',
  'operations research',
  'algorithms',
  'experimentation',
  'data pipeline',
]

const OFF_TARGET_BUSINESS_TITLE_PHRASES = [
  'customer success',
  'marketing',
  'sales',
  'recruit',
  'talent',
  'human resources',
  'budget',
  'accounting',
  'payroll',
  'fp a',
  'accounts payable',
  'accounts receivable',
  'bookkeeper',
  'bookkeeping',
  'tax',
  'auditor',
  'audit',
  'benefits',
  'compensation',
  'success manager',
]

const OFF_TARGET_LEADERSHIP_TITLE_PHRASES = [
  'engineering manager',
  'manager engineering',
  'product operations',
  'product ops',
  'product manager',
  'program manager',
  'technical program manager',
  'operations manager',
]

const GENERIC_CATCHALL_TITLE_PHRASES = [
  "don't see what you're looking for",
  'dont see what youre looking for',
  'general interest',
  'future opportunities',
  'join our talent community',
  'talent community',
]

const OFF_TARGET_BUSINESS_TEXT_PHRASES = [
  'general ledger',
  'journal entry',
  'accounts payable',
  'accounts receivable',
  'bank reconciliation',
  'benefits administration',
  'tax return',
  'payroll processing',
  'sourcing candidates',
  'candidate pipeline',
  'sales quota',
  'pipeline generation',
  'demand generation',
]

const CLINICAL_TITLE_PHRASES = [
  'clinical laboratory',
  'laboratory scientist',
  'clinical scientist',
  'health scientist',
  'public health',
  'medical technologist',
  'medical laboratory',
  'biomedical scientist',
  'environmental health',
  'epidemiologist',
]

const CLINICAL_TEXT_PHRASES = [
  'clinical',
  'laboratory',
  'diagnosis',
  'diagnostic',
  'patient',
  'patients',
  'hospital',
  'healthcare',
  'public health',
  'medical',
  'biomedical',
  'pathology',
  'specimen',
  'disease',
  'epidemiology',
]

const SKILL_SIGNAL_MAP: Record<string, string[]> = {
  'computer vision': ['computer vision', 'vision model', 'image classification', 'object detection'],
  'data science': ['data science', 'data analytics', 'analytics', 'statistical modeling'],
  'deep learning': ['deep learning', 'neural network', 'neural networks', 'representation learning'],
  'jupyter notebook': ['jupyter', 'notebook', 'python notebook'],
  'machine learning': ['machine learning', 'artificial intelligence', 'ai', 'predictive modeling'],
  nlp: ['nlp', 'natural language processing', 'language model', 'text classification'],
  python: ['python', 'pandas', 'numpy', 'scikit', 'sklearn'],
  pytorch: ['pytorch', 'torch'],
  react: ['react', 'reactjs'],
  sql: ['sql', 'postgres', 'postgresql', 'querying'],
  tensorflow: ['tensorflow', 'keras'],
  typescript: ['typescript', 'typed javascript'],
  'ui/ux': ['ui', 'ux', 'user interface', 'user experience', 'design system'],
}

export function scoreJobFit({
  job,
  skills,
  projects,
  resumeVariant,
  candidateProfile,
}: ScoreJobFitArgs): JobFitAssessment {
  const titleText = normalizeText(job.title)
  const jobText = normalizeText(
    [job.title, job.company, job.location, job.employment_type, job.description].join(' ')
  )
  const candidateCorpus = normalizeText(
    buildCandidateCorpus(resumeVariant, projects, skills, candidateProfile)
  )

  const matchedSkills = findSkillMatches(skills, jobText)
  const projectEvidence = collectProjectEvidence(projects, jobText)
  const matchedProjects = projectEvidence
    .map((item) => item.title)
    .slice(0, 4)
  const projectEvidenceUnits = Math.min(
    6,
    projectEvidence
      .slice(0, 3)
      .reduce((sum, item) => sum + item.unit, 0)
  )

  const matchedKeywords = dedupeTerms([
    ...DESCRIPTION_SIGNAL_PHRASES.filter(
      (phrase) => includesPhrase(jobText, phrase) && includesPhrase(candidateCorpus, phrase)
    ),
    ...extractKeywords(jobText, 16).filter((keyword) => includesPhrase(candidateCorpus, keyword)),
  ]).slice(0, 6)

  const titleAlignmentScore = computeTitleAlignment(
    titleText,
    jobText,
    matchedSkills,
    matchedProjects,
    matchedKeywords
  )
  const offTargetDomainPenalty = computeOffTargetDomainPenalty(titleText, jobText)
  const score = Math.min(
    100,
    Math.max(
      0,
      matchedSkills.length * 8 +
        projectEvidenceUnits * 8 +
        matchedKeywords.length * 4 +
        titleAlignmentScore -
        offTargetDomainPenalty
    )
  )

  const band = score >= 68 ? 'strong' : score >= 40 ? 'review' : 'low'
  const summary = buildSummary({ matchedSkills, matchedProjects, matchedKeywords, band })

  return {
    score,
    band,
    matchedSkills,
    matchedProjects,
    matchedKeywords,
    summary,
  }
}

function findSkillMatches(skills: Skill[], jobText: string): string[] {
  return skills
    .map((skill) => ({
      name: skill.name.trim(),
      signals: [skill.name, ...getSkillSignals(skill.name)],
    }))
    .filter(({ name, signals }) =>
      name.length > 1 && signals.some((signal) => includesPhrase(jobText, signal))
    )
    .map(({ name }) => name)
    .slice(0, 8)
}

function collectProjectEvidence(projects: Project[], jobText: string) {
  return projects
    .map((project) => summarizeProjectEvidence(project, jobText))
    .filter((item) => item.unit > 0)
    .sort((left, right) =>
      right.unit - left.unit ||
      right.rawScore - left.rawScore ||
      left.title.localeCompare(right.title)
    )
}

function summarizeProjectEvidence(project: Project, jobText: string) {
  const normalizedJobText = normalizeText(jobText)
  const jobKeywords = extractKeywords(normalizedJobText, 16)
  const projectCorpus = buildProjectCorpus(project)
  const projectKeywords = extractKeywords(projectCorpus, 16)

  const tagHits = project.tags.filter((tag) => includesPhrase(normalizedJobText, tag)).length
  const titleKeywords = extractKeywords(normalizeText(project.title), 8)
  const titleHitCount = titleKeywords.filter((keyword) => includesPhrase(normalizedJobText, keyword)).length
  const descriptionOverlap = projectKeywords.filter((keyword) => jobKeywords.includes(keyword)).length
  const descriptionSignalHits = DESCRIPTION_SIGNAL_PHRASES.filter(
    (phrase) => includesPhrase(normalizedJobText, phrase) && includesPhrase(projectCorpus, phrase)
  ).length
  const askMeOverlap = typeof project.ask_me_about === 'string'
    ? extractKeywords(normalizeText(project.ask_me_about), 8)
      .filter((keyword) => jobKeywords.includes(keyword)).length
    : 0

  const rawScore =
    tagHits * 3 +
    titleHitCount * 2 +
    Math.min(descriptionOverlap, 5) * 2 +
    Math.min(descriptionSignalHits, 4) * 3 +
    Math.min(askMeOverlap, 3) * 2

  let unit = 0

  if (rawScore >= 14 || descriptionSignalHits >= 3) {
    unit = 3
  } else if (rawScore >= 8 || descriptionSignalHits >= 2) {
    unit = 2
  } else if (rawScore >= 4) {
    unit = 1
  }

  return {
    title: project.title,
    rawScore,
    unit,
  }
}

function buildCandidateCorpus(
  resumeVariant: ResumeVariant | null | undefined,
  projects: Project[],
  skills: Skill[],
  candidateProfile: CandidateProfile | null | undefined
) {
  const skillText = skills
    .map((skill) => [skill.name, ...getSkillSignals(skill.name)].join(' '))
    .join(' ')

  const projectText = projects
    .map((project) => buildProjectCorpus(project))
    .join(' ')

  const resumeText = buildResumeCorpus(resumeVariant, projects, candidateProfile)

  return `${skillText} ${projectText} ${resumeText}`
}

function buildProjectCorpus(project: Project): string {
  return normalizeText([
    project.title,
    project.tags.join(' '),
    stripHtml(project.description),
    typeof project.ask_me_about === 'string' ? project.ask_me_about : '',
  ].join(' '))
}

function buildResumeCorpus(
  resumeVariant: ResumeVariant | null | undefined,
  projects: Project[],
  candidateProfile: CandidateProfile | null | undefined
): string {
  if (!resumeVariant) {
    return normalizeText(
      [
        projects.map((project) => buildProjectCorpus(project)).join(' '),
        buildEducationCorpus(undefined, candidateProfile),
      ].join(' ')
    )
  }

  const sectionText = resumeVariant.content.sections
    .map((section) => {
      if (section.type === 'summary') return section.text
      if (section.type === 'experience') {
        return section.items
          .map((item) =>
            item.kind === 'project'
              ? [item.titleOverride, item.subtitle, item.org, item.bullets.join(' ')].join(' ')
              : [item.role, item.subtitle, item.org, item.bullets.join(' ')].join(' ')
          )
          .join(' ')
      }
      return ''
    })
    .join(' ')

  return normalizeText([
    resumeVariant.content.header.name,
    resumeVariant.content.header.contactLine,
    sectionText,
    buildEducationCorpus(resumeVariant, candidateProfile),
  ].join(' '))
}

function buildEducationCorpus(
  resumeVariant: ResumeVariant | null | undefined,
  candidateProfile: CandidateProfile | null | undefined
): string {
  const entries = selectEducationEntries(resumeVariant, candidateProfile)
  return normalizeText(
    entries
      .map((entry) => [entry.title, entry.issuer, entry.date].join(' '))
      .join(' ')
  )
}

function selectEducationEntries(
  resumeVariant: ResumeVariant | null | undefined,
  candidateProfile: CandidateProfile | null | undefined
) {
  const entries = candidateProfile?.education ?? []
  if (entries.length === 0) return []

  const educationSection = resumeVariant?.content.sections.find(
    (section): section is ResumeEducationSection => section.type === 'education'
  )

  if (educationSection?.includedIndices.length) {
    return educationSection.includedIndices
      .map((index) => entries[index])
      .filter(Boolean)
  }

  return entries
}

function computeTitleAlignment(
  jobTitle: string,
  jobText: string,
  matchedSkills: string[],
  matchedProjects: string[],
  matchedKeywords: string[]
): number {
  const evidenceCount = matchedSkills.length + matchedProjects.length + matchedKeywords.length
  const contextHits = countPhraseMatches(jobText, DESCRIPTION_SIGNAL_PHRASES)
  const icSignalHits = countPhraseMatches(jobText, INDIVIDUAL_CONTRIBUTOR_SIGNAL_PHRASES)
  const leadershipRole = hasAnyPhrase(jobTitle, OFF_TARGET_LEADERSHIP_TITLE_PHRASES)
  let score = 0

  if (
    hasAnyPhrase(jobTitle, CORE_AI_TITLE_PHRASES) &&
    (matchedSkills.some((skill) => AI_FOCUS_SKILLS.has(skill)) || contextHits >= 2)
  ) {
    score += 10
  }

  if (
    hasAnyPhrase(jobTitle, ADJACENT_ANALYST_TITLE_PHRASES) &&
    contextHits >= 2 &&
    evidenceCount >= 2
  ) {
    score += 6
  }

  if (
    hasAnyPhrase(jobTitle, ['frontend', 'front end', 'react', 'ui', 'ux', 'web']) &&
    matchedSkills.some((skill) => FRONTEND_FOCUS_SKILLS.has(skill))
  ) {
    score += 8
  }

  if (/\banalyst\b/i.test(jobTitle) && contextHits >= 3 && evidenceCount >= 3) {
    score += 4
  } else if (/\banalyst\b/i.test(jobTitle) && contextHits >= 2 && evidenceCount >= 2) {
    score += 2
  }

  if (
    /(engineer|scientist)\b/i.test(jobTitle) &&
    !leadershipRole &&
    !hasAnyPhrase(jobTitle, OFF_TARGET_ENGINEERING_TITLE_PHRASES) &&
    matchedProjects.length > 0 &&
    (contextHits >= 1 || icSignalHits >= 2)
  ) {
    score += 2
  }

  if (contextHits >= 5 && evidenceCount >= 3) {
    score += 2
  }

  return score
}

function computeOffTargetDomainPenalty(jobTitle: string, jobText: string): number {
  const targetTitleHits = countPhraseMatches(jobTitle, [
    ...CORE_AI_TITLE_PHRASES,
    ...ADJACENT_ANALYST_TITLE_PHRASES,
  ])
  const targetTextHits = countPhraseMatches(jobText, DESCRIPTION_SIGNAL_PHRASES)
  const icSignalHits = countPhraseMatches(jobText, INDIVIDUAL_CONTRIBUTOR_SIGNAL_PHRASES)
  const offTargetBusinessTitleHits = countPhraseMatches(jobTitle, OFF_TARGET_BUSINESS_TITLE_PHRASES)
  const offTargetLeadershipTitleHits = countPhraseMatches(jobTitle, OFF_TARGET_LEADERSHIP_TITLE_PHRASES)
  const offTargetEngineeringTitleHits = countPhraseMatches(jobTitle, OFF_TARGET_ENGINEERING_TITLE_PHRASES)
  const catchallTitleHits = countPhraseMatches(jobTitle, GENERIC_CATCHALL_TITLE_PHRASES)
  const offTargetBusinessTextHits = countPhraseMatches(jobText, OFF_TARGET_BUSINESS_TEXT_PHRASES)
  const clinicalTitleHits = countPhraseMatches(jobTitle, CLINICAL_TITLE_PHRASES)
  const clinicalTextHits = countPhraseMatches(jobText, CLINICAL_TEXT_PHRASES)

  let penalty = 0

  if (offTargetBusinessTitleHits > 0 && targetTextHits <= 1) {
    penalty += 14
  } else if (offTargetBusinessTitleHits > 0 && targetTextHits <= 2) {
    penalty += 6
  }

  if (offTargetBusinessTextHits >= 2 && targetTextHits === 0) {
    penalty += 6
  }

  if (offTargetEngineeringTitleHits > 0 && icSignalHits <= 1) {
    penalty += 16
  } else if (offTargetEngineeringTitleHits > 0 && targetTextHits <= 2) {
    penalty += 10
  } else if (offTargetEngineeringTitleHits > 0 && targetTextHits <= 4) {
    penalty += 5
  }

  if (offTargetLeadershipTitleHits > 0 && icSignalHits <= 1) {
    penalty += 16
  } else if (offTargetLeadershipTitleHits > 0 && icSignalHits <= 2) {
    penalty += 10
  } else if (offTargetLeadershipTitleHits > 0 && targetTextHits <= 3) {
    penalty += 5
  }

  if (clinicalTitleHits > 0 && targetTitleHits === 0) {
    penalty += 14
  }

  if (clinicalTextHits >= 3 && targetTextHits <= 1) {
    penalty += 8
  } else if (clinicalTextHits >= 2 && targetTextHits <= 2) {
    penalty += 4
  }

  if (/\bscientist\b/i.test(jobTitle) && clinicalTitleHits > 0 && targetTitleHits === 0) {
    penalty += 4
  }

  if (catchallTitleHits > 0) {
    penalty += 20
  }

  if (
    /\bmanager\b/i.test(jobTitle) &&
    targetTextHits <= 1
  ) {
    penalty += 4
  }

  return penalty
}

function buildSummary({
  matchedSkills,
  matchedProjects,
  matchedKeywords,
  band,
}: {
  matchedSkills: string[]
  matchedProjects: string[]
  matchedKeywords: string[]
  band: JobFitAssessment['band']
}): string {
  const fragments: string[] = []

  if (matchedSkills.length > 0) {
    fragments.push(`Skill overlap: ${matchedSkills.slice(0, 3).join(', ')}`)
  }

  if (matchedProjects.length > 0) {
    fragments.push(`Project proof: ${matchedProjects.slice(0, 2).join(', ')}`)
  }

  if (matchedKeywords.length > 0) {
    fragments.push(`Resume keywords: ${matchedKeywords.slice(0, 3).join(', ')}`)
  }

  if (fragments.length === 0) {
    return band === 'low'
      ? 'Low direct overlap right now. Keep this only if the role is strategically important.'
      : 'Some overlap exists, but the current portfolio does not strongly mirror the posting yet.'
  }

  return fragments.join(' | ')
}

function getSkillSignals(skillName: string): string[] {
  return SKILL_SIGNAL_MAP[normalizeText(skillName)] ?? []
}

function extractKeywords(text: string, limit: number): string[] {
  const counts = new Map<string, number>()

  for (const token of normalizeText(text).split(/\s+/)) {
    const word = token.trim().toLowerCase()
    if (word.length < 3 || STOP_WORDS.has(word) || /^\d+$/.test(word)) continue
    counts.set(word, (counts.get(word) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word)
}

function dedupeTerms(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter((value) => value.length > 2)))
}

function includesPhrase(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeText(needle)
  if (!normalizedNeedle) return false

  const escaped = normalizedNeedle
    .split(/\s+/)
    .map(escapeRegExp)
    .join('\\s+')

  return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack)
}

function hasAnyPhrase(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => includesPhrase(haystack, needle))
}

function countPhraseMatches(haystack: string, needles: string[]): number {
  return needles.filter((needle) => includesPhrase(haystack, needle)).length
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ')
}

function normalizeText(value: string): string {
  return stripHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
