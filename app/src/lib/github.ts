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
}

const GITHUB_API = 'https://api.github.com'
const README_MAX_CHARS = 12_000

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim()
  const match = trimmed.match(/github\.com[/]([^/]+)[/]([^/]+?)(?:[/].*)?$/)
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

/** Convert markdown to sanitized HTML for TipTap/description. */
function markdownToHtml(md: string): string {
  const truncated = md.length > README_MAX_CHARS ? md.slice(0, README_MAX_CHARS) + '\n\n...' : md
  const rawHtml = marked.parse(truncated, { async: false }) as string
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre', 'a', 'blockquote', 'hr'],
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
    throw new Error(`GitHub API error: ${repoRes.status}`)
  }

  const repoData = await repoRes.json()
  const title = repoData.name || `${owner}/${repo}`
  const slug = slugFromTitle(title)
  const github_url = repoData.html_url || `https://github.com/${owner}/${repo}`

  let description = repoData.description ? `<p>${escapeHtml(repoData.description)}</p>` : ''
  let tags = normalizeTagsFromRepo(repoData)
  const readmePreview = await fetchReadme(owner, repo)

  if (readmePreview) {
    description = markdownToHtml(readmePreview)
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
