// supabase/functions/project-describe/index.ts
// Edge Function: Given a GitHub URL, deeply read the repo and generate a structured
// case study description using Gemini.
//
// Deployment: supabase functions deploy project-describe
// Secret: GEMINI_API_KEY must be set via supabase secrets

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders, json, requireAdminUser } from '../_shared/common.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') || '' // optional, for higher rate limits

interface StructuredNarrative {
  hook: string
  problem: string
  approach: string
  results: string[]
  learned: string[]
  summary: string
}

const REQUEST_TIMEOUT_MS = 12000

async function fetchWithTimeout(input: string | URL | Request, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: init.signal ?? controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Upstream request timed out after ${timeoutMs / 1000}s.`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

/** Parse owner/repo from a GitHub URL */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/)
  if (!match) return null
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') }
}

/** Fetch from GitHub API with optional token */
async function ghFetch(path: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' }
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`
  return fetchWithTimeout(`https://api.github.com${path}`, { headers })
}

/** Get repo metadata */
async function getRepoInfo(owner: string, repo: string) {
  const res = await ghFetch(`/repos/${owner}/${repo}`)
  if (!res.ok) throw new Error(`Failed to fetch repo info: ${res.status}`)
  return res.json()
}

/** Get README content */
async function getReadme(owner: string, repo: string): Promise<string> {
  const res = await ghFetch(`/repos/${owner}/${repo}/readme`)
  if (!res.ok) return ''
  const data = await res.json()
  if (data.encoding === 'base64' && data.content) {
    return atob(data.content.replace(/\n/g, ''))
  }
  return ''
}

/** Get file tree (top-level + key directories) */
async function getFileTree(owner: string, repo: string): Promise<string[]> {
  const res = await ghFetch(`/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.tree || [])
    .filter((f: { type: string }) => f.type === 'blob')
    .map((f: { path: string }) => f.path)
}

/** Fetch a specific file's content */
async function getFileContent(owner: string, repo: string, path: string): Promise<string> {
  const res = await ghFetch(`/repos/${owner}/${repo}/contents/${path}`)
  if (!res.ok) return ''
  const data = await res.json()
  if (data.encoding === 'base64' && data.content) {
    return atob(data.content.replace(/\n/g, ''))
  }
  return ''
}

/** Pick up to 5 key source files to read */
function pickKeyFiles(files: string[]): string[] {
  const priorities = [
    // Entry points
    /^(main|app|train|model|run|index)\.(py|ts|js|r|R)$/i,
    // Source files in src/
    /^src\/(main|app|train|model)\.(py|ts|js)$/i,
    // Notebooks
    /\.(ipynb)$/i,
    // Config
    /^(requirements\.txt|pyproject\.toml|setup\.py|package\.json)$/i,
    // Reports/papers
    /\.(tex|pdf)$/i,
    /(paper|report|thesis|analysis)/i,
  ]

  const selected: string[] = []
  for (const pattern of priorities) {
    for (const file of files) {
      if (pattern.test(file) && !selected.includes(file) && selected.length < 5) {
        // Skip very large or binary files
        if (!/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|pdf)$/i.test(file)) {
          selected.push(file)
        }
      }
    }
  }

  return selected
}

/** Build the Gemini prompt */
function buildPrompt(
  repoInfo: Record<string, unknown>,
  readme: string,
  fileTree: string[],
  sourceFiles: { path: string; content: string }[]
): string {
  const sourceFilesText = sourceFiles
    .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 3000)}`)
    .join('\n\n')

  return `You are analyzing a GitHub repository to create a recruiter-ready project description
for a Data Scientist's portfolio. The reader is a hiring manager or technical recruiter.

REPOSITORY INFO:
- Name: ${repoInfo.name}
- Description: ${repoInfo.description || 'None'}
- Language: ${repoInfo.language || 'Unknown'}
- Topics: ${(repoInfo.topics as string[] || []).join(', ') || 'None'}

README:
${readme.slice(0, 5000)}

FILE TREE (top-level):
${fileTree.slice(0, 50).join('\n')}

KEY SOURCE FILES:
${sourceFilesText}

Rules:
- Write in first person ("I built...", "I compared...")
- Include specific numbers and metrics when found in the code/README
- Focus on IMPACT and DECISIONS, not just features
- Keep each section concise (2-4 sentences for prose, 3-5 bullets for lists)
- Be honest — don't invent metrics that aren't in the data

Generate this exact JSON (no markdown wrapping, just raw JSON):
{
  "hook": "One compelling sentence about what this project does and why it matters",
  "problem": "2-3 sentences about the challenge being solved",
  "approach": "3-5 sentences about methodology, architecture, key decisions",
  "results": ["Specific metric or outcome 1", "Metric 2", "Metric 3"],
  "learned": ["Lesson or trade-off 1", "Lesson 2"],
  "summary": "2-3 sentence overview for card display"
}`
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const auth = await requireAdminUser(req)
  if (!auth.user) {
    if (auth.reason === 'admin-table-missing') {
      return json(503, {
        error: 'Admin access is not configured yet. Run the admin hardening SQL migration and add your email to public.admin_users.',
      })
    }
    return json(403, { error: 'Authenticated admin access required.' })
  }

  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Project description generation requires GEMINI_API_KEY in Supabase secrets.')
    }

    const body = await req.json()
    const { github_url } = body

    if (!github_url) {
      return json(400, { error: 'github_url is required' })
    }

    const parsed = parseGitHubUrl(github_url)
    if (!parsed) {
      return json(400, { error: 'Invalid GitHub URL' })
    }

    const { owner, repo } = parsed

    // Fetch all repo data in parallel
    const [repoInfo, readme, fileTree] = await Promise.all([
      getRepoInfo(owner, repo),
      getReadme(owner, repo),
      getFileTree(owner, repo),
    ])

    // Pick and fetch key source files
    const keyFilePaths = pickKeyFiles(fileTree)
    const sourceFiles = await Promise.all(
      keyFilePaths.map(async (path) => ({
        path,
        content: await getFileContent(owner, repo, path),
      }))
    )

    // Build prompt and call Gemini
    const prompt = buildPrompt(repoInfo, readme, fileTree, sourceFiles)

    const geminiRes = await fetchWithTimeout(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      throw new Error(`Gemini API error: ${geminiRes.status} - ${errText}`)
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Parse the JSON response
    let narrative: StructuredNarrative
    try {
      narrative = JSON.parse(rawText)
    } catch {
      // Try to extract JSON from markdown code block
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        narrative = JSON.parse(jsonMatch[1])
      } else {
        throw new Error('Failed to parse Gemini response as JSON')
      }
    }

    return json(200, { data: narrative })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json(500, { error: message })
  }
})
