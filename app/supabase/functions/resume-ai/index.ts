import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MODEL_BY_TASK = {
  generate_bullets: 'gemini-2.5-flash',
  generate_summary: 'gemini-2.5-flash',
  improve_bullet: 'gemini-2.5-flash',
  generate_subtitle: 'gemini-2.5-flash',
  tailor_resume: 'gemini-2.5-flash',
} as const

type TaskName = keyof typeof MODEL_BY_TASK

type ResumeAiProject = {
  title: string
  description: string
  tags: string[]
}

type ResumeAiExperienceEntry = {
  index: number
  title: string
  tags: string[]
  bullets: string[]
}

type ResumeAiRequest =
  | {
      task: 'generate_bullets'
      payload: { project: ResumeAiProject }
    }
  | {
      task: 'generate_summary'
      payload: {
        settings?: {
          location?: string
          education?: { title?: string; issuer?: string; date?: string }[]
        }
        skills?: string[]
        projects?: ResumeAiProject[]
        experienceItems?: ResumeAiExperienceEntry[]
      }
    }
  | {
      task: 'improve_bullet'
      payload: {
        bullet: string
        projectTitle: string
        tags?: string[]
      }
    }
  | {
      task: 'generate_subtitle'
      payload: { project: ResumeAiProject }
    }
  | {
      task: 'tailor_resume'
      payload: {
        jd: string
        currentSummary?: string
        entries?: ResumeAiExperienceEntry[]
        skills?: string[]
      }
    }

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Expected ${field} to be a string.`)
  }

  return value.trim()
}

function asStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function asProject(value: unknown, field: string): ResumeAiProject {
  if (!value || typeof value !== 'object') {
    throw new Error(`Expected ${field} to be an object.`)
  }

  const project = value as Record<string, unknown>
  return {
    title: asString(project.title, `${field}.title`),
    description: asString(project.description, `${field}.description`),
    tags: asStringArray(project.tags, `${field}.tags`),
  }
}

function asEntryArray(value: unknown): ResumeAiExperienceEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item, index) => ({
      index: typeof item.index === 'number' ? item.index : index,
      title: typeof item.title === 'string' ? item.title.trim() : '',
      tags: asStringArray(item.tags, `entries[${index}].tags`),
      bullets: asStringArray(item.bullets, `entries[${index}].bullets`),
    }))
}

function sanitizeText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    .replace(/\|.*\|/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseBulletLines(text: string, limit = 4): string[] {
  const cleaned = text.replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
  const skip = /^(here are|these are|below are|the following|note:|output:|result:|bullet|example|please|sure|absolutely|of course|certainly)/i

  return cleaned
    .split('\n')
    .map((line) => line.trim())
    .map((line) => line.replace(/^[\s\-*•‣◦]+\s*/, '').replace(/^\d+[\.\)]\s*/, ''))
    .filter((line) => {
      if (line.length < 40 || line.length > 320) return false
      if (skip.test(line)) return false
      if (/[?:]$/.test(line)) return false
      return true
    })
    .slice(0, limit)
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Resume AI did not return valid JSON.')
  }

  return trimmed.slice(start, end + 1)
}

function isMissingAdminTable(error: { code?: string; message?: string } | null) {
  return error?.code === '42P01' || /admin_users|relation .* does not exist/i.test(error?.message ?? '')
}

async function requireAdminUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!authHeader || !supabaseUrl || !supabaseAnonKey) {
    return { user: null, reason: 'missing-auth' as const }
  }

  const token = authHeader.replace(/^Bearer\s+/i, '')
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    return { user: null, reason: 'invalid-user' as const }
  }

  const email = data.user.email?.trim().toLowerCase()

  if (!email) {
    return { user: null, reason: 'missing-email' as const }
  }

  const rlsClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  const { data: adminRow, error: adminError } = await rlsClient
    .from('admin_users')
    .select('email')
    .eq('email', email)
    .maybeSingle()

  if (isMissingAdminTable(adminError)) {
    return { user: null, reason: 'admin-table-missing' as const }
  }

  if (adminError || !adminRow) {
    return { user: null, reason: 'not-admin' as const }
  }

  return { user: data.user, reason: null as const }
}

async function callGemini(task: TaskName, prompt: string, maxOutputTokens: number) {
  const apiKey = Deno.env.get('GEMINI_API_KEY')

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in Supabase secrets.')
  }

  const model = MODEL_BY_TASK[task]
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  )

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}))
    const message =
      (errorPayload as { error?: { message?: string } }).error?.message ??
      `Gemini request failed with status ${response.status}.`
    throw new Error(message)
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
}

async function handleGenerateBullets(payload: { project: ResumeAiProject }) {
  const project = asProject(payload.project, 'project')
  const cleanDesc = sanitizeText(project.description).slice(0, 1800)
  const tags = project.tags.join(', ') || 'Python'

  const prompt = `You are an expert resume writer for data science and software engineering roles.

Write EXACTLY 4 resume bullet points for the project below. Follow these rules strictly:

