/**
 * Fetch public GitHub repo metadata and build a richer project import payload.
 *
 * The goal is not just "README paste-in", but a portfolio-ready project entry:
 * - better title selection
 * - cleaner blog/wiki style description
 * - stronger tags from repo metadata, languages, manifests, and repo tree
 * - useful "ask me about" prompt
 * - lightweight import summary for the admin UI
 */

import { marked } from 'marked'
import DOMPurify from 'dompurify'

export interface GitHubImportSummary {
  title_source: 'readme_heading' | 'repo_name'
  readme_sections: string[]
  repo_kinds: string[]
  highlights: string[]
  detected_tags: string[]
  notable_files: string[]
}

export interface GitHubProjectData {
  title: string
  description: string
  slug: string
  tags: string[]
  github_url: string
  demo_url: string | null
  ask_me_about: string | null
  import_summary: GitHubImportSummary
}

type GitHubRepoResponse = {
  name?: string
  html_url?: string
  homepage?: string | null
  description?: string | null
  topics?: string[]
  language?: string | null
  default_branch?: string | null
}

type GitHubTreeResponse = {
  tree?: Array<{ path?: string; type?: string }>
}

type GitHubLanguageMap = Record<string, number>

type ReadmeSection = {
  title: string
  body: string
}

type ReadmeInsights = {
  title: string | null
  intro: string
  sections: ReadmeSection[]
}

type RepoInsights = {
  repoKinds: string[]
  highlights: string[]
  tags: string[]
  notableFiles: string[]
  detectedHomepage: string | null
}

const GITHUB_API = 'https://api.github.com'
const README_MAX_CHARS = 12_000
const DESCRIPTION_SECTION_LIMIT = 4
const MAX_TAGS = 12
const MAX_HIGHLIGHTS = 6
const MAX_NOTABLE_FILES = 6

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
  'screenshots',
  'screenshot',
  'authors',
  'credits',
  'faq',
  'installation and setup',
] as const

const SECTION_TITLE_MAP: Array<[RegExp, string]> = [
  [/^(overview|about|introduction|summary|abstract)$/i, 'Overview'],
  [/^(features|highlights|key features|what it does)$/i, 'Key Features'],
  [/^(results|impact|outcomes?|performance|evaluation|metrics)$/i, 'Results'],
  [/^(approach|methodology|architecture|pipeline|how it works)$/i, 'Approach'],
  [/^(data|dataset|datasets)$/i, 'Data'],
  [/^(tech stack|technologies|stack|tools)$/i, 'Tech Stack'],
  [/^(project structure|repository structure|repo structure|structure|layout)$/i, "What's Inside"],
  [/^(demo|preview)$/i, 'Demo'],
  [/^(lessons learned|challenges|tradeoffs)$/i, 'Lessons Learned'],
] as const

const CANONICAL_TAG_LABELS: Record<string, string> = {
  ai: 'AI',
  angular: 'Angular',
  api: 'API',
  aws: 'AWS',
  'c++': 'C++',
  css: 'CSS',
  data: 'Data',
  'data science': 'Data Science',
  'deep learning': 'Deep Learning',
  django: 'Django',
  docker: 'Docker',
  'computer vision': 'Computer Vision',
  express: 'Express',
  fastapi: 'FastAPI',
  flask: 'Flask',
  gcp: 'GCP',
  go: 'Go',
  golang: 'Go',
  'github actions': 'GitHub Actions',
  graphql: 'GraphQL',
  gradio: 'Gradio',
  html: 'HTML',
  java: 'Java',
  javascript: 'JavaScript',
  'jupyter notebook': 'Jupyter Notebook',
  kubernetes: 'Kubernetes',
  llm: 'LLM',
  mongodb: 'MongoDB',
  'machine learning': 'Machine Learning',
  mysql: 'MySQL',
  next: 'Next.js',
  nextjs: 'Next.js',
  'next.js': 'Next.js',
  node: 'Node.js',
  'node.js': 'Node.js',
  notebook: 'Notebook',
  nlp: 'NLP',
  numpy: 'NumPy',
  openai: 'OpenAI',
  opencv: 'OpenCV',
  pandas: 'Pandas',
  postgresql: 'PostgreSQL',
  postgres: 'PostgreSQL',
  python: 'Python',
  pytorch: 'PyTorch',
  react: 'React',
  redis: 'Redis',
  rest: 'REST',
  rust: 'Rust',
  scikit: 'Scikit-learn',
  sklearn: 'Scikit-learn',
  'scikit learn': 'Scikit-learn',
  'scikit-learn': 'Scikit-learn',
  sql: 'SQL',
  streamlit: 'Streamlit',
  supabase: 'Supabase',
  svelte: 'Svelte',
  swift: 'Swift',
  tailwind: 'Tailwind CSS',
  'tailwind css': 'Tailwind CSS',
  tensorflow: 'TensorFlow',
  typescript: 'TypeScript',
  vite: 'Vite',
  vue: 'Vue',
}

