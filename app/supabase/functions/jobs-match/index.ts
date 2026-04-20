import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders, getServiceClient, json, requireAdminOrScheduler } from '../_shared/common.ts'

type ProjectRow = {
  id: string
  title: string
  description: string
  tags: string[]
  demo_url: string | null
  github_url: string | null
}

type SkillRow = {
  id: string
  name: string
  category: string
}

type ResumeVariantRow = {
  id: string
  name: string
  is_primary: boolean
  content: {
    header?: {
      name?: string
      contactLine?: string
    }
    sections?: Array<Record<string, unknown>>
  }
}

type JobRow = {
  id: string
  title: string
  company: string
  location: string
  remote_type: string
  employment_type: string
  description: string
  watchlist_id: string | null
  source_text: string
}

type WatchlistRow = {
  id: string
  priority: 'high' | 'medium' | 'low'
}

type CandidateProfileRow = {
  location: string
  education: unknown
}

type EducationEntryRow = {
  title: string
  issuer: string
  date: string
}

type EvidenceRow = {
  id: string
  source_kind: string
  source_id: string
  label: string
  content: string
}

type EvidenceSeedItem = {
  source_kind: string
  source_id: string
  label: string
  content: string
}

type JobFitAssessment = {
  score: number
  band: 'strong' | 'review' | 'low'
  matchedSkills: string[]
  matchedProjects: string[]
  matchedKeywords: string[]
  summary: string
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

const VECTOR_DIMENSIONS = 384

function normalizeText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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

function includesPhrase(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeText(needle)
  if (!normalizedNeedle) return false

  const escaped = normalizedNeedle
    .split(/\s+/)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+')

  return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack)
}

function hasAnyPhrase(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => includesPhrase(haystack, needle))
}

function countPhraseMatches(haystack: string, needles: string[]): number {
  return needles.filter((needle) => includesPhrase(haystack, needle)).length
}

function flattenStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

function parseEducationEntries(value: unknown): EducationEntryRow[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is EducationEntryRow =>
      Boolean(entry) &&
      typeof entry === 'object' &&
      'title' in entry &&
      'issuer' in entry &&
      'date' in entry
  )
}

function getResumeSections(variant: ResumeVariantRow | null) {
  return Array.isArray(variant?.content?.sections) ? variant.content.sections : []
}

function getSkillSignals(skillName: string): string[] {
  return SKILL_SIGNAL_MAP[normalizeText(skillName)] ?? []
}

function buildProjectCorpus(project: ProjectRow): string {
  return normalizeText([
    project.title,
    project.tags.join(' '),
    project.description,
  ].join(' '))
}

function buildResumeCorpus(
  primaryVariant: ResumeVariantRow | null,
  projects: ProjectRow[],
  candidateProfile: CandidateProfileRow | null
) {
  if (!primaryVariant) {
    return normalizeText([
      projects.map((project) => buildProjectCorpus(project)).join(' '),
      buildEducationCorpus(null, candidateProfile),
    ].join(' '))
  }

  const sections = getResumeSections(primaryVariant)
  const sectionText = sections
    .map((section) => {
      if (section.type === 'summary' && typeof section.text === 'string') return section.text
      if (section.type === 'experience' && Array.isArray(section.items)) {
        return section.items
          .map((item) => {
            if (!item || typeof item !== 'object') return ''
            return [
              typeof item.titleOverride === 'string' ? item.titleOverride : '',
              typeof item.role === 'string' ? item.role : '',
              typeof item.subtitle === 'string' ? item.subtitle : '',
              typeof item.org === 'string' ? item.org : '',
              flattenStringArray(item.bullets).join(' '),
            ].join(' ')
          })
          .join(' ')
      }
      return ''
    })
    .join(' ')

  const headerName = primaryVariant.content?.header?.name ?? ''
  const headerContact = primaryVariant.content?.header?.contactLine ?? ''
  return normalizeText([
    headerName,
    headerContact,
    sectionText,
    buildEducationCorpus(primaryVariant, candidateProfile),
  ].join(' '))
}

function buildEducationCorpus(
  primaryVariant: ResumeVariantRow | null,
  candidateProfile: CandidateProfileRow | null
) {
  const entries = selectEducationEntries(primaryVariant, candidateProfile)
  return normalizeText(
    entries
      .map((entry) => [entry.title, entry.issuer, entry.date].join(' '))
      .join(' ')
  )
}

