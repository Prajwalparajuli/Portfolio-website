/**
 * Fetch public GitHub repo metadata and README for pre-filling project form.
 * No auth required for public repos (rate limit 60/hr per IP).
 */

import { marked } from 'marked'
import DOMPurify from 'dompurify'

export interface GitHubProjectData {
  title: string
  description: string
  slug: string
  tags: string[]
  github_url: string
  demo_url: string | null
}

const GITHUB_API = 'https://api.github.com'
const README_MAX_CHARS = 12_000

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim()
  const patterns = [
    /github\.com\/([^/]+)\/([^/?#]+?)(?:\.git)?(?:[/?#].*)?$/i,
    /git@github\.com:([^/]+)\/([^/?#]+?)(?:\.git)?$/i,
  ]

  const match = patterns
    .map((pattern) => trimmed.match(pattern))
    .find(Boolean)

  if (!match) return null

  const [, owner, repo] = match
  const cleanRepo = repo.replace(/\.git$/, '')
  return owner && cleanRepo ? { owner, repo: cleanRepo } : null
}

function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function titleFromRepoName(repo: string): string {
  const cleaned = repo.replace(/[-_]+/g, ' ').trim()
  if (!cleaned) return repo
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase())
}

/** Convert markdown to sanitized HTML for TipTap/description. */
function markdownToHtml(md: string): string {
  const truncated = md.length > README_MAX_CHARS ? md.slice(0, README_MAX_CHARS) + '\n\n...' : md
  const rawHtml = marked.parse(truncated, { async: false }) as string
  return sanitizeProjectHtml(rawHtml)
}

function renderMarkdownFragment(md: string): string {
  const rawHtml = marked.parse(md, { async: false }) as string
  return sanitizeProjectHtml(rawHtml)
}

function sanitizeProjectHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'blockquote', 'hr'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })
}