const README_TECH_TERMS = [
  'Python',
  'JavaScript',
  'TypeScript',
  'React',
  'Vue',
  'Node.js',
  'TensorFlow',
  'PyTorch',
  'Machine Learning',
  'Deep Learning',
  'Data Science',
  'API',
  'REST',
  'GraphQL',
  'Docker',
  'Kubernetes',
  'PostgreSQL',
  'MongoDB',
  'Redis',
  'AWS',
  'GCP',
  'Rust',
  'Go',
  'Java',
  'C++',
  'Swift',
  'Next.js',
  'Vite',
  'Tailwind CSS',
  'Svelte',
  'Angular',
  'Django',
  'Flask',
  'FastAPI',
  'Supabase',
  'Streamlit',
  'Gradio',
  'Pandas',
  'NumPy',
  'Scikit-learn',
  'OpenCV',
  'NLP',
  'LLM',
] as const

export async function fetchProjectFromGitHubUrl(repoUrl: string): Promise<GitHubProjectData> {
  const parsed = parseRepoUrl(repoUrl)
  if (!parsed) {
    throw new Error('Invalid GitHub repo URL. Use format: https://github.com/owner/repo')
  }

  const { owner, repo } = parsed
  const repoData = await fetchRepoMetadata(owner, repo)

  const [readme, languageMap, treePaths] = await Promise.all([
    fetchReadme(owner, repo),
    fetchLanguages(owner, repo),
    fetchRepoTree(owner, repo, repoData.default_branch ?? 'main'),
  ])

  const candidateFiles = collectCandidateRepoFiles(treePaths)
  const repoFiles = await fetchRepoFiles(owner, repo, repoData.default_branch ?? 'main', candidateFiles)
  const readmeInsights = extractReadmeInsights(readme ?? '')
  const repoInsights = analyzeRepo({
    treePaths,
    languageMap,
    repoFiles,
  })

  const title = chooseProjectTitle(readmeInsights.title, repoData.name || repo)
  const slug = slugFromTitle(title || repo)
  const github_url = repoData.html_url || `https://github.com/${owner}/${repo}`
  const demo_url =
    normalizeHomepageUrl(repoData.homepage) ??
    normalizeHomepageUrl(repoInsights.detectedHomepage) ??
    null

  const repoTags = normalizeTags(
    normalizeTagsFromRepo(repoData, languageMap),
    repoInsights.tags,
    readme ? extendTagsFromReadme(readme.slice(0, 4096), []) : []
  )

  const description = buildProjectDescription({
    repoDescription: repoData.description ?? '',
    readmeInsights,
    repoInsights,
    tags: repoTags,
  })

  return {
    title,
    description,
    slug,
    tags: repoTags,
    github_url,
    demo_url,
    ask_me_about: buildAskMeAbout(repoInsights, repoTags),
    import_summary: {
      title_source: readmeInsights.title ? 'readme_heading' : 'repo_name',
      readme_sections: readmeInsights.sections.map((section) => section.title),
      repo_kinds: repoInsights.repoKinds,
      highlights: repoInsights.highlights,
      detected_tags: repoTags,
      notable_files: repoInsights.notableFiles,
    },
  }
}

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