function selectEducationEntries(
  primaryVariant: ResumeVariantRow | null,
  candidateProfile: CandidateProfileRow | null
) {
  const entries = parseEducationEntries(candidateProfile?.education)
  if (entries.length === 0) return []

  const educationSection = getResumeSections(primaryVariant).find(
    (section) =>
      section.type === 'education' &&
      Array.isArray(section.includedIndices) &&
      section.includedIndices.length > 0
  )

  if (educationSection && Array.isArray(educationSection.includedIndices)) {
    return educationSection.includedIndices
      .filter((value): value is number => Number.isInteger(value))
      .map((index) => entries[index])
      .filter(Boolean)
  }

  return entries
}

function buildCandidateCorpus(
  primaryVariant: ResumeVariantRow | null,
  projects: ProjectRow[],
  skills: SkillRow[],
  candidateProfile: CandidateProfileRow | null
) {
  const skillText = skills
    .map((skill) => [skill.name, ...getSkillSignals(skill.name)].join(' '))
    .join(' ')

  const projectText = projects
    .map((project) => buildProjectCorpus(project))
    .join(' ')

  const resumeText = buildResumeCorpus(primaryVariant, projects, candidateProfile)

  return normalizeText(`${skillText} ${projectText} ${resumeText}`)
}

function buildCandidateEvidence(
  skills: SkillRow[],
  projects: ProjectRow[],
  primaryVariant: ResumeVariantRow | null
) {
  const evidence: EvidenceSeedItem[] = []

  for (const skill of skills) {
    evidence.push({
      source_kind: 'skill',
      source_id: skill.id,
      label: skill.name,
      content: [skill.name, skill.category, ...getSkillSignals(skill.name)].join(' '),
    })
  }

  for (const project of projects) {
    evidence.push({
      source_kind: 'project',
      source_id: project.id,
      label: project.title,
      content: buildProjectCorpus(project),
    })
  }

  const sections = getResumeSections(primaryVariant)
  for (const section of sections) {
    if (section.type === 'summary' && typeof section.text === 'string' && section.text.trim()) {
      evidence.push({
        source_kind: 'resume_summary',
        source_id: 'primary-summary',
        label: 'Primary resume summary',
        content: normalizeText(section.text),
      })
    }

    if (section.type === 'experience' && Array.isArray(section.items)) {
      section.items.forEach((item, itemIndex) => {
        if (!item || typeof item !== 'object') return
        const title = typeof item.titleOverride === 'string' && item.titleOverride.trim()
          ? item.titleOverride.trim()
          : typeof item.role === 'string'
            ? item.role.trim()
            : `Experience ${itemIndex + 1}`

        evidence.push({
          source_kind: item.kind === 'project' ? 'resume_bullet' : 'custom_experience',
          source_id: `exp-${itemIndex}`,
          label: title,
          content: [
            title,
            typeof item.subtitle === 'string' ? item.subtitle : '',
            typeof item.org === 'string' ? item.org : '',
            flattenStringArray(item.bullets).join(' '),
          ].join(' '),
        })

        flattenStringArray(item.bullets).forEach((bullet, bulletIndex) => {
          evidence.push({
            source_kind: item.kind === 'project' ? 'resume_bullet' : 'custom_experience',
            source_id: `exp-${itemIndex}-bullet-${bulletIndex}`,
            label: `${title} bullet ${bulletIndex + 1}`,
            content: normalizeText(bullet),
          })
        })
      })
    }
  }

  const unique = new Map<string, EvidenceSeedItem>()

  for (const item of evidence) {
    const content = normalizeText(item.content).slice(0, 1600).trim()
    if (!content) continue

    const key = `${item.source_kind}:${item.source_id}`
    if (!unique.has(key)) {
      unique.set(key, {
        ...item,
        content,
      })
    }
  }

  return [...unique.values()]
}

function extractEmbedding(output: unknown): number[] {
  if (Array.isArray(output) && output.every((entry) => typeof entry === 'number')) {
    return output as number[]
  }

  if (output && typeof output === 'object') {
    const embedding = (output as { embedding?: unknown }).embedding
    if (Array.isArray(embedding) && embedding.every((entry) => typeof entry === 'number')) {
      return embedding as number[]
    }
  }

  throw new Error('Embedding model returned an unexpected output shape.')
}

async function embedText(text: string): Promise<number[]> {
  return extractEmbedding(buildHashedEmbedding(text))
}