RULES:
- Each bullet starts with a past-tense action verb (Built, Developed, Engineered, Designed, Optimized, Analyzed, Evaluated, Implemented, Deployed, Processed, Automated, Constructed)
- STAR formula: [Verb] + [What you did + tools/tech + scale] + [quantified result or outcome]
- Use "[X]" or "[X]%" placeholder where metrics are not in the description; user will fill them in
- 80-175 characters per bullet - no shorter, no longer
- NEVER start with "I", "We", "Responsible for", "Helped", "Utilized", "Leveraged", or "Used X to"
- Use numbers already in the description whenever possible

COVER THESE 4 ASPECTS IN ORDER:
Line 1: What was built - the system/model/pipeline name + core algorithms + tech stack
Line 2: Data and scale - dataset size, source, preprocessing steps, feature engineering
Line 3: Methodology - model selection/comparison, validation strategy, training approach
Line 4: Results and deployment - metric achieved + how it was deployed/evaluated/presented

Project title: ${project.title}
Technologies: ${tags}
Description: ${cleanDesc}

IMPORTANT: Output EXACTLY 4 lines. Each line is one bullet. No numbering. No dashes. No headers. No explanation before or after.`

  const text = await callGemini('generate_bullets', prompt, 1200)
  const bullets = parseBulletLines(text, 4)

  while (bullets.length < 4) {
    const stubs = [
      `Built [system] using ${tags}, processing [X]+ records to achieve [outcome].`,
      `Processed and cleaned [X]+ rows of real-world data using ${tags}, engineering [X] features.`,
      'Evaluated [X] model architectures using precision@k, recall@k, and NDCG@k metrics.',
      'Deployed solution as [Streamlit app / REST API] and presented findings to [audience], achieving [X]% accuracy.',
    ]
    bullets.push(stubs[bullets.length] ?? '')
  }

  return { bullets }
}

async function handleGenerateSummary(payload: ResumeAiRequest['payload'] & {
  settings?: { location?: string; education?: { title?: string; issuer?: string; date?: string }[] }
  skills?: string[]
  projects?: ResumeAiProject[]
  experienceItems?: ResumeAiExperienceEntry[]
}) {
  const settings = payload.settings ?? {}
  const education = Array.isArray(settings.education) ? settings.education : []
  const firstEducation = education[0]
  const degree = firstEducation
    ? `${firstEducation.title ?? ''} at ${firstEducation.issuer ?? ''} (${firstEducation.date ?? ''})`.trim()
    : ''
  const topSkills = asStringArray(payload.skills, 'skills').slice(0, 8).join(', ')
  const projects = Array.isArray(payload.projects) ? payload.projects : []
  const projectTitles = projects.slice(0, 4).map((project) => project.title).join(', ')
  const experienceItems = asEntryArray(payload.experienceItems)
  const sampleBullets = experienceItems
    .slice(0, 3)
    .flatMap((item) => item.bullets.slice(0, 1))
    .filter(Boolean)
    .join(' | ')

  const prompt = `You are an expert resume writer for data science and AI or ML roles.

Write a professional resume summary of exactly 3-4 sentences (70-100 words total). It must:
1. Sentence 1: Lead with degree or title + institution + specialties
2. Sentence 2: Highlight core technical skills naturally
3. Sentence 3: Include a concrete achievement or metric (use "[X]%" or "[metric]" placeholder if unknown)
4. Sentence 4: End with the value or impact the candidate brings to employers

Rules:
- Write in third person. Do not use "I" or "My"
- Use ATS keywords naturally
- Sound human and confident, not generic
- Do not use phrases like "results-driven", "passionate team player", or "hard worker"

Candidate info:
Education: ${degree || 'Not specified'}
Location: ${typeof settings.location === 'string' ? settings.location : 'Not specified'}
Skills: ${topSkills || 'Not specified'}
Projects: ${projectTitles || 'Not specified'}
Sample work context: ${sampleBullets || 'Not available'}

IMPORTANT: Output ONLY the summary paragraph. No labels. No headings.`

  const text = await callGemini('generate_summary', prompt, 600)
  return { text: text.trim() }
}

async function handleImproveBullet(payload: { bullet: string; projectTitle: string; tags?: string[] }) {
  const bullet = asString(payload.bullet, 'bullet')
  const projectTitle = asString(payload.projectTitle, 'projectTitle')
  const tags = asStringArray(payload.tags, 'tags')

  const prompt = `You are an expert resume writer. Rewrite the resume bullet below to be stronger and more impactful.

RULES:
1. Keep the same core facts. Do not invent numbers.
2. Start with a strong past-tense action verb.
3. Add "[X]" or "[X]%" placeholder if a metric is missing or vague.
4. Output must be 80-175 characters.
5. NEVER start with "I", "We", "Responsible for", "Leveraged", or "Utilized".

Project: ${projectTitle}
Technologies: ${tags.join(', ')}
Original bullet: ${bullet}