async function fetchRepoMetadata(owner: string, repo: string): Promise<GitHubRepoResponse> {
  const repoRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  })

  if (!repoRes.ok) {
    if (repoRes.status === 404) throw new Error('Repository not found or private.')
    if (repoRes.status === 403) {
      const body = await repoRes.json().catch(() => null) as { message?: string } | null
      throw new Error(
        body?.message?.includes('rate limit')
          ? 'GitHub rate limit reached. Wait a bit and try again.'
          : 'GitHub blocked the request. Try again in a moment.'
      )
    }
    throw new Error(`GitHub API error: ${repoRes.status}`)
  }

  return await repoRes.json() as GitHubRepoResponse
}

async function fetchLanguages(owner: string, repo: string): Promise<GitHubLanguageMap> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/languages`, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    })
    if (!res.ok) return {}
    return await res.json() as GitHubLanguageMap
  } catch {
    return {}
  }
}

async function fetchRepoTree(owner: string, repo: string, ref: string): Promise<string[]> {
  try {
    const encodedRef = encodeURIComponent(ref)
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees/${encodedRef}?recursive=1`, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    })
    if (!res.ok) return []
    const data = await res.json() as GitHubTreeResponse
    return (data.tree ?? [])
      .map((entry) => entry.path?.trim() ?? '')
      .filter(Boolean)
  } catch {
    return []
  }
}

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

async function fetchRepoFiles(
  owner: string,
  repo: string,
  ref: string,
  paths: string[]
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    paths.map(async (path) => {
      try {
        const encodedPath = path.split('/').map(encodeURIComponent).join('/')
        const encodedRef = encodeURIComponent(ref)
        const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodedRef}`, {
          headers: { Accept: 'application/vnd.github.v3.raw' },
        })
        if (!res.ok) return null
        const text = await res.text()
        return [path, text] as const
      } catch {
        return null
      }
    })
  )

  return Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, string]>)
}

function chooseProjectTitle(readmeTitle: string | null, repoName: string): string {
  if (readmeTitle && readmeTitle.trim().length > 0) return readmeTitle.trim()
  return titleFromRepoName(repoName)
}

function slugFromTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return slug || 'project'
}

function titleFromRepoName(repo: string): string {
  const cleaned = repo.replace(/[-_]+/g, ' ').trim()
  if (!cleaned) return repo
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase())
}

function buildProjectDescription(input: {
  repoDescription: string
  readmeInsights: ReadmeInsights
  repoInsights: RepoInsights
  tags: string[]
}): string {
  const {
    repoDescription,
    readmeInsights,
    repoInsights,
    tags,
  } = input

  const htmlParts: string[] = []
  const overviewSource = readmeInsights.intro || repoDescription.trim()

  if (overviewSource) {
    htmlParts.push(`<h2>Overview</h2>${renderMarkdownFragment(overviewSource)}`)
  } else if (repoInsights.highlights.length > 0) {
    htmlParts.push(`<h2>Overview</h2><p>${escapeHtml(repoInsights.highlights[0])}</p>`)
  }

  for (const section of readmeInsights.sections.slice(0, DESCRIPTION_SECTION_LIMIT)) {
    htmlParts.push(`<h3>${escapeHtml(section.title)}</h3>${renderMarkdownFragment(section.body)}`)
  }

  if (repoInsights.highlights.length > 0) {
    const highlightsMarkdown = repoInsights.highlights.map((item) => `- ${item}`).join('\n')
    htmlParts.push(`<h3>Repository Highlights</h3>${renderMarkdownFragment(highlightsMarkdown)}`)
  }

  if (repoInsights.notableFiles.length > 0) {
    const notableFilesMarkdown = repoInsights.notableFiles.map((item) => `- \`${item}\``).join('\n')
    htmlParts.push(`<h3>What&apos;s Inside</h3>${renderMarkdownFragment(notableFilesMarkdown)}`)
  }

  const hasTechSection = readmeInsights.sections.some((section) => section.title === 'Tech Stack')
  if (!hasTechSection && tags.length > 0) {
    htmlParts.push(`<h3>Tech Stack</h3><p>${escapeHtml(tags.join(', '))}</p>`)
  }

  if (htmlParts.length === 0 && repoDescription.trim()) {
    return `<p>${escapeHtml(repoDescription.trim())}</p>`
  }

  if (htmlParts.length === 0) {
    return '<p>No description.</p>'
  }

  return htmlParts.join('')
}