export async function fetchProjectFromGitHubUrl(repoUrl: string): Promise<GitHubProjectData> {
  const parsed = parseRepoUrl(repoUrl)
  if (!parsed) throw new Error('Invalid GitHub repo URL. Use format: https://github.com/owner/repo')

  const { owner, repo } = parsed
  const repoRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  })
  if (!repoRes.ok) {
    if (repoRes.status === 404) throw new Error('Repository not found or private.')
    if (repoRes.status === 403) {
      const body = await repoRes.json().catch(() => null) as { message?: string } | null
      throw new Error(body?.message?.includes('rate limit')
        ? 'GitHub rate limit reached. Wait a bit and try again.'
        : 'GitHub blocked the request. Try again in a moment.')
    }
    throw new Error(`GitHub API error: ${repoRes.status}`)
  }

  const repoData = await repoRes.json() as {
    name?: string
    html_url?: string
    homepage?: string | null
    description?: string | null
    topics?: string[]
    language?: string | null
  }

  const title = titleFromRepoName(repoData.name || repo)
  const slug = slugFromTitle(title)
  const github_url = repoData.html_url || `https://github.com/${owner}/${repo}`
  const demo_url = normalizeHomepageUrl(repoData.homepage)

  let description = repoData.description ? `<p>${escapeHtml(repoData.description)}</p>` : ''
  let tags = normalizeTagsFromRepo(repoData)
  const readmePreview = await fetchReadme(owner, repo)

  if (readmePreview) {
    description = buildSmartProjectDescription({
      repoDescription: repoData.description ?? '',
      readme: readmePreview,
      tags,
    })
    tags = extendTagsFromReadme(readmePreview.slice(0, 2048), tags)
  } else if (!description) {
    description = '<p>No description.</p>'
  }

  return {
    title,
    description,
    slug,
    tags,
    github_url,
    demo_url,
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Normalize and merge topics + language; dedupe and capitalize. */
function normalizeTagsFromRepo(repoData: { topics?: string[]; language?: string | null }): string[] {
  const raw = [
    ...(Array.isArray(repoData.topics) ? repoData.topics : []),
    ...(repoData.language ? [repoData.language] : []),
  ]
  const seen = new Set<string>()
  return raw
    .map((t) => capitalizeTag(t.trim()))
    .filter((t) => {
      if (!t) return false
      const key = t.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function capitalizeTag(t: string): string {
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

function normalizeHomepageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(trimmed)) return `https://${trimmed}`
  return null
}

function extractReadmePreview(readme: string): string {
  const normalized = readme.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const filtered = lines.filter((line) => {
    const trimmed = line.trim()
    if (!trimmed) return true
    if (/^\[!\[.*\]\(.*\)\]\(.*\)$/.test(trimmed)) return false
    if (/^!\[.*\]\(.*\)$/.test(trimmed)) return false
    if (/^<img\b/i.test(trimmed)) return false
    return true
  })

  const preview = filtered.join('\n').trim()
  return preview.length > README_MAX_CHARS ? `${preview.slice(0, README_MAX_CHARS)}\n\n...` : preview
}

type ProjectDescriptionInput = {
  repoDescription: string
  readme: string
  tags: string[]
}

type ReadmeSection = {
  title: string
  body: string
}

const SKIP_README_SECTIONS = [
  'installation',
  'setup',
  'usage',
  'getting started',
  'quick start',
  'prerequisites',
  'requirements',
  'license',
  'contributing',
  'acknowledgements',
  'acknowledgments',
  'roadmap',
  'deployment',
  'development',
  'testing',
  'how to run',
  'run locally',
  'table of contents',
] as const

const SECTION_TITLE_MAP: Array<[RegExp, string]> = [
  [/^(overview|about|introduction|summary|abstract)$/i, 'Overview'],
  [/^(features|highlights|key features|what it does)$/i, 'Key Features'],
  [/^(results|impact|outcomes?|performance|evaluation)$/i, 'Results'],
  [/^(approach|methodology|architecture|pipeline|how it works)$/i, 'Approach'],
  [/^(data|dataset|datasets)$/i, 'Data'],
  [/^(tech stack|technologies|stack|tools)$/i, 'Technologies'],
]

function buildSmartProjectDescription({
  repoDescription,
  readme,
  tags,
}: ProjectDescriptionInput): string {
  const preview = extractReadmePreview(readme)
  const { intro, sections } = extractRelevantReadmeSections(preview)

  const htmlParts: string[] = []
  const overviewSource = intro || repoDescription.trim()

  if (overviewSource) {
    htmlParts.push(`<h2>Overview</h2>${renderMarkdownFragment(overviewSource)}`)
  }

  for (const section of sections.slice(0, 3)) {
    htmlParts.push(`<h3>${escapeHtml(section.title)}</h3>${renderMarkdownFragment(section.body)}`)
  }

  const hasTechnologiesSection = sections.some((section) => section.title === 'Technologies')
  if (!hasTechnologiesSection && tags.length > 0) {
    htmlParts.push(`<h3>Technologies</h3><p>${escapeHtml(tags.join(', '))}</p>`)
  }

  if (htmlParts.length === 0 && repoDescription.trim()) {
    return `<p>${escapeHtml(repoDescription.trim())}</p>`
  }

  return htmlParts.join('')
}

function extractRelevantReadmeSections(readme: string): { intro: string; sections: ReadmeSection[] } {
  const lines = readme
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !/^```/.test(line.trim()))

  const introLines: string[] = []
  const sections: Array<{ heading: string; lines: string[] }> = []
  let current: { heading: string; lines: string[] } | null = null
  let seenHeading = false

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/)
    if (headingMatch) {
      const heading = headingMatch[1].trim()
      if (!seenHeading && sections.length === 0 && !current && introLines.length === 0) {
        seenHeading = true
        continue
      }
      seenHeading = true
      if (current && current.lines.some((entry) => entry.trim())) {
        sections.push(current)
      }
      current = { heading, lines: [] }
      continue
    }

    if (!seenHeading && !current) {
      introLines.push(line)
      continue
    }

    if (!current) {
      introLines.push(line)
      continue
    }

    current.lines.push(line)
  }

  if (current && current.lines.some((entry) => entry.trim())) {
    sections.push(current)
  }

  const relevantSections = sections
    .map((section) => {
      const normalizedTitle = normalizeReadmeSectionTitle(section.heading)
      const body = section.lines.join('\n').trim()
      return {
        title: normalizedTitle,
        body: trimMarkdownBlock(body, normalizedTitle === 'Key Features' ? 1600 : 1200),
      }
    })
    .filter((section): section is ReadmeSection => Boolean(section.title) && Boolean(section.body))
    .slice(0, 4)

  return {
    intro: trimMarkdownBlock(introLines.join('\n').trim(), 900),
    sections: relevantSections,
  }
}

function normalizeReadmeSectionTitle(title: string): string | null {
  const trimmed = title.trim().toLowerCase()
  if (!trimmed) return null
  if (SKIP_README_SECTIONS.some((label) => trimmed === label)) return null

  for (const [pattern, mappedTitle] of SECTION_TITLE_MAP) {
    if (pattern.test(title.trim())) return mappedTitle
  }

  return null
}

function trimMarkdownBlock(markdown: string, maxChars: number): string {
  const cleaned = markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/<img\b[^>]*>/gi, '')
    .trim()

  if (!cleaned) return ''
  return cleaned.length > maxChars ? `${cleaned.slice(0, maxChars).trim()}\n\n...` : cleaned
}

/** Allow-list of tech terms to detect in README. */
const README_TECH_TERMS = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'Vue', 'Node', 'TensorFlow', 'PyTorch',
  'Machine Learning', 'Deep Learning', 'API', 'REST', 'GraphQL', 'Docker', 'Kubernetes',
  'PostgreSQL', 'MongoDB', 'Redis', 'AWS', 'GCP', 'Rust', 'Go', 'Java', 'C++', 'Swift',
  'Next.js', 'Vite', 'Tailwind', 'Svelte', 'Angular', 'Django', 'Flask', 'FastAPI',
]

/** Scan first ~2KB of README for allow-listed tech terms and add any missing to tags. */
function extendTagsFromReadme(readmeChunk: string, existingTags: string[]): string[] {
  const existingLower = new Set(existingTags.map((t) => t.toLowerCase()))
  const added: string[] = []
  const text = readmeChunk.replace(/[#*`_\[\]()]/g, ' ').toLowerCase()
  for (const term of README_TECH_TERMS) {
    if (existingLower.has(term.toLowerCase())) continue
    const pattern = term.replace(/\s+/g, '\\s+').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp('\\b' + pattern + '\\b', 'i')
    if (re.test(text)) {
      added.push(term)
      existingLower.add(term.toLowerCase())
    }
  }
  return [...existingTags, ...added]
}

/** Fetch README content (full or up to README_MAX_CHARS). */
async function fetchReadme(owner: string, repo: string): Promise<string | null> {
  try {
    const readmeRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/readme`, {
      headers: { Accept: 'application/vnd.github.v3.raw' },
    })
    if (!readmeRes.ok) return null
    return await readmeRes.text()
  } catch {
    return null
  }
}