async function embedEvidenceItems(evidenceSeed: EvidenceSeedItem[]) {
  const rows: Array<EvidenceSeedItem & { embedding: string; embedding_updated_at: string }> = []

  for (const item of evidenceSeed) {
    rows.push({
      ...item,
      embedding: JSON.stringify(await embedText(item.content)),
      embedding_updated_at: new Date().toISOString(),
    })
  }

  return rows
}

function buildHashedEmbedding(text: string): number[] {
  const tokens = normalizeText(text)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))

  const vector = new Array<number>(VECTOR_DIMENSIONS).fill(0)

  for (const token of tokens) {
    addFeature(vector, token, 1)
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    addFeature(vector, `${tokens[index]} ${tokens[index + 1]}`, 1.5)
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0))
  if (magnitude === 0) return vector

  return vector.map((value) => round(value / magnitude))
}

function addFeature(vector: number[], feature: string, weight: number) {
  const hash = fnv1a(feature)
  const index = Math.abs(hash) % vector.length
  const sign = (hash & 1) === 0 ? 1 : -1
  vector[index] += sign * weight
}

function fnv1a(input: string) {
  let hash = 0x811c9dc5

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function findSkillMatches(skills: SkillRow[], jobText: string): string[] {
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

function collectProjectEvidence(projects: ProjectRow[], jobText: string) {
  return projects
    .map((project) => summarizeProjectEvidence(project, jobText))
    .filter((item) => item.unit > 0)
    .sort((left, right) =>
      right.unit - left.unit ||
      right.rawScore - left.rawScore ||
      left.title.localeCompare(right.title)
    )
}

function summarizeProjectEvidence(project: ProjectRow, jobText: string) {
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

  const rawScore =
    tagHits * 3 +
    titleHitCount * 2 +
    Math.min(descriptionOverlap, 5) * 2 +
    Math.min(descriptionSignalHits, 4) * 3

  let unit = 0

  if (rawScore >= 12 || descriptionSignalHits >= 3) {
    unit = 3
  } else if (rawScore >= 7 || descriptionSignalHits >= 2) {
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
    fragments.push(`Relevant work: ${matchedProjects.slice(0, 2).join(', ')}`)
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

function dedupeTerms(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter((value) => value.length > 2)))
}

function assessJobFit(
  job: JobRow,
  skills: SkillRow[],
  projects: ProjectRow[],
  candidateCorpus: string
): JobFitAssessment {
  const titleText = normalizeText(job.title)
  const jobText = normalizeText([
    job.title,
    job.company,
    job.location,
    job.employment_type,
    job.description,
  ].join(' '))

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
  ])
    .slice(0, 6)

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

  return {
    score,
    band,
    matchedSkills,
    matchedProjects,
    matchedKeywords,
    summary: buildSummary({ matchedSkills, matchedProjects, matchedKeywords, band }),
  }
}

function bandForScore(totalScore: number): 'strong' | 'review' | 'low' {
  if (totalScore >= 65) return 'strong'
  if (totalScore >= 45) return 'review'
  return 'low'
}

function applyRoleSuitabilityCap(jobTitle: string, totalScore: number, fitScore: number) {
  const offTargetLeadership = hasAnyPhrase(jobTitle, OFF_TARGET_LEADERSHIP_TITLE_PHRASES)
  const offTargetEngineering = hasAnyPhrase(jobTitle, OFF_TARGET_ENGINEERING_TITLE_PHRASES)
  const offTargetBusiness = hasAnyPhrase(jobTitle, OFF_TARGET_BUSINESS_TITLE_PHRASES)
  const catchallRole = hasAnyPhrase(jobTitle, GENERIC_CATCHALL_TITLE_PHRASES)

  if (catchallRole && fitScore <= 10) {
    return round(Math.min(totalScore, 10))
  }

  if ((offTargetLeadership || offTargetEngineering || offTargetBusiness) && fitScore <= 10) {
    return round(Math.min(totalScore, fitScore + 6))
  }

  if ((offTargetLeadership || offTargetEngineering) && fitScore <= 20) {
    return round(Math.min(totalScore, fitScore + 4))
  }

  return totalScore
}