function renderMarkdownFragment(md: string): string {
  const rawHtml = marked.parse(md, { async: false }) as string
  return sanitizeProjectHtml(rawHtml)
}

function sanitizeProjectHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'blockquote', 'hr', 'code'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })
}

function extractReadmeInsights(readme: string): ReadmeInsights {
  const preview = extractReadmePreview(readme)
  if (!preview) {
    return { title: null, intro: '', sections: [] }
  }

  const lines = preview.replace(/\r\n/g, '\n').split('\n')
  let title: string | null = null
  const introLines: string[] = []
  const sections: Array<{ heading: string; lines: string[] }> = []
  let current: { heading: string; lines: string[] } | null = null

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const heading = headingMatch[2].trim()

      if (level === 1 && !title) {
        title = heading
        continue
      }

      if (current && current.lines.some((entry) => entry.trim())) {
        sections.push(current)
      }
      current = { heading, lines: [] }
      continue
    }

    if (current) {
      current.lines.push(line)
    } else {
      introLines.push(line)
    }
  }

  if (current && current.lines.some((entry) => entry.trim())) {
    sections.push(current)
  }

  return {
    title: normalizeReadmeTitle(title),
    intro: trimMarkdownBlock(introLines.join('\n').trim(), 1200),
    sections: sections
      .map((section) => {
        const normalizedTitle = normalizeReadmeSectionTitle(section.heading)
        const body = trimMarkdownBlock(section.lines.join('\n').trim(), normalizedTitle === 'Key Features' ? 1800 : 1400)
        return normalizedTitle && body ? { title: normalizedTitle, body } : null
      })
      .filter(Boolean)
      .slice(0, 6) as ReadmeSection[],
  }
}