IMPORTANT: Output ONLY the single improved bullet on one line. No quotes. No explanation.`

  const raw = await callGemini('improve_bullet', prompt, 400)
  const cleaned = raw
    .split('\n')[0]
    .trim()
    .replace(/^[-•*"'\d.)\s]+/, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .trim()

  return { bullet: cleaned.length >= 20 ? cleaned : bullet }
}

async function handleGenerateSubtitle(payload: { project: ResumeAiProject }) {
  const project = asProject(payload.project, 'project')
  const cleanDesc = sanitizeText(project.description).slice(0, 600)

  const prompt = `Write a short subtitle (4-8 words) describing this project's type. It appears after an em dash on a resume: "Project Title - [subtitle]".

Good examples: "Hybrid ML Ranking Pipeline", "NLP Topic Modeling System", "Deep Learning Classification Model", "End-to-End Data Analysis Pipeline"

Project title: ${project.title}
Technologies: ${project.tags.join(', ')}
Description (excerpt): ${cleanDesc}

IMPORTANT: Output ONLY the subtitle words. No quotes. No dash. No punctuation at the end.`

  const raw = await callGemini('generate_subtitle', prompt, 200)
  const subtitle = raw.split('\n')[0].trim().replace(/^["']|["']$/g, '').replace(/[.:!?]$/, '')

  return { subtitle }
}

async function handleTailorResume(payload: {
  jd: string
  currentSummary?: string
  entries?: ResumeAiExperienceEntry[]
  skills?: string[]
}) {
  const jd = asString(payload.jd, 'jd').slice(0, 2000)
  const currentSummary = typeof payload.currentSummary === 'string' ? payload.currentSummary.trim() : ''
  const entries = asEntryArray(payload.entries)
  const skills = asStringArray(payload.skills, 'skills')

  const entriesSnapshot = entries
    .map((entry) => {
      const tags = entry.tags.join(', ')
      const bullets = entry.bullets.filter(Boolean).map((bullet) => `  - ${bullet}`).join('\n')
      return `Entry ${entry.index} - ${entry.title} [${tags}]:\n${bullets}`
    })
    .join('\n\n')

  const prompt = `You are an expert resume writer and ATS optimization specialist.

Tailor the resume below to the job description provided. Your goal is to maximize keyword alignment and relevance without fabricating experience.

RULES:
1. Keep all facts truthful. Use the same projects or roles and only rephrase bullets to emphasize relevant skills.
2. Rewrite the summary to open with keywords from the JD naturally.
3. For each project entry, rewrite bullets to emphasize skills mentioned in the JD.
4. Use exact phrases from the JD where they honestly apply.
5. Add "[X]" metric placeholders where numbers would strengthen a bullet.
6. Each bullet must be 60-175 characters and start with a past-tense action verb.
7. Keep the same number of bullets per entry.

JOB DESCRIPTION:
${jd}

CURRENT SUMMARY:
${currentSummary || '(none yet)'}

CURRENT EXPERIENCE ENTRIES:
${entriesSnapshot}

SKILLS AVAILABLE: ${skills.slice(0, 12).join(', ')}

Output as JSON exactly in this format:
{
  "summary": "rewritten summary",
  "entries": [
    { "index": 0, "bullets": ["bullet1", "bullet2"] }
  ]
}`

  const raw = await callGemini('tailor_resume', prompt, 3000)
  const jsonText = extractJsonObject(raw)
  const parsed = JSON.parse(jsonText) as {
    summary?: string
    entries?: { index?: number; bullets?: string[] }[]
  }

  const bullets: Record<number, string[]> = {}

  for (const entry of parsed.entries ?? []) {
    if (typeof entry.index !== 'number' || !Array.isArray(entry.bullets)) continue
    bullets[entry.index] = entry.bullets.filter((bullet) => typeof bullet === 'string' && bullet.trim().length > 5).slice(0, 5)
  }

  return {
    summary: parsed.summary?.trim() || currentSummary,
    bullets,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' })
  }

  const authResult = await requireAdminUser(req)

  if (!authResult.user) {
    if (authResult.reason === 'admin-table-missing') {
      return json(503, {
        error: 'Admin access is not configured yet. Run the admin hardening SQL migration and add your email to public.admin_users.',
      })
    }

    return json(403, { error: 'Authenticated admin access required.' })
  }

  try {
    const body = (await req.json()) as ResumeAiRequest

    if (!body?.task || !body?.payload) {
      return json(400, { error: 'Invalid request body.' })
    }

    let data: Record<string, unknown>

    switch (body.task) {
      case 'generate_bullets':
        data = await handleGenerateBullets(body.payload)
        break
      case 'generate_summary':
        data = await handleGenerateSummary(body.payload)
        break
      case 'improve_bullet':
        data = await handleImproveBullet(body.payload)
        break
      case 'generate_subtitle':
        data = await handleGenerateSubtitle(body.payload)
        break
      case 'tailor_resume':
        data = await handleTailorResume(body.payload)
        break
      default:
        return json(400, { error: 'Unsupported resume AI task.' })
    }

    return json(200, { data })
  } catch (error) {
    console.error('resume-ai error', error)
    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return json(500, { error: message })
  }
})