function buildReasonSummary(
  fit: JobFitAssessment,
  bestEvidenceLabel: string,
  band: 'strong' | 'review' | 'low'
) {
  const fragments: string[] = []

  if (bestEvidenceLabel && fit.score >= 30) {
    fragments.push(`Lead with ${bestEvidenceLabel}`)
  }

  if (fit.matchedSkills.length > 0) {
    fragments.push(`Skill overlap: ${fit.matchedSkills.slice(0, 3).join(', ')}`)
  }

  if (fit.matchedProjects.length > 0) {
    fragments.push(`Project proof: ${fit.matchedProjects.slice(0, 2).join(', ')}`)
  }

  if (fit.matchedKeywords.length > 0) {
    fragments.push(`Resume keywords: ${fit.matchedKeywords.slice(0, 3).join(', ')}`)
  }

  if (fragments.length === 0) {
    return band === 'low'
      ? 'Low direct overlap right now. Keep this only if the role is strategically important.'
      : 'Some overlap exists, but the current portfolio does not strongly mirror the posting yet.'
  }

  return fragments.join(' | ')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' })
  }

  const auth = await requireAdminOrScheduler(req)
  if (auth.kind === 'unauthorized') {
    if (auth.reason === 'admin-table-missing') {
      return json(503, {
        error: 'Admin access is not configured yet. Run the admin hardening SQL migration and add your email to public.admin_users.',
      })
    }
    return json(403, { error: 'Authenticated admin access required.' })
  }

  try {
    const body = await req.json().catch(() => ({})) as { jobIds?: string[] }
    const targetIds = Array.isArray(body.jobIds) ? body.jobIds.filter((value) => typeof value === 'string' && value.length > 0) : []
    const service = getServiceClient()

    const [
      jobsResponse,
      skillsResponse,
      projectsResponse,
      resumeResponse,
      watchlistsResponse,
      profileResponse,
    ] = await Promise.all([
      targetIds.length > 0
        ? service.from('job_postings').select('*').in('id', targetIds).is('archived_at', null)
        : service.from('job_postings').select('*').is('archived_at', null),
      service.from('skills').select('id,name,category'),
      service.from('projects').select('id,title,description,tags,demo_url,github_url'),
      service.from('resume_variants').select('id,name,is_primary,content').eq('is_primary', true).limit(1).maybeSingle(),
      service.from('company_watchlists').select('id,priority'),
      service.from('candidate_profiles').select('location,education').eq('profile_key', 'primary').maybeSingle(),
    ])

    if (jobsResponse.error) throw jobsResponse.error
    if (skillsResponse.error) throw skillsResponse.error
    if (projectsResponse.error) throw projectsResponse.error
    if (resumeResponse.error) throw resumeResponse.error
    if (watchlistsResponse.error) throw watchlistsResponse.error
    if (profileResponse.error) throw profileResponse.error

    const jobs = (jobsResponse.data ?? []) as JobRow[]
    const skills = (skillsResponse.data ?? []) as SkillRow[]
    const projects = (projectsResponse.data ?? []) as ProjectRow[]
    const primaryVariant = resumeResponse.data as ResumeVariantRow | null
    const watchlists = new Map(((watchlistsResponse.data ?? []) as WatchlistRow[]).map((row) => [row.id, row]))
    const candidateProfile = profileResponse.data as CandidateProfileRow | null
    const candidateLocation = (candidateProfile?.location ?? '').trim()
    const candidateCorpus = buildCandidateCorpus(primaryVariant, projects, skills, candidateProfile)

    const evidenceSeed = buildCandidateEvidence(skills, projects, primaryVariant)
    const evidenceWithEmbeddings = await embedEvidenceItems(evidenceSeed)

    const evidenceUpsert = await service
      .from('candidate_evidence_items')
      .upsert(evidenceWithEmbeddings, { onConflict: 'source_kind,source_id' })
      .select('id,source_kind,source_id,label,content')

    if (evidenceUpsert.error) throw evidenceUpsert.error
    const evidenceRows = (evidenceUpsert.data ?? []) as EvidenceRow[]

    let matchesUpdated = 0

    for (const job of jobs) {
      const sourceText = normalizeText([
        job.title,
        job.company,
        job.location,
        job.employment_type,
        job.description,
      ].join(' '))

      const jobEmbedding = await embedText(sourceText)
      const relatedEvidence = await service.rpc('query_candidate_evidence', {
        match_embedding: JSON.stringify(jobEmbedding),
        match_count: 5,
      })
      if (relatedEvidence.error) throw relatedEvidence.error

      const fit = assessJobFit(job, skills, projects, candidateCorpus)
      const nearest = (relatedEvidence.data ?? []) as Array<EvidenceRow & { similarity: number }>
      const bestEvidence = nearest[0] ?? null
      const topSimilarities = nearest.slice(0, 3).map((item) => Number(item.similarity ?? 0))
      const vectorSemanticScore = round(
        Math.max(0, Math.min(100, (
          (topSimilarities.reduce((sum, value) => sum + value, 0) / Math.max(topSimilarities.length, 1)) * 100
        )))
      )
      const semanticScore = round(
        Math.max(vectorSemanticScore, Math.min(100, fit.score * 0.85))
      )
      const keywordScore = round(Math.min(100, fit.score))

      const missingSignals = extractKeywords(sourceText, 12)
        .filter((keyword) => !fit.matchedKeywords.includes(keyword))
        .slice(0, 6)

      const priority = job.watchlist_id ? watchlists.get(job.watchlist_id)?.priority ?? 'medium' : 'medium'
      const priorityScore = priority === 'high' ? 100 : priority === 'low' ? 45 : 70
      const locationScore =
        job.remote_type === 'remote'
          ? 95
          : candidateLocation && includesPhrase(normalizeText(job.location), candidateLocation)
            ? 85
            : 55
      const preferenceScore = round((priorityScore * 0.6) + (locationScore * 0.4))
      const totalScore = applyRoleSuitabilityCap(
        normalizeText(job.title),
        round((semanticScore * 0.45) + (keywordScore * 0.35) + (preferenceScore * 0.2)),
        fit.score
      )
      const band = bandForScore(totalScore)
      const bestEvidenceLabel = fit.score >= 30 ? bestEvidence?.label ?? '' : ''
      const summary = buildReasonSummary(fit, bestEvidenceLabel, band)

      const updateJob = await service
        .from('job_postings')
        .update({
          source_text: sourceText,
          embedding: JSON.stringify(jobEmbedding),
          embedding_updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
      if (updateJob.error) throw updateJob.error

      const matchUpsert = await service
        .from('job_matches')
        .upsert({
          job_posting_id: job.id,
          best_evidence_item_id: bestEvidence?.id ?? null,
          semantic_score: semanticScore,
          keyword_score: keywordScore,
          preference_score: preferenceScore,
          total_score: totalScore,
          band,
          reason_summary: summary,
          best_evidence_label: bestEvidenceLabel,
          matched_skill_names: fit.matchedSkills,
          matched_project_titles: fit.matchedProjects,
          matched_keywords: fit.matchedKeywords,
          missing_signals: missingSignals,
          evidence_item_ids: nearest.map((item) => item.id),
          refreshed_at: new Date().toISOString(),
        }, { onConflict: 'job_posting_id' })
      if (matchUpsert.error) throw matchUpsert.error

      const deleteHighlights = await service
        .from('proof_of_work_highlights')
        .delete()
        .eq('job_posting_id', job.id)
        .is('application_id', null)
      if (deleteHighlights.error) throw deleteHighlights.error

      const highlightRows = nearest
        .filter((item) => item.source_kind === 'project' || item.source_kind === 'resume_bullet' || item.source_kind === 'custom_experience')
        .slice(0, 3)
        .map((item, index) => {
          const project = projects.find((entry) => entry.id === item.source_id)
          return {
            application_id: null,
            job_posting_id: job.id,
            source_kind: item.source_kind === 'project' ? 'project' : item.source_kind === 'resume_bullet' ? 'resume_bullet' : 'custom_experience',
            source_id: item.source_id,
            title: item.label,
            summary: item.content.slice(0, 280),
            url: project?.demo_url ?? project?.github_url ?? '',
            relevance_reason: fit.score >= 40
              ? `Strong supporting evidence for ${job.title}.`
              : `Potential supporting evidence for ${job.title}.`,
            display_order: index,
          }
        })

      if (highlightRows.length > 0) {
        const insertHighlights = await service
          .from('proof_of_work_highlights')
          .insert(highlightRows)
        if (insertHighlights.error) throw insertHighlights.error
      }

      matchesUpdated += 1
    }

    return json(200, {
      data: {
        jobsProcessed: jobs.length,
        evidenceCount: evidenceRows.length,
        matchesUpdated,
      },
    })
  } catch (error) {
    console.error('jobs-match error', error)
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return json(500, { error: message })
  }
})