function normalizeReadmeTitle(title: string | null): string | null {
  if (!title) return null
  const cleaned = title.replace(/^\W+|\W+$/g, '').trim()
  if (!cleaned || cleaned.length > 90) return null
  return cleaned
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

function normalizeReadmeSectionTitle(title: string): string | null {
  const trimmed = title.trim()
  if (!trimmed) return null

  const normalized = trimmed.toLowerCase()
  if (SKIP_README_SECTIONS.some((label) => normalized === label)) return null

  for (const [pattern, mappedTitle] of SECTION_TITLE_MAP) {
    if (pattern.test(trimmed)) return mappedTitle
  }

  if (normalized.includes('install') || normalized.includes('setup') || normalized.includes('usage')) {
    return null
  }

  return titleCase(trimmed.replace(/[^\w\s/&+-]/g, ' '))
}

function trimMarkdownBlock(markdown: string, maxChars: number): string {
  const cleaned = markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .trim()

  if (!cleaned) return ''
  return cleaned.length > maxChars ? `${cleaned.slice(0, maxChars).trim()}\n\n...` : cleaned
}

function analyzeRepo(input: {
  treePaths: string[]
  languageMap: GitHubLanguageMap
  repoFiles: Record<string, string>
}): RepoInsights {
  const { treePaths, languageMap, repoFiles } = input
  const lowerPaths = treePaths.map((path) => path.toLowerCase())
  const repoKinds: string[] = []
  const highlights: string[] = []
  const tags: string[] = []
  let detectedHomepage: string | null = null

  const packageJsonPaths = Object.keys(repoFiles).filter((path) => path.toLowerCase().endsWith('package.json'))
  const pythonManifestPaths = Object.keys(repoFiles).filter((path) => {
    const lower = path.toLowerCase()
    return lower.endsWith('requirements.txt') || lower.endsWith('pyproject.toml') || lower.endsWith('environment.yml')
  })
  const cargoPaths = Object.keys(repoFiles).filter((path) => path.toLowerCase().endsWith('cargo.toml'))
  const goModPaths = Object.keys(repoFiles).filter((path) => path.toLowerCase().endsWith('go.mod'))

  for (const path of packageJsonPaths) {
    const parsed = parsePackageJson(repoFiles[path])
    mergeUnique(repoKinds, parsed.repoKinds)
    mergeUnique(tags, parsed.tags)
    mergeUnique(highlights, parsed.highlights)
    if (parsed.homepage) {
      detectedHomepage = parsed.homepage
    }
  }

  for (const path of pythonManifestPaths) {
    const parsed = parsePythonManifest(repoFiles[path], path)
    mergeUnique(repoKinds, parsed.repoKinds)
    mergeUnique(tags, parsed.tags)
    mergeUnique(highlights, parsed.highlights)
  }

  for (const path of cargoPaths) {
    const parsed = parseCargoManifest(repoFiles[path])
    mergeUnique(repoKinds, parsed.repoKinds)
    mergeUnique(tags, parsed.tags)
    mergeUnique(highlights, parsed.highlights)
  }

  for (const path of goModPaths) {
    const parsed = parseGoManifest(repoFiles[path])
    mergeUnique(repoKinds, parsed.repoKinds)
    mergeUnique(tags, parsed.tags)
    mergeUnique(highlights, parsed.highlights)
  }

  const notebookCount = lowerPaths.filter((path) => path.endsWith('.ipynb')).length
  const hasDocs = lowerPaths.some((path) => path.startsWith('docs/') || path.includes('/docs/'))
  const hasTests = lowerPaths.some((path) => /(^|\/)(__tests__|tests?|spec)(\/|$)/.test(path))
  const hasCi = lowerPaths.some((path) => path.startsWith('.github/workflows/'))
  const hasDocker = lowerPaths.some((path) => path.endsWith('dockerfile') || path.endsWith('docker-compose.yml') || path.endsWith('docker-compose.yaml'))
  const hasApi = lowerPaths.some((path) => /(^|\/)(api|server|backend)(\/|$)/.test(path))
  const hasFrontend = lowerPaths.some((path) => /(^|\/)(src|app|frontend|web)(\/|$)/.test(path))
  const hasData = lowerPaths.some((path) => /(^|\/)(data|dataset|datasets|notebooks|notebook|experiments?)(\/|$)/.test(path))
  const hasModels = lowerPaths.some((path) => /(^|\/)(models?|training|checkpoints|weights)(\/|$)/.test(path))

  const languageTags = Object.entries(languageMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([language]) => canonicalizeTag(language))

  mergeUnique(tags, languageTags)

  if (notebookCount > 0) {
    mergeUnique(repoKinds, ['Notebook workflow'])
    mergeUnique(tags, ['Jupyter Notebook'])
    mergeUnique(highlights, [
      `Includes ${notebookCount} notebook${notebookCount === 1 ? '' : 's'} for experimentation and analysis.`,
    ])
  }

  if (hasApi) {
    mergeUnique(repoKinds, ['API service'])
    mergeUnique(tags, ['API'])
    mergeUnique(highlights, ['Backend or API code is organized separately from the rest of the repo.'])
  }

  if (hasFrontend && !repoKinds.some((kind) => /app/i.test(kind))) {
    mergeUnique(highlights, ['Repository includes a dedicated application/front-end code structure.'])
  }

  if (hasData) {
    mergeUnique(highlights, ['Project structure includes dedicated data, experiments, or notebook folders.'])
  }

  if (hasModels) {
    mergeUnique(highlights, ['Model or training assets are separated from the app code.'])
  }

  if (hasDocker) {
    mergeUnique(repoKinds, ['Dockerized setup'])
    mergeUnique(tags, ['Docker'])
    mergeUnique(highlights, ['Docker configuration is included for reproducible local or deployment environments.'])
  }

  if (hasTests) {
    mergeUnique(highlights, ['Tests are present in the repository.'])
  }

  if (hasCi) {
    mergeUnique(tags, ['GitHub Actions'])
    mergeUnique(highlights, ['GitHub Actions workflows are configured for automation or CI.'])
  }

  if (hasDocs) {
    mergeUnique(highlights, ['Project documentation extends beyond the main README.'])
  }

  return finalizeRepoInsights({
    repoKinds,
    highlights,
    tags,
    notableFiles: collectNotableFiles(lowerPaths, Object.keys(repoFiles)),
    detectedHomepage,
  })
}

function finalizeRepoInsights(input: RepoInsights): RepoInsights {
  return {
    repoKinds: input.repoKinds.slice(0, 4),
    highlights: input.highlights.slice(0, MAX_HIGHLIGHTS),
    tags: normalizeTags(input.tags),
    notableFiles: input.notableFiles.slice(0, MAX_NOTABLE_FILES),
    detectedHomepage: input.detectedHomepage,
  }
}

function collectCandidateRepoFiles(paths: string[]): string[] {
  const picks = [
    ...findTreeMatches(paths, (path) => path === 'package.json' || path.endsWith('/package.json'), 2),
    ...findTreeMatches(paths, (path) => path === 'requirements.txt' || path.endsWith('/requirements.txt'), 2),
    ...findTreeMatches(paths, (path) => path === 'pyproject.toml' || path.endsWith('/pyproject.toml'), 2),
    ...findTreeMatches(paths, (path) => path === 'environment.yml' || path.endsWith('/environment.yml'), 1),
    ...findTreeMatches(paths, (path) => path === 'cargo.toml' || path.endsWith('/cargo.toml'), 1),
    ...findTreeMatches(paths, (path) => path === 'go.mod' || path.endsWith('/go.mod'), 1),
    ...findTreeMatches(paths, (path) => path.endsWith('dockerfile'), 1),
  ]

  return uniqueStrings(picks).slice(0, 8)
}

function findTreeMatches(paths: string[], matcher: (lowerPath: string) => boolean, limit: number): string[] {
  return paths
    .filter((path) => matcher(path.toLowerCase()))
    .slice(0, limit)
}

function collectNotableFiles(lowerPaths: string[], fetchedFilePaths: string[]): string[] {
  const notable: string[] = []
  const add = (value: string | null) => {
    if (!value) return
    if (!notable.includes(value)) notable.push(value)
  }

  for (const path of fetchedFilePaths) {
    add(path)
  }

  if (lowerPaths.some((path) => path.startsWith('docs/') || path.includes('/docs/'))) add('docs/')
  if (lowerPaths.some((path) => path.startsWith('.github/workflows/'))) add('.github/workflows/')
  if (lowerPaths.some((path) => path.endsWith('.ipynb'))) add('*.ipynb')
  if (lowerPaths.some((path) => /(^|\/)(tests?|__tests__)(\/|$)/.test(path))) add('tests/')
  if (lowerPaths.some((path) => /(^|\/)(data|dataset|datasets|notebooks|experiments?)(\/|$)/.test(path))) add('data/ or notebooks/')

  return notable.slice(0, MAX_NOTABLE_FILES)
}

function parsePackageJson(content: string): { repoKinds: string[]; tags: string[]; highlights: string[]; homepage: string | null } {
  try {
    const parsed = JSON.parse(content) as {
      homepage?: string
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }

    const deps = {
      ...(parsed.dependencies ?? {}),
      ...(parsed.devDependencies ?? {}),
    }

    const keys = Object.keys(deps).map((key) => key.toLowerCase())
    const repoKinds: string[] = []
    const tags: string[] = []
    const highlights: string[] = []

    const has = (...candidates: string[]) => candidates.some((candidate) => keys.includes(candidate))

    if (has('react', 'react-dom')) {
      mergeUnique(repoKinds, ['React app'])
      mergeUnique(tags, ['React'])
    }
    if (has('next', 'next.js')) {
      mergeUnique(repoKinds, ['Web app'])
      mergeUnique(tags, ['Next.js'])
      mergeUnique(highlights, ['Web application is built with Next.js.'])
    }
    if (has('vite')) {
      mergeUnique(tags, ['Vite'])
      if (!repoKinds.some((kind) => kind.includes('React'))) {
        mergeUnique(highlights, ['Modern front-end tooling is set up with Vite.'])
      }
    }
    if (has('tailwindcss')) {
      mergeUnique(tags, ['Tailwind CSS'])
    }
    if (has('express', 'fastify', '@nestjs/core', 'koa', 'hono')) {
      mergeUnique(repoKinds, ['API service'])
      mergeUnique(tags, ['API'])
      mergeUnique(highlights, ['Node-based API or backend service code is part of the repo.'])
    }
    if (has('electron')) {
      mergeUnique(repoKinds, ['Desktop app'])
      mergeUnique(highlights, ['Repository includes an Electron-based desktop application shell.'])
    }
    if (has('@supabase/supabase-js', '@supabase/ssr')) {
      mergeUnique(tags, ['Supabase'])
    }
    if (has('openai', '@anthropic-ai/sdk', '@google/generative-ai', 'langchain', '@langchain/openai')) {
      mergeUnique(tags, ['AI', 'LLM'])
      mergeUnique(highlights, ['Repository integrates external AI/LLM tooling.'])
    }
    if (has('tensorflow', '@tensorflow/tfjs', 'brain.js')) {
      mergeUnique(tags, ['Machine Learning'])
    }

    if (repoKinds.includes('React app') && tags.includes('Vite')) {
      mergeUnique(highlights, ['Frontend application is organized as a React + Vite project.'])
    }

    return {
      repoKinds,
      tags,
      highlights,
      homepage: normalizeHomepageUrl(parsed.homepage),
    }
  } catch {
    return { repoKinds: [], tags: [], highlights: [], homepage: null }
  }
}

function parsePythonManifest(content: string, path: string): { repoKinds: string[]; tags: string[]; highlights: string[] } {
  const text = content.toLowerCase()
  const repoKinds: string[] = []
  const tags: string[] = ['Python']
  const highlights: string[] = []

  const has = (pattern: RegExp) => pattern.test(text)

  if (has(/\bfastapi\b|\buvicorn\b/)) {
    mergeUnique(repoKinds, ['API service'])
    mergeUnique(tags, ['FastAPI', 'API'])
    mergeUnique(highlights, ['Python API/service dependencies are present via FastAPI/Uvicorn tooling.'])
  }
  if (has(/\bflask\b/)) {
    mergeUnique(repoKinds, ['API service'])
    mergeUnique(tags, ['Flask', 'API'])
  }
  if (has(/\bdjango\b/)) {
    mergeUnique(repoKinds, ['Web app'])
    mergeUnique(tags, ['Django'])
  }
  if (has(/\bstreamlit\b/)) {
    mergeUnique(repoKinds, ['Interactive app'])
    mergeUnique(tags, ['Streamlit'])
    mergeUnique(highlights, ['Interactive data or ML UI is set up with Streamlit.'])
  }
  if (has(/\bgradio\b/)) {
    mergeUnique(repoKinds, ['Interactive app'])
    mergeUnique(tags, ['Gradio'])
  }
  if (has(/\btorch\b|\bpytorch\b/)) {
    mergeUnique(repoKinds, ['Machine learning project'])
    mergeUnique(tags, ['PyTorch', 'Machine Learning'])
  }
  if (has(/\btensorflow\b|\bkeras\b/)) {
    mergeUnique(repoKinds, ['Machine learning project'])
    mergeUnique(tags, ['TensorFlow', 'Machine Learning'])
  }
  if (has(/\bscikit-learn\b|\bsklearn\b/)) {
    mergeUnique(repoKinds, ['Machine learning project'])
    mergeUnique(tags, ['Scikit-learn', 'Machine Learning'])
  }
  if (has(/\bpandas\b/)) mergeUnique(tags, ['Pandas'])
  if (has(/\bnumpy\b/)) mergeUnique(tags, ['NumPy'])
  if (has(/\bopencv\b|\bcv2\b/)) mergeUnique(tags, ['OpenCV', 'Computer Vision'])
  if (has(/\btransformers\b|\blangchain\b|\bopenai\b/)) mergeUnique(tags, ['AI', 'LLM'])
  if (path.toLowerCase().includes('requirements')) {
    mergeUnique(highlights, ['Python dependencies are explicitly pinned in requirements files.'])
  }

  return { repoKinds, tags, highlights }
}

function parseCargoManifest(content: string): { repoKinds: string[]; tags: string[]; highlights: string[] } {
  const text = content.toLowerCase()
  const tags = ['Rust']
  const repoKinds: string[] = []
  const highlights: string[] = ['Rust crate or application manifest is present in the repository.']

  if (/\baxum\b|\bactix-web\b|\brocket\b/.test(text)) {
    mergeUnique(repoKinds, ['API service'])
    mergeUnique(tags, ['API'])
  }

  return { repoKinds, tags, highlights }
}

function parseGoManifest(content: string): { repoKinds: string[]; tags: string[]; highlights: string[] } {
  const text = content.toLowerCase()
  const tags = ['Go']
  const repoKinds: string[] = []
  const highlights = ['Go module metadata is present in the repository.']

  if (/\bgin\b|\bfiber\b|\becho\b/.test(text)) {
    mergeUnique(repoKinds, ['API service'])
    mergeUnique(tags, ['API'])
  }

  return { repoKinds, tags, highlights }
}

function normalizeTagsFromRepo(repoData: GitHubRepoResponse, languageMap: GitHubLanguageMap): string[] {
  const topicTags = Array.isArray(repoData.topics) ? repoData.topics : []
  const primaryLanguage = repoData.language ? [repoData.language] : []
  const topLanguages = Object.entries(languageMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([language]) => language)

  return normalizeTags(topicTags, primaryLanguage, topLanguages)
}

function extendTagsFromReadme(readmeChunk: string, existingTags: string[]): string[] {
  const existingLower = new Set(existingTags.map((tag) => tag.toLowerCase()))
  const added: string[] = []
  const text = readmeChunk.replace(/[#*`_\[\]()]/g, ' ').toLowerCase()

  for (const term of README_TECH_TERMS) {
    const canonical = canonicalizeTag(term)
    if (existingLower.has(canonical.toLowerCase())) continue
    const escaped = term
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+')
    const re = new RegExp(`\\b${escaped}\\b`, 'i')
    if (re.test(text)) {
      added.push(canonical)
      existingLower.add(canonical.toLowerCase())
    }
  }

  return normalizeTags(existingTags, added)
}

function normalizeTags(...groups: string[][]): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  for (const group of groups) {
    for (const rawTag of group) {
      const tag = canonicalizeTag(rawTag)
      if (!tag) continue
      const key = tag.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      result.push(tag)
      if (result.length >= MAX_TAGS) return result
    }
  }

  return result
}

function canonicalizeTag(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[_/]+/g, ' ')
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ')
  if (!cleaned) return ''

  const normalized = cleaned.toLowerCase()
  if (CANONICAL_TAG_LABELS[normalized]) return CANONICAL_TAG_LABELS[normalized]

  return cleaned
    .split(' ')
    .map((part) => {
      const lower = part.toLowerCase()
      if (CANONICAL_TAG_LABELS[lower]) return CANONICAL_TAG_LABELS[lower]
      if (part.length <= 2) return part.toUpperCase()
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
    .join(' ')
}

function buildAskMeAbout(repoInsights: RepoInsights, tags: string[]): string | null {
  const prompts: string[] = []

  if (repoInsights.repoKinds.some((kind) => /machine learning/i.test(kind))) {
    prompts.push('modeling and evaluation workflow')
  }
  if (repoInsights.repoKinds.some((kind) => /react app|web app|interactive app/i.test(kind))) {
    prompts.push('application architecture')
  }
  if (repoInsights.repoKinds.some((kind) => /api service/i.test(kind))) {
    prompts.push('API design')
  }
  if (repoInsights.highlights.some((item) => /notebook/i.test(item))) {
    prompts.push('notebook experimentation')
  }
  if (repoInsights.highlights.some((item) => /docker/i.test(item))) {
    prompts.push('deployment and reproducibility')
  }

  if (prompts.length === 0) {
    prompts.push(
      ...tags
        .filter((tag) => /react|typescript|python|machine learning|data science|fastapi|supabase|docker|next\.js/i.test(tag))
        .slice(0, 3)
        .map((tag) => tag.toLowerCase())
    )
  }

  const uniquePrompts = uniqueStrings(prompts).slice(0, 3)
  if (uniquePrompts.length === 0) return null
  return `Ask me about the ${joinWithAnd(uniquePrompts)}.`
}

function normalizeHomepageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(trimmed)) return `https://${trimmed}`
  return null
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function titleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part) => {
      if (!part) return part
      if (/^[A-Z0-9.+/-]+$/.test(part)) return part
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
    .join(' ')
}

function joinWithAnd(values: string[]): string {
  if (values.length === 0) return ''
  if (values.length === 1) return values[0]
  if (values.length === 2) return `${values[0]} and ${values[1]}`
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`
}

function uniqueStrings(values: string[]): string[] {
  const next: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const cleaned = value.trim()
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    next.push(cleaned)
  }
  return next
}

function mergeUnique(target: string[], values: string[]) {
  for (const value of values) {
    if (!target.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
      target.push(value)
    }
  }
}
