import { JobFitAssessment, JobPosting, Project, Skill } from '@/types'
import { ResumeVariant } from '@/types/resume'

type ScoreJobFitArgs = {
  job: Pick<JobPosting, 'title' | 'company' | 'description' | 'location' | 'employment_type'>
  skills: Skill[]
  projects: Project[]
  resumeVariant?: ResumeVariant | null
}

const STOP_WORDS = new Set([
  'about', 'after', 'against', 'also', 'among', 'and', 'are', 'been', 'being', 'build',
  'building', 'candidate', 'candidates', 'company', 'could', 'data', 'deliver', 'for', 'from',
  'have', 'help', 'into', 'join', 'looking', 'more', 'must', 'our', 'role', 'team', 'that',
  'the', 'their', 'them', 'they', 'this', 'through', 'using', 'with', 'work', 'works', 'you',
  'your',
])

export function scoreJobFit({
  job,
  skills,
  projects,
  resumeVariant,
}: ScoreJobFitArgs): JobFitAssessment {
  const jobText = normalizeText(
    [job.title, job.company, job.location, job.employment_type, job.description].join(' ')
  )

  const matchedSkills = skills
    .map((skill) => skill.name.trim())
    .filter((skill) => skill.length > 1 && includesPhrase(jobText, skill))
    .slice(0, 8)

  const matchedProjects = projects
    .filter((project) => projectMatchesJob(project, jobText))
    .map((project) => project.title)
    .slice(0, 4)

  const jobKeywords = extractKeywords(jobText, 12)
  const resumeCorpus = normalizeText(buildResumeCorpus(resumeVariant, projects))
  const matchedKeywords = jobKeywords
    .filter((keyword) => includesPhrase(resumeCorpus, keyword))
    .slice(0, 6)

  const score = Math.min(
    100,
    matchedSkills.length * 10 + matchedProjects.length * 12 + matchedKeywords.length * 4
  )

  const band = score >= 75 ? 'strong' : score >= 55 ? 'review' : 'low'
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

function projectMatchesJob(project: Project, jobText: string): boolean {
  const tagHit = project.tags.some((tag) => includesPhrase(jobText, tag))
  const titleKeywords = extractKeywords(normalizeText(project.title), 6)
  const titleHitCount = titleKeywords.filter((keyword) => includesPhrase(jobText, keyword)).length
  const promptHit =
    typeof project.ask_me_about === 'string' &&
    extractKeywords(normalizeText(project.ask_me_about), 4).some((keyword) =>
      includesPhrase(jobText, keyword)
    )

  return tagHit || titleHitCount >= 2 || promptHit
}

function buildResumeCorpus(resumeVariant: ResumeVariant | null | undefined, projects: Project[]): string {
  if (!resumeVariant) {
    return projects
      .map((project) => [project.title, project.tags.join(' '), stripHtml(project.description)].join(' '))
      .join(' ')
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

  return `${resumeVariant.content.header.name} ${resumeVariant.content.header.contactLine} ${sectionText}`
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

  return fragments.join(' • ')
}

function extractKeywords(text: string, limit: number): string[] {
  const counts = new Map<string, number>()

  for (const token of text.split(/\s+/)) {
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
    .map(escapeRegExp)
    .join('\\s+')

  return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack)
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
