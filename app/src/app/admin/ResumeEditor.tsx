/* eslint-disable @typescript-eslint/no-unused-vars, no-useless-escape */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2, Plus, Trash2, GripVertical, Eye, Save, ArrowUp, ArrowDown,
  ChevronDown, ChevronUp, FileText, Printer, Info, Sparkles,
  BookOpen, CheckCircle2, XCircle, AlertCircle
} from 'lucide-react'
import {
  getSettings, getAllProjects, getSkills, getJobPostings,
  getResumeWorkspace, saveResumeVariant, createResumeVariant, deleteResumeVariant,
  syncCandidateProfileFromSettings, isSupabaseConfigured, getApplications, updateApplication,
  createSkill
} from '@/lib/supabase'
import { ApplicationRecord, JobPosting, PortfolioSettings } from '@/types'
import { Project } from '@/types'
import { Skill } from '@/types'
import {
  ResumeContent, ResumeSection, ResumeVariant, ExperienceItem,
  ProjectExperienceItem, CustomExperienceItem,
  makeDefaultResumeContent,
  normalizeResumeContent,
  reorderResumeSections,
  RESUME_LAYOUT_PRESETS,
  ResumeLayoutPreset,
  ResumeSectionType,
} from '@/types/resume'
import { ResumePreview, PAPER_W, PAPER_H } from '@/components/admin/ResumePreview'
import { cn } from '@/lib/utils'
import { getAdminPath } from '@/lib/adminConfig'
import { saveResumePrintDraft } from '@/lib/resumePrint'
import {
  generateResumeBullets,
  generateResumeSummary,
  generateResumeSubtitle,
  improveResumeBullet,
  tailorResumeToJob,
  analyzeJdMatch,
} from '@/lib/resumeAi'

// ─── Gemini API ───────────────────────────────────────────────────────────────

const HAS_RESUME_AI = isSupabaseConfigured
const GEMINI_KEY = HAS_RESUME_AI ? 'supabase-edge-function' : undefined
// gemini-2.5-flash: free tier 15 req/min, 500 req/day — GA as of 2025
const GEMINI_MODEL = 'gemini-2.5-flash'

const SECTION_LABELS: Record<ResumeSectionType, string> = {
  summary: 'Summary',
  experience: 'Projects / Experience',
  skills: 'Skills',
  education: 'Education',
}

const LAYOUT_PRESET_OPTIONS: {
  id: ResumeLayoutPreset
  label: string
  description: string
}[] = [
  {
    id: 'projectFirst',
    label: 'Project-first',
    description: 'Lead with projects, then skills and education.',
  },
  {
    id: 'educationFirst',
    label: 'Education-first',
    description: 'Best for internships and new-grad applications.',
  },
  {
    id: 'skillsFirst',
    label: 'Skills-first',
    description: 'Highlight stack and keywords before project detail.',
  },
]

/**
 * Base Gemini call with thinking DISABLED.
 * Gemini 2.5 Flash uses "thinking" by default — it burns hundreds of tokens
 * on internal reasoning before writing the actual answer, which truncates
 * our output when maxOutputTokens is modest. Setting thinkingBudget: 0
 * disables thinking so all tokens go straight to the response.
 */
async function gemini(prompt: string, apiKey: string, maxTokens = 1200): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: maxTokens,
          // Disable thinking — resume writing is straightforward, no deep reasoning needed
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `Gemini error ${res.status}`)
  }
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

/**
 * Parse Gemini bullet-list responses robustly.
 * Gemini 2.5 often adds preamble lines ("Here are 4 bullets:") or trailing
 * commentary. We filter these out by keeping only lines that:
 *  - Start with a capital letter followed by lowercase (action verb pattern)
 *  - Are 40–300 characters (actual bullet length)
 *  - Don't look like headers / meta-commentary
 */
function parseBulletLines(text: string, limit = 4): string[] {
  // Strip any markdown bold/italic wrappers first
  const cleaned = text.replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')

  const SKIP = /^(here are|these are|below are|the following|note:|output:|result:|bullet|example|i've|i have|please|sure|absolutely|of course|certainly)/i

  return cleaned
    .split('\n')
    .map(l => l.trim())
    // Strip leading list markers: "1.", "•", "-", "*", "1)", etc.
    .map(l => l.replace(/^[\s\-•*\u2022\u2023\u25e6]+\s*/, '').replace(/^\d+[\.\)]\s*/, ''))
    .filter(l => {
      if (l.length < 40 || l.length > 320) return false   // too short = preamble, too long = paragraph
      if (SKIP.test(l)) return false                        // filter meta commentary
      if (/[?:]$/.test(l)) return false                     // headers end in ? or :
      return true
    })
    .slice(0, limit)
}

/** Generate 4 STAR-formula bullets using Gemini */
async function callGeminiForBullets(project: Project, apiKey: string): Promise<string[]> {
  const cleanDesc = project.description
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    .replace(/\|.*\|/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 1800)
    .trim()

  const tags = (project.tags ?? []).join(', ') || 'Python'

  const prompt = `You are an expert resume writer for data science and software engineering roles.

Write EXACTLY 4 resume bullet points for the project below. Follow these rules strictly:

RULES:
- Each bullet starts with a PAST-TENSE action verb (Built, Developed, Engineered, Designed, Optimized, Analyzed, Evaluated, Implemented, Deployed, Processed, Automated, Constructed…)
- STAR formula: [Verb] + [What you did + tools/tech + scale] + [quantified result or outcome]
- CRITICAL RULE: ABSOLUTELY NO PLACEHOLDERS. NEVER use "[X]", "[X]%", "[Metric]", or any bracketed text.
- If you don't have a specific metric from the description, describe the outcome qualitatively (e.g., "significantly improved performance" instead of "achieved [X]% performance").
- 80–175 characters per bullet — no shorter, no longer
- NEVER start with "I", "We", "Responsible for", "Helped", "Utilized", "Leveraged", or "Used X to"
- Use numbers already in the description (e.g. "3.4M+ orders", "493 subjects", "95% accuracy"). If none exist, do not invent them.

COVER THESE 4 ASPECTS IN ORDER:
Line 1: What was BUILT — the system/model/pipeline name + core algorithms + tech stack
Line 2: DATA & SCALE — dataset size, source, preprocessing steps, feature engineering
Line 3: METHODOLOGY — model selection/comparison, validation strategy, training approach
Line 4: RESULTS & DEPLOYMENT — metric achieved + how it was deployed/evaluated/presented

Project title: ${project.title}
Technologies: ${tags}
Description: ${cleanDesc}

IMPORTANT: Output EXACTLY 4 lines. Each line is one bullet. No numbering. No dashes. No headers. No explanation before or after. Start writing the first bullet immediately.`

  const text = await gemini(prompt, apiKey, 1200)
  const bullets = parseBulletLines(text, 4)

  // If we somehow got fewer than 4, pad with template stubs so UI always shows 4 slots
  while (bullets.length < 4) {
    const stubs = [
      `Built [system] using ${tags}, processing data to achieve measurable results.`,
      `Processed and cleaned real-world data using ${tags}, engineering key features.`,
      `Evaluated model architectures using precision@k, recall@k, and NDCG@k metrics.`,
      `Deployed solution as [Streamlit app / REST API] and presented findings to stakeholders.`,
    ]
    bullets.push(stubs[bullets.length] ?? '')
  }

  return bullets
}

/** AI-written summary using all portfolio context (Local Fallback) */
async function callGeminiForSummary(
  s: PortfolioSettings,
  includedSkills: Skill[],
  includedProjects: Project[],
  expItems: ExperienceItem[],
  apiKey: string
): Promise<string> {
  const edu = s.education[0]
  const degree = edu ? `${edu.title} at ${edu.issuer} (${edu.date})` : ''
  const topSkills = includedSkills.slice(0, 12).map(sk => sk.name).join(', ')
  const projTitles = includedProjects.slice(0, 4).map(p => p.title).join(', ')
  // Grab 1 bullet from each project item for context
  const sampleBullets = expItems
    .slice(0, 3)
    .flatMap(it => it.bullets.slice(0, 1))
    .filter(Boolean)
    .join(' | ')

  const prompt = `You are an expert resume writer for data science and AI/ML roles.

Write a professional resume summary of exactly 3–4 sentences (70–100 words total). It must:
1. Sentence 1: Lead with degree/title + institution + specialties (ML, NLP, deep learning, etc.)
2. Sentence 2: Highlight core technical skills exclusively from the list below, naturally embedded
3. Sentence 3: Include a concrete achievement or qualitative impact
4. Sentence 4: End with the value/impact the candidate brings to employers
Rules:
- Write in third person, past/present tense — NO "I" or "My"
- NEVER use placeholders like "[X]%" or "[metric]". If a metric is unknown, describe the impact qualitatively.
- Use ATS keywords naturally (do not stuff)
- Sound human and confident, not generic
- NO phrases like "results-driven", "passionate team player", "hard worker"

Candidate info:
Education: ${degree || 'Not specified'}
Location: ${s.location || 'Not specified'}
Skills: ${topSkills}
Projects: ${projTitles}
Sample work context: ${sampleBullets || 'Not available'}

IMPORTANT: Output ONLY the summary paragraph (3–4 sentences). No labels. No headings. Start writing immediately.`

  return (await gemini(prompt, apiKey, 600)).trim()
}

/** Rewrite a single bullet to be stronger */
async function callGeminiImproveBullet(
  bullet: string,
  projectTitle: string,
  tags: string[],
  apiKey: string
): Promise<string> {
  const prompt = `You are an expert resume writer. Rewrite the resume bullet below to be stronger and more impactful.

RULES:
1. Keep the same core facts — do NOT invent numbers
2. Start with a strong PAST-TENSE action verb (Built, Engineered, Developed, Optimized, Analyzed, Evaluated, Deployed, Automated, Implemented…)
3. Add "[X]" or "[X]%" placeholder if a metric is missing or vague
4. Output must be 80–175 characters
5. NEVER start with "I", "We", "Responsible for", "Leveraged", "Utilized"

Project: ${projectTitle}
Technologies: ${tags.join(', ')}
Original bullet: ${bullet}

IMPORTANT: Output ONLY the single improved bullet on one line. No quotes. No explanation. No dash at the start. Start writing the bullet immediately.`

  const raw = (await gemini(prompt, apiKey, 400)).trim()
  // Strip any leading list markers or quotes Gemini adds despite instructions
  const cleaned = raw
    .split('\n')[0]  // only the first line — ignore any follow-up commentary
    .trim()
    .replace(/^[-•*"'\d.)\s]+/, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .trim()
  // Sanity check: if result is less than 20 chars Gemini gave garbage, return original
  return cleaned.length >= 20 ? cleaned : bullet
}

/** Generate a short subtitle for a project entry (the "— subtitle" part) */
async function callGeminiForSubtitle(project: Project, apiKey: string): Promise<string> {
  const cleanDesc = project.description
    .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').slice(0, 600).trim()

  const prompt = `Write a short subtitle (4–8 words) describing this project's type. It appears after an em-dash on a resume: "Project Title — [subtitle]".

Good examples: "Hybrid ML Ranking Pipeline", "NLP Topic Modeling System", "Deep Learning Classification Model", "End-to-End Data Analysis Pipeline"

Project title: ${project.title}
Technologies: ${(project.tags ?? []).join(', ')}
Description (excerpt): ${cleanDesc}

IMPORTANT: Output ONLY the subtitle words (4–8 words). No quotes. No dash. No punctuation at the end. Start immediately.`

  const raw = (await gemini(prompt, apiKey, 200)).trim()
  // Take first line only, strip any quotes/punctuation Gemini adds
  return raw.split('\n')[0].trim().replace(/^["']|["']$/g, '').replace(/[.:!?]$/, '')
}

/** Tailor entire resume to a job description — returns updated summary + per-entry bullets */
async function callGeminiTailorToJD(
  jd: string,
  currentSummary: string,
  expItems: ExperienceItem[],
  projects: Project[],
  skills: Skill[],
  apiKey: string
): Promise<{ summary: string; bullets: Record<number, string[]> }> {
  // Build a compact snapshot of current resume content
  const entriesSnapshot = expItems.map((it, i) => {
    const title = it.kind === 'project'
      ? (it.titleOverride || projects.find(p => p.id === it.projectId)?.title || '')
      : it.role
    const tags = it.kind === 'project'
      ? (projects.find(p => p.id === it.projectId)?.tags ?? []).join(', ')
      : ''
    return `Entry ${i} — ${title} [${tags}]:\n${it.bullets.filter(Boolean).map(b => `  • ${b}`).join('\n')}`
  }).join('\n\n')

  const prompt = `You are an expert resume writer and ATS optimization specialist.

Tailor the resume below to the job description provided. Your goal is to maximize keyword alignment and relevance without fabricating experience.

RULES:
1. Keep all facts truthful — use the same projects/roles, only rephrase bullets to emphasize relevant skills
2. Rewrite the summary to open with keywords from the JD (naturally)
3. For each project entry, rewrite bullets to emphasize skills mentioned in the JD
4. Use exact phrases from the JD where they honestly apply (e.g. "machine learning pipelines", "cross-functional teams")
5. DO NOT use "[X]" or "[X]%" placeholders. Focus on relevant qualitative skills and technical alignment.
6. Each bullet: 60–175 chars, past-tense action verb first
7. DYNAMIC BULLET ALLOCATION: Rank entries by relevance to the JD.
   - Highly relevant: 4–6 detailed bullets to maximize keyword matches
   - Somewhat relevant: 3–4 bullets
   - Irrelevant/older: 1–2 short bullets just to show continuous experience

JOB DESCRIPTION:
${jd.slice(0, 2000)}

CURRENT SUMMARY:
${currentSummary || '(none yet)'}

CURRENT EXPERIENCE ENTRIES:
${entriesSnapshot}

SKILLS AVAILABLE: ${skills.map(s => s.name).join(', ')}

Output as JSON exactly in this format (no markdown code block):
{
  "summary": "the rewritten summary paragraph",
  "entries": [
    { "index": 0, "bullets": ["bullet1", "bullet2", "bullet3", "bullet4"] },
    ...one object per entry...
  ]
}`

  const raw = (await gemini(prompt, apiKey, 3000)).trim()
  // Strip markdown code fences if Gemini wraps it anyway
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  type TailorOutput = { summary?: string; entries?: { index?: number; bullets?: string[] }[] }
  const parsed = JSON.parse(jsonStr) as TailorOutput

  const bullets: Record<number, string[]> = {}
  for (const entry of (parsed.entries ?? [])) {
    if (typeof entry.index === 'number' && Array.isArray(entry.bullets)) {
      bullets[entry.index] = entry.bullets.filter((b: string) => b.length > 5).slice(0, 7)
    }
  }

  return { summary: parsed.summary?.trim() ?? currentSummary, bullets }
}

// ─── ScaledPreviewWrapper ─────────────────────────────────────────────────────

/**
 * Renders children at exactly PAPER_W wide, then CSS-scales them to fit the
 * container. This is the same technique Canva/Zety/Kickresume use so that
 * the preview is WYSIWYG — identical to the printed output.
 */
/* eslint-enable @typescript-eslint/no-unused-vars, no-useless-escape */
function ScaledPreviewWrapper({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const w = el.getBoundingClientRect().width
      setScale(Math.min(1, w / PAPER_W))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', overflow: 'hidden', position: 'relative', height: PAPER_H * scale }}>
      <div style={{ width: PAPER_W, transformOrigin: 'top left', transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function buildContactLineFromSettings(s: PortfolioSettings): string {
  const parts: string[] = []
  if (s.location) parts.push(s.location)
  if (s.contact_email) parts.push(s.contact_email)
  // Always include portfolio, LinkedIn, and GitHub
  const portfolioHost = typeof window !== 'undefined' ? window.location.hostname : 'prajwalparajuli.com.np'
  if (portfolioHost && portfolioHost !== 'localhost') parts.push(portfolioHost)
  if (s.linkedin_url) parts.push(s.linkedin_url.replace(/^https?:\/\//, ''))
  if (s.github_url) parts.push(s.github_url.replace(/^https?:\/\//, ''))
  return parts.join('  ')
}

function normalizeResumeForSettings(
  content: ResumeContent | null | undefined,
  settings: PortfolioSettings
): ResumeContent {
  return normalizeResumeContent(
    content ?? makeDefaultResumeContent(
      settings.site_title || '',
      buildContactLineFromSettings(settings),
      settings.education.length
    ),
    {
      name: settings.site_title || '',
      contactLine: buildContactLineFromSettings(settings),
      educationCount: settings.education.length,
    }
  )
}

function buildVariantCopyName(variant: ResumeVariant): string {
  const base = variant.name.trim() || 'Resume Variant'
  if (/tailored/i.test(base)) return `${base} Copy`
  if (variant.isPrimary) return 'Tailored Resume'
  return `${base} Copy`
}

function buildJobVariantName(job: JobPosting): string {
  const parts = [job.company.trim(), job.title.trim()].filter(Boolean)
  const compact = parts.join(' · ')
  return compact || 'Tailored Resume'
}

function buildVariantSnapshot(variant: ResumeVariant | null, content: ResumeContent | null): string {
  if (!variant || !content) return ''

  return JSON.stringify({
    id: variant.id,
    name: variant.name,
    variantType: variant.variantType,
    isPrimary: variant.isPrimary,
    sourceJobTitle: variant.sourceJobTitle,
    sourceJobCompany: variant.sourceJobCompany,
    sourceJobUrl: variant.sourceJobUrl,
    notes: variant.notes,
    content,
  })
}

function mergeSavedVariantList(
  variants: ResumeVariant[],
  savedVariant: ResumeVariant,
  previousVariantId?: string | null
): ResumeVariant[] {
  const next = variants
    .filter((variant) => variant.id !== savedVariant.id && variant.id !== previousVariantId)
    .map((variant) =>
      savedVariant.isPrimary
        ? {
            ...variant,
            isPrimary: false,
          }
        : variant
    )

  return [savedVariant, ...next]
}

// ─── bullet quality ──────────────────────────────────────────────────────────

// Strong past-tense action verbs that pass ATS and grab recruiters
const ACTION_VERBS_BY_TYPE = {
  Built: ['Built', 'Developed', 'Engineered', 'Designed', 'Implemented', 'Architected', 'Created'],
  Analyzed: ['Analyzed', 'Evaluated', 'Investigated', 'Modeled', 'Assessed', 'Diagnosed'],
  Improved: ['Optimized', 'Improved', 'Enhanced', 'Reduced', 'Increased', 'Accelerated', 'Boosted'],
  Deployed: ['Deployed', 'Launched', 'Delivered', 'Shipped', 'Published', 'Automated', 'Integrated'],
  Led: ['Led', 'Coordinated', 'Collaborated', 'Presented', 'Communicated'],
}

const ALL_ACTION_VERBS_FLAT = Object.values(ACTION_VERBS_BY_TYPE).flat()

/**
 * Score a single bullet for ATS / recruiter quality.
 * Returns 3 booleans: hasVerb, hasMetric, goodLength
 */
function scoreBullet(b: string): { hasVerb: boolean; hasMetric: boolean; goodLength: boolean } {
  const trimmed = b.trim()
  const firstWord = trimmed.split(/\s+/)[0] ?? ''
  const hasVerb = ALL_ACTION_VERBS_FLAT.some(v => firstWord.toLowerCase() === v.toLowerCase())
    || /^[A-Z][a-z]+ed|[A-Z][a-z]+ed/.test(firstWord)  // any past-tense verb (ends in -ed or similar)
  const hasMetric = /\d+[%+kKMBx]?|\d+\s*(percent|x|times|users|items|features|queries|ms|seconds|hours)|\$\d/.test(trimmed)
  const goodLength = trimmed.length >= 40 && trimmed.length <= 175
  return { hasVerb, hasMetric, goodLength }
}

/**
 * Generate STAR-structured bullet suggestions from a project.
 * These follow the formula: [Action Verb] + [What you did] + [How/tools] + [Quantified Result].
 * Uses the project description, tags, and title to populate the technical context.
 * Metric placeholders are inserted so the user knows to fill them in.
 */
function extractBulletsFromProject(project: Project): string[] {
  // ── Step 1: clean raw text ─────────────────────────────────────────────────
  const raw = project.description
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
    .replace(/[\u2600-\u27BF]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\S+\.(py|md|txt|js|ts|json|yaml|yml|sh|ipynb|env|csv)\b/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/#{1,6}\s+[^\n]*/g, '')
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    .replace(/\|.*\|/g, '')
    .replace(/[-_*]{3,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const SKIP = [
    /^(install|usage|getting started|table of contents|license|contributing|requirements|prerequisites|demo|note|setup|run|bash|sh|npm|pip|git|docker|streamlit|curl)/i,
    /^[A-Z_]{3,}:/,
  ]

  // ── Step 2: find good candidate sentences from description ─────────────────
  const candidates = raw
    .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
    .map(s => s.trim())
    .filter(s => {
      if (s.length < 30 || s.length > 220) return false
      if (SKIP.some(re => re.test(s))) return false
      if (/^(This|The project|I |We )/.test(s)) return false
      return true
    })
    .map(s => s.length > 170 ? s.slice(0, 167) + '…' : s)

  // ── Step 3: extract tech stack from tags ──────────────────────────────────
  const tags = (project.tags ?? []).slice(0, 5).join(', ')
  const techStr = tags || 'Python'

  // ── Step 4: pick up any numbers already in the description ────────────────
  const numbersInDesc = raw.match(/\b\d[\d,.+kKMB%]*\b/g) ?? []
  const bigNumbers = numbersInDesc.filter(n => parseFloat(n.replace(/,/g, '')) > 99)

  // ── Step 5: build STAR-formula bullets ────────────────────────────────────
  const results: string[] = []

  // Bullet 1 — WHAT you built (pipeline / system bullet)
  if (candidates[0]) {
    // Ensure it starts with a past-tense verb
    const first = candidates[0]
    const startsWithVerb = ALL_ACTION_VERBS_FLAT.some(v => first.toLowerCase().startsWith(v.toLowerCase()))
    results.push(startsWithVerb ? first : `Built ${first.charAt(0).toLowerCase() + first.slice(1)}`)
  } else {
    results.push(`Built [describe the system/model] using ${techStr}.`)
  }

  // Bullet 2 — DATA / SCALE bullet (with real numbers if found)
  if (candidates[1]) {
    results.push(candidates[1])
  } else if (bigNumbers.length > 0) {
    results.push(`Processed ${bigNumbers[0]}+ records/samples using ${techStr}, enabling [describe outcome].`)
  } else {
    results.push(`Processed and cleaned large-scale real-world data using ${techStr || 'Python'}, handling missing values, outliers, and feature engineering.`)
  }

  // Bullet 3 — RESULT / IMPACT bullet
  if (candidates[2]) {
    results.push(candidates[2])
  } else {
    const metricText = bigNumbers[1] ? `Achieved ${bigNumbers[1]} accuracy / improvement` : 'Improved model performance significantly'
    results.push(`${metricText}; deployed as [Streamlit app / REST API / notebook] and presented findings to [audience].`)
  }

  // Bullet 4 — VALIDATION / EVALUATION bullet (optional but recommended for DS)
  if (candidates[3]) {
    results.push(candidates[3])
  }

  return results.filter(Boolean).slice(0, 4)
}

// ─── summary template ─────────────────────────────────────────────────────────

/**
 * Generate a STAR-structured summary template from portfolio settings.
 * Formula (best practice per Columbia / Resumly):
 *   [Title] with [context]. Skilled in [tools]. [Achievement]. [Goal/value prop].
 */
function buildSummaryTemplate(s: PortfolioSettings, skills: Skill[]): string {
  const topSkills = skills.slice(0, 5).map(sk => sk.name).join(', ')
  const edu = s.education[0]
  const degree = edu ? `${edu.title} candidate at ${edu.issuer}` : 'Data Science professional'
  const location = s.location || ''
  return [
    `${degree}${location ? ` based in ${location}` : ''} with hands-on research and project experience in machine learning, deep learning, and NLP.`,
    `Skilled in ${topSkills || 'Python, SQL, and machine learning frameworks'}, with a strong foundation in statistics, data wrangling, and end-to-end model development.`,
    `Proven ability to transform complex datasets into actionable insights, driving robust outcomes and measurable business impact on [project type].`,
    `Passionate about building interpretable, production-ready AI solutions that drive measurable business impact.`,
  ].join(' ')
}

// ─── sub-components ───────────────────────────────────────────────────────────

// ─── BulletQualityBadge ───────────────────────────────────────────────────────

function BulletQualityBadge({ label, ok, warn }: { label: string; ok: boolean; warn?: boolean }) {
  const Icon = ok ? CheckCircle2 : warn ? AlertCircle : XCircle
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full border font-medium',
      ok ? 'border-green-600/40 text-green-400' :
      warn ? 'border-yellow-600/40 text-yellow-400' :
      'border-white/10 text-muted-foreground/50'
    )}>
      <Icon className="h-2.5 w-2.5" /> {label}
    </span>
  )
}

// ─── ActionVerbChips ──────────────────────────────────────────────────────────

const QUICK_VERBS = ['Built', 'Developed', 'Engineered', 'Designed', 'Optimized', 'Analyzed', 'Deployed', 'Reduced', 'Increased', 'Led']

interface ActionVerbChipsProps {
  onInsert: (verb: string) => void
}

function ActionVerbChips({ onInsert }: ActionVerbChipsProps) {
  return (
    <div className="flex flex-wrap gap-1 mb-1.5">
      {QUICK_VERBS.map(v => (
        <button key={v} type="button" onClick={() => onInsert(v)}
          className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-muted-foreground hover:border-blue-500/50 hover:text-blue-400 transition-colors bg-black/30">
          {v}
        </button>
      ))}
    </div>
  )
}

// ─── BulletListEditor ─────────────────────────────────────────────────────────

interface BulletListEditorProps {
  bullets: string[]
  onChange: (bullets: string[]) => void
  onImproveBullet?: (index: number, bullet: string) => Promise<void>
}

function BulletListEditor({ bullets, onChange, onImproveBullet }: BulletListEditorProps) {
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([])
  const [improvingIdx, setImprovingIdx] = useState<number | null>(null)

  const update = (i: number, val: string) => {
    const next = [...bullets]; next[i] = val; onChange(next)
  }
  const remove = (i: number) => onChange(bullets.filter((_, idx) => idx !== i))
  const add = () => onChange([...bullets, ''])

  const insertVerb = (i: number, verb: string) => {
    const cur = bullets[i] ?? ''
    // If bullet is empty or just whitespace, set to verb + space
    // If it starts with a word, replace first word
    const trimmed = cur.trimStart()
    const firstWordEnd = trimmed.search(/\s/)
    if (!trimmed || firstWordEnd === -1) {
      update(i, verb + (trimmed ? ' ' + trimmed.replace(/^\S+\s*/, '') : ' '))
    } else {
      update(i, verb + ' ' + trimmed.slice(firstWordEnd + 1))
    }
    textareaRefs.current[i]?.focus()
  }

  return (
    <div className="space-y-3">
      {/* Formula reminder */}
      <div className="rounded-md bg-blue-950/30 border border-blue-800/30 px-3 py-2 text-[11px] text-blue-300/80">
        <span className="font-semibold text-blue-300">Formula: </span>
        <span className="text-blue-200/70">[Action Verb]</span>
        {' + '}
        <span className="text-blue-200/70">[What you did + tools/scale]</span>
        {' + '}
        <span className="text-blue-200/70">[Quantified result — use a number!]</span>
      </div>

      {bullets.map((b, i) => {
        const score = b.trim() ? scoreBullet(b) : null
        return (
          <div key={i} className="space-y-1">
            <ActionVerbChips onInsert={v => insertVerb(i, v)} />
              <div className="flex gap-2 items-start">
              <span className="mt-2 text-muted-foreground text-xs select-none pt-1">•</span>
              <div className="flex-1 space-y-1">
                <Textarea
                  ref={el => { textareaRefs.current[i] = el }}
                  value={b}
                  onChange={e => update(i, e.target.value)}
                  placeholder={i === 0
                    ? 'Built [system/model] using [tech], processing large-scale records to achieve [outcome].'
                    : i === 1
                    ? 'Engineered [feature] from [data source], reducing [metric] significantly through [method].'
                    : 'Evaluated model using [metric] / accuracy; deployed as [app/API].'}
                  className="bg-black/40 border-white/10 text-sm flex-1 min-h-[52px] resize-none"
                  rows={2}
                />
                {/* Quality badges + improve button */}
                {score && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <BulletQualityBadge label="Action verb" ok={score.hasVerb} />
                    <BulletQualityBadge label="Has metric" ok={score.hasMetric} warn={!score.hasMetric} />
                    <BulletQualityBadge
                      label={score.goodLength ? 'Good length' : b.length < 40 ? 'Too short' : 'Too long'}
                      ok={score.goodLength}
                      warn={b.length < 40}
                    />
                    {onImproveBullet && b.trim().length > 10 && (
                      <button
                        type="button"
                        disabled={improvingIdx === i}
                        onClick={async () => {
                          setImprovingIdx(i)
                          try { await onImproveBullet(i, b) } finally { setImprovingIdx(null) }
                        }}
                        className="ml-auto inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border border-purple-600/40 text-purple-400 hover:border-purple-400 hover:text-purple-300 transition-colors"
                        title="Rewrite this bullet using the secure resume AI function"
                      >
                        {improvingIdx === i
                          ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          : <Sparkles className="h-2.5 w-2.5" />}
                        {improvingIdx === i ? 'Improving…' : 'AI improve'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}
                className="text-destructive hover:text-destructive shrink-0 mt-1 h-7 w-7 p-0">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )
      })}
      {bullets.length < 8 && (
        <Button type="button" variant="ghost" size="sm" onClick={add}
          className="text-muted-foreground hover:text-white gap-1 text-xs h-7 px-2">
          <Plus className="h-3 w-3" /> Add bullet
        </Button>
      )}
    </div>
  )
}

interface ExperienceItemEditorProps {
  item: ExperienceItem
  projects: Project[]
  onUpdate: (item: ExperienceItem) => void
  onRemove: () => void
  index: number
  geminiKey?: string
  orphanedSkillsNames?: string[]
}

function ExperienceItemEditor({ item, projects, onUpdate, onRemove, index, geminiKey, orphanedSkillsNames = [] }: ExperienceItemEditorProps) {
  const [expanded, setExpanded] = useState(index === 0)
  const [suggesting, setSuggesting] = useState(false)
  const [subtitling, setSubtitling] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)

  const linkedProject = item.kind === 'project'
    ? projects.find(p => p.id === item.projectId) ?? null
    : null

  const displayTitle = item.kind === 'project'
    ? (item.titleOverride || linkedProject?.title || 'Untitled project')
    : (item.role || 'Custom experience')

  const handleSuggestBullets = async () => {
    if (!linkedProject) return
    setSuggestError(null)
    setSuggesting(true)
    try {
      const bullets = geminiKey
        ? await generateResumeBullets(linkedProject)
        : extractBulletsFromProject(linkedProject)
      onUpdate({ ...item, bullets })
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : 'Failed to generate bullets')
    } finally {
      setSuggesting(false)
    }
  }

  const handleAutoSubtitle = async () => {
    if (!linkedProject || !geminiKey) return
    setSubtitling(true)
    try {
      const subtitle = await generateResumeSubtitle(linkedProject)
      onUpdate({ ...item, subtitle })
    } catch {
      // silently ignore — subtitle is optional
    } finally {
      setSubtitling(false)
    }
  }

  const handleImproveBullet = async (idx: number, bullet: string) => {
    if (!geminiKey) return
    const tags = linkedProject?.tags ?? []
    const title = displayTitle
    const improved = await improveResumeBullet(bullet, title, tags, orphanedSkillsNames)
    const bullets = [...item.bullets]
    bullets[idx] = improved
    onUpdate({ ...item, bullets })
  }

  return (
    <div className="rounded-lg bg-black/40 border border-white/10">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
        <Badge variant="outline" className="text-[10px] shrink-0">
          {item.kind === 'project' ? 'Project' : 'Custom'}
        </Badge>
        <span className="text-sm font-medium flex-1 truncate">{displayTitle}</span>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="text-destructive hover:text-destructive shrink-0 h-7 w-7 p-0">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
          {item.kind === 'project' ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Title shown on resume
                  {linkedProject && <span className="ml-1 opacity-50">(from "{linkedProject.title}")</span>}
                </Label>
                <Input
                  value={item.titleOverride}
                  onChange={e => onUpdate({ ...item, titleOverride: e.target.value })}
                  placeholder={linkedProject?.title || 'Project title'}
                  className="bg-black/20 border-white/10 text-sm"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Subtitle <span className="opacity-50">(after em-dash)</span></Label>
                  {geminiKey && linkedProject && (
                    <Button type="button" variant="ghost" size="sm" disabled={subtitling}
                      onClick={handleAutoSubtitle}
                      className="gap-1 text-[10px] h-5 px-1.5 text-purple-400 hover:text-purple-300">
                      {subtitling ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
                      {subtitling ? 'Writing…' : 'AI generate'}
                    </Button>
                  )}
                </div>
                <Input
                  value={item.subtitle ?? ''}
                  onChange={e => onUpdate({ ...item, subtitle: e.target.value })}
                  placeholder='e.g. "Hybrid ML Ranking Pipeline"'
                  className="bg-black/20 border-white/10 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Demo / Live URL</Label>
                  <Input
                    value={item.url ?? ''}
                    onChange={e => onUpdate({ ...item, url: e.target.value })}
                    placeholder="https://huggingface.co/…"
                    className="bg-black/20 border-white/10 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">GitHub URL</Label>
                  <Input
                    value={item.githubUrl ?? ''}
                    onChange={e => onUpdate({ ...item, githubUrl: e.target.value })}
                    placeholder="github.com/user/repo"
                    className="bg-black/20 border-white/10 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Organization <span className="opacity-50">(optional)</span></Label>
                  <Input
                    value={item.org}
                    onChange={e => onUpdate({ ...item, org: e.target.value })}
                    placeholder="e.g. University of Houston"
                    className="bg-black/20 border-white/10 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date Range</Label>
                  <Input
                    value={item.dateRange}
                    onChange={e => onUpdate({ ...item, dateRange: e.target.value })}
                    placeholder="e.g. Sep 2025 – Nov 2025"
                    className="bg-black/20 border-white/10 text-sm"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Role / Title</Label>
                  <Input
                    value={item.role}
                    onChange={e => onUpdate({ ...item, role: e.target.value })}
                    placeholder="e.g. Data Scientist"
                    className="bg-black/20 border-white/10 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Organization</Label>
                  <Input
                    value={item.org}
                    onChange={e => onUpdate({ ...item, org: e.target.value })}
                    placeholder="e.g. Acme Corp"
                    className="bg-black/20 border-white/10 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Subtitle <span className="opacity-50">(optional, after em-dash)</span></Label>
                <Input
                  value={item.subtitle ?? ''}
                  onChange={e => onUpdate({ ...item, subtitle: e.target.value })}
                  placeholder="e.g. Research project, Internship"
                  className="bg-black/20 border-white/10 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">URL <span className="opacity-50">(optional)</span></Label>
                  <Input
                    value={item.url ?? ''}
                    onChange={e => onUpdate({ ...item, url: e.target.value })}
                    placeholder="https://…"
                    className="bg-black/20 border-white/10 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date Range</Label>
                  <Input
                    value={item.dateRange}
                    onChange={e => onUpdate({ ...item, dateRange: e.target.value })}
                    placeholder="e.g. Jun 2022 – Aug 2023"
                    className="bg-black/20 border-white/10 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <Label className="text-xs text-muted-foreground">
                Bullet points <span className="opacity-60">(3–4 recommended)</span>
              </Label>
              {linkedProject && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSuggestBullets}
                  disabled={suggesting}
                  className={cn(
                    'gap-1 text-[11px] h-6 px-2 hover:text-white',
                    geminiKey ? 'text-purple-400 hover:text-purple-300' : 'text-muted-foreground'
                  )}
                  title={geminiKey ? 'Generate bullets using secure server-side AI' : 'Extract bullets from project description (no AI configured)'}
                >
                  {suggesting
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Sparkles className="h-3 w-3" />}
                  {geminiKey ? 'AI write bullets' : 'Suggest bullets'}
                </Button>
              )}
            </div>
            {suggestError && (
              <p className="text-[11px] text-red-400">{suggestError}</p>
            )}
            <BulletListEditor
              bullets={item.bullets}
              onChange={bullets => onUpdate({ ...item, bullets })}
              onImproveBullet={geminiKey ? handleImproveBullet : undefined}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── BestPracticesPanel ───────────────────────────────────────────────────────

function BestPracticesPanel() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-white transition-colors text-left"
      >
        <BookOpen className="h-4 w-4 text-blue-400" />
        <span>Resume writing best practices</span>
        <span className="ml-auto text-xs opacity-50">{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px] text-muted-foreground">

          {/* Bullet formula */}
          <div className="space-y-2">
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider">Bullet Point Formula</h4>
            <div className="rounded-md bg-blue-950/30 border border-blue-800/30 px-3 py-2 text-blue-200/80 font-mono text-[11px]">
              [Action Verb] + [What] + [How / tools / scale] + [Metric]
            </div>
            <p className="leading-relaxed">Start with a <span className="text-white">past-tense action verb</span> (Built, Developed, Engineered, Optimized…). Describe <span className="text-white">what you did and with what tools or data</span>. End with a <span className="text-yellow-400 font-medium">number</span> — accuracy, dataset size, % improvement, user count, speed gain.</p>
            <div className="space-y-1">
              <p className="text-red-400/80 line-through">Used Python to make a recommendation model.</p>
              <p className="text-green-400">Built a hybrid recommender (ALS + LightGBM) on 3.4M+ orders, achieving NDCG@10 of 0.82.</p>
            </div>
          </div>

          {/* 4-bullet structure for DS projects */}
          <div className="space-y-2">
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider">4-Bullet Structure for DS Projects</h4>
            <ol className="space-y-1.5 list-none">
              {[
                ['1', 'What you built', 'The system/model + key algorithms or tech stack'],
                ['2', 'Data & scale', 'Dataset size, source, preprocessing — show real-world messiness'],
                ['3', 'Features / methodology', 'Feature engineering, model selection, validation approach'],
                ['4', 'Result / deployment', 'Accuracy / metric + how it was deployed or presented'],
              ].map(([n, title, desc]) => (
                <li key={n} className="flex gap-2">
                  <span className="rounded-full bg-blue-500/20 text-blue-300 w-4 h-4 text-[10px] flex items-center justify-center shrink-0 mt-0.5">{n}</span>
                  <span><span className="text-white">{title}:</span> {desc}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Summary formula */}
          <div className="space-y-2">
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider">Summary Formula (70–100 words)</h4>
            <ol className="space-y-1.5 list-none">
              {[
                ['1', 'Sentence 1', 'Title/degree + institution + years of experience + specialties'],
                ['2', 'Sentence 2', 'Core tools + methodologies — mirror keywords from the job posting'],
                ['3', 'Sentence 3', 'Your biggest result with a metric ("achieving X% accuracy on Y project")'],
                ['4', 'Sentence 4', 'Value you bring / what you are passionate about building'],
              ].map(([n, title, desc]) => (
                <li key={n} className="flex gap-2">
                  <span className="rounded-full bg-purple-500/20 text-purple-300 w-4 h-4 text-[10px] flex items-center justify-center shrink-0 mt-0.5">{n}</span>
                  <span><span className="text-white">{title}:</span> {desc}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* ATS tips */}
          <div className="space-y-2">
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider">ATS + Recruiter Tips</h4>
            <ul className="space-y-1.5">
              {[
                ['✓', 'Use exact keywords from the job description (e.g. "LLM fine-tuning", "A/B testing")'],
                ['✓', 'Every bullet must start with a capital past-tense verb — ATS parses the first word'],
                ['✓', 'Include at least one number per bullet — % accuracy, dataset size, user count, time saved'],
                ['✓', '50–175 characters per bullet — short enough for a 6-second recruiter scan'],
                ['✓', '3–4 projects if no work experience; 1–2 if you have professional experience'],
                ['✗', 'Never start with "I", "We", "Responsible for", "Helped with", or "Used X to…"'],
                ['✗', 'Avoid vague adjectives: "great", "excellent", "various", "strong" — use metrics'],
              ].map(([icon, tip], i) => (
                <li key={i} className={cn('flex gap-1.5', icon === '✓' ? 'text-muted-foreground' : 'text-red-400/60')}>
                  <span className={icon === '✓' ? 'text-green-400 shrink-0' : 'shrink-0'}>{icon}</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      )}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export function AdminResumeEditor() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [settings, setSettings] = useState<PortfolioSettings | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([])
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [resume, setResume] = useState<ResumeContent | null>(null)
  const [resumeVariants, setResumeVariants] = useState<ResumeVariant[]>([])
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null)
  const [variantsSupported, setVariantsSupported] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showPreview, setShowPreview] = useState(true)
  const [activeSection, setActiveSection] = useState<ResumeSection['type'] | null>('summary')
  const [summaryGenerating, setSummaryGenerating] = useState(false)
  const [jdText, setJdText] = useState('')
  const [tailoring, setTailoring] = useState(false)
  const [tailorMsg, setTailorMsg] = useState<string | null>(null)
  const [showJDPanel, setShowJDPanel] = useState(false)
  const [tailorSummaryEnabled, setTailorSummaryEnabled] = useState(true)
  const [tailorBulletsEnabled, setTailorBulletsEnabled] = useState(true)
  const [utilityTab, setUtilityTab] = useState<'resume' | 'layout' | 'tailor'>('resume')
  
  // ATS Match State
  const [atsMatchScore, setAtsMatchScore] = useState<number | null>(null)
  const [atsMatchKeywords, setAtsMatchKeywords] = useState<{ found: string[]; missing: string[] } | null>(null)
  const [atsRedFlags, setAtsRedFlags] = useState<string[]>([])
  const [analyzingAts, setAnalyzingAts] = useState(false)

  // Quick skill add
  const [newSkillName, setNewSkillName] = useState('')
  const [addingSkill, setAddingSkill] = useState(false)

  // Derived state for orphaned skills
  const orphanedSkillsNames = useMemo(() => {
    if (!resume || !skills) return []
    const skillsSection = resume.sections.find(s => s.type === 'skills') as import('@/types/resume').ResumeSkillsSection | undefined
    const expSection = resume.sections.find(s => s.type === 'experience') as import('@/types/resume').ResumeExperienceSection | undefined
    if (!skillsSection || !expSection) return []
    
    const includedSkillObjs = skillsSection.includedIds === 'all' 
      ? skills 
      : skills.filter(sk => Array.isArray(skillsSection.includedIds) && skillsSection.includedIds.includes(sk.id))
      
    const allBulletsText = expSection.items.flatMap(i => i.bullets).join(' ').toLowerCase()
    
    return includedSkillObjs
      .filter(sk => !allBulletsText.includes(sk.name.toLowerCase()))
      .map(sk => sk.name)
  }, [resume, skills])

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const hydratedSelectedJobKeyRef = useRef<string | null>(null)
  const lastSavedVariantSnapshotRef = useRef('')
  const hasHydratedResumeRef = useRef(false)

  const loadWorkspace = useCallback(
    async (nextSettings: PortfolioSettings, preferredVariantId?: string | null) => {
      const workspace = await getResumeWorkspace(nextSettings)
      const selectedVariant =
        workspace.variants.find((variant) => variant.id === preferredVariantId) ??
        workspace.variants.find((variant) => variant.isPrimary) ??
        workspace.variants[0] ??
        null
      const normalizedContent = selectedVariant
        ? normalizeResumeForSettings(selectedVariant.content, nextSettings)
        : null

      setVariantsSupported(workspace.variantsSupported)
      setResumeVariants(workspace.variants)
      setActiveVariantId(selectedVariant?.id ?? null)
      setResume(normalizedContent)
      lastSavedVariantSnapshotRef.current = buildVariantSnapshot(selectedVariant, normalizedContent)
      hasHydratedResumeRef.current = true
    },
    []
  )

  // Load all data
  useEffect(() => {
    void Promise.all([getSettings(), getAllProjects(), getSkills(), getJobPostings(), getApplications()]).then(
      async ([s, p, sk, jp, apps]) => {
        setSettings(s)
        setProjects(p)
        setSkills(sk)
        setJobPostings(jp ?? [])
        setApplications(apps ?? [])
        await loadWorkspace(s)
      }
    )
  }, [loadWorkspace])

  const activeVariant =
    resumeVariants.find((variant) => variant.id === activeVariantId) ?? resumeVariants[0] ?? null
  const selectedJobId = searchParams.get('job')?.trim() || ''
  const selectedApplicationId = searchParams.get('application')?.trim() || ''
  const selectedJob =
    jobPostings.find((job) => job.id === selectedJobId) ?? null
  const selectedApplication =
    applications.find((application) => application.id === selectedApplicationId) ??
    applications.find((application) => application.job_posting_id === selectedJobId) ??
    null

  const updateSection = useCallback(<T extends ResumeSection>(type: T['type'], patch: Partial<T>) => {
    setResume(prev => {
      if (!prev) return prev
      return {
        ...prev,
        sections: prev.sections.map(s => s.type === type ? { ...s, ...patch } as ResumeSection : s),
      }
    })
  }, [])

  const moveSection = useCallback((type: ResumeSectionType, direction: 'up' | 'down') => {
    setResume((prev) => {
      if (!prev) return prev
      const index = prev.sections.findIndex((section) => section.type === type)
      if (index === -1) return prev

      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= prev.sections.length) return prev

      const nextSections = [...prev.sections]
      const [section] = nextSections.splice(index, 1)
      nextSections.splice(targetIndex, 0, section)

      return {
        ...prev,
        sections: nextSections,
      }
    })
  }, [])

  const applyLayoutPreset = useCallback((preset: ResumeLayoutPreset) => {
    setResume((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        sections: reorderResumeSections(prev.sections, RESUME_LAYOUT_PRESETS[preset]),
      }
    })
  }, [])

  const updateActiveVariant = useCallback((patch: Partial<ResumeVariant>) => {
    setResumeVariants((prev) =>
      prev.map((variant) =>
        variant.id === activeVariantId
          ? {
              ...variant,
              ...patch,
            }
          : variant
      )
    )
  }, [activeVariantId])

  useEffect(() => {
    const requestedTab = searchParams.get('tab')
    if (requestedTab === 'resume' || requestedTab === 'layout' || requestedTab === 'tailor') {
      setUtilityTab(requestedTab)
      if (requestedTab === 'tailor') {
        setShowJDPanel(true)
      }
    }
  }, [searchParams])

  useEffect(() => {
    if (!selectedJobId) {
      hydratedSelectedJobKeyRef.current = null
    }
  }, [selectedJobId])

  useEffect(() => {
    if (!selectedJob || !activeVariant) return

    const hydrationKey = `${selectedJob.id}:${activeVariant.id}`
    if (hydratedSelectedJobKeyRef.current === hydrationKey) return

    setUtilityTab('tailor')
    setShowJDPanel(true)
    setJdText(selectedJob.description || '')

    if (!activeVariant.isPrimary || !variantsSupported) {
      updateActiveVariant({
        sourceJobTitle: selectedJob.title,
        sourceJobCompany: selectedJob.company,
        sourceJobUrl: selectedJob.job_url,
      })
    }

    hydratedSelectedJobKeyRef.current = hydrationKey
  }, [activeVariant, selectedJob, updateActiveVariant, variantsSupported])

  const handleSelectVariant = useCallback((variantId: string) => {
    if (!settings) return
    const nextVariant = resumeVariants.find((variant) => variant.id === variantId)
    if (!nextVariant) return
    const normalizedContent = normalizeResumeForSettings(nextVariant.content, settings)

    setActiveVariantId(variantId)
    setResume(normalizedContent)
    lastSavedVariantSnapshotRef.current = buildVariantSnapshot(nextVariant, normalizedContent)
  }, [resumeVariants, settings])

  const clearSelectedJobContext = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('job')
    nextParams.delete('application')
    nextParams.delete('tab')
    setSearchParams(nextParams, { replace: true })
    hydratedSelectedJobKeyRef.current = null
  }, [searchParams, setSearchParams])

  const syncSelectedApplication = useCallback(async (
    savedVariantId: string,
    patch?: Partial<Pick<ApplicationRecord, 'status' | 'cover_letter' | 'resume_variant_id'>>
  ) => {
    if (!selectedApplication) return null

    const nextPatch: Partial<Pick<ApplicationRecord, 'status' | 'cover_letter' | 'resume_variant_id'>> = {
      resume_variant_id: savedVariantId,
      ...patch,
    }

    if (
      nextPatch.resume_variant_id === selectedApplication.resume_variant_id &&
      (nextPatch.status === undefined || nextPatch.status === selectedApplication.status) &&
      (nextPatch.cover_letter === undefined || nextPatch.cover_letter === selectedApplication.cover_letter)
    ) {
      return selectedApplication
    }

    const updated = await updateApplication(selectedApplication.id, nextPatch)
    if (updated) {
      setApplications((current) =>
        current.map((application) => (application.id === updated.id ? updated : application))
      )
    }

    return updated
  }, [selectedApplication])

  const applySelectedJobToCurrentVariant = useCallback(() => {
    if (!selectedJob) return
    setUtilityTab('tailor')
    setShowJDPanel(true)
    setJdText(selectedJob.description || '')
    updateActiveVariant({
      sourceJobTitle: selectedJob.title,
      sourceJobCompany: selectedJob.company,
      sourceJobUrl: selectedJob.job_url,
    })
    setTailorMsg('Loaded the selected job into this variant. Review the variant details, then tailor with AI.')
    setTimeout(() => setTailorMsg(null), 5000)
  }, [selectedJob, updateActiveVariant])

  const handleCreateVariantFromSelectedJob = useCallback(async () => {
    if (!resume || !settings || !activeVariant || !selectedJob) return

    setSaving(true)
    setSaveMsg(null)
    try {
      await syncCandidateProfileFromSettings(settings)
      const created = await createResumeVariant(
        {
          candidateProfileId: activeVariant.candidateProfileId,
          name: buildJobVariantName(selectedJob),
          variantType: 'tailored',
          isPrimary: false,
          sourceJobTitle: selectedJob.title,
          sourceJobCompany: selectedJob.company,
          sourceJobUrl: selectedJob.job_url,
          notes: `Tailored for ${selectedJob.company || 'selected company'} — imported from Jobs.`,
          content: resume,
        },
        { settings }
      )

      if (!created) {
        setSaveMsg('Run migration 003 to unlock saved resume variants. Your master resume still works.')
        return
      }

      if (selectedApplication) {
        await syncSelectedApplication(created.id, {
          status: selectedApplication.status === 'saved' ? 'tailoring' : selectedApplication.status,
        })
      }

      await loadWorkspace(settings, created.id)
      hydratedSelectedJobKeyRef.current = null
      setUtilityTab('tailor')
      setShowJDPanel(true)
      setJdText(selectedJob.description || '')
      setSaveMsg(selectedApplication
        ? 'Created and attached a job-specific variant. Tailor it with AI next.'
        : 'Created a job-specific variant. Tailor it with AI next.')
      setTimeout(() => setSaveMsg(null), 5000)
    } catch (error) {
      setSaveMsg(error instanceof Error ? error.message : 'Error creating the job-specific variant.')
    } finally {
      setSaving(false)
    }
  }, [activeVariant, loadWorkspace, resume, selectedApplication, selectedJob, settings, syncSelectedApplication])

  const jumpToEditorSection = useCallback((sectionKey: 'header' | ResumeSectionType) => {
    if (sectionKey === 'header') {
      setActiveSection(null)
    } else {
      setActiveSection(sectionKey)
    }

    const target = sectionRefs.current[sectionKey]
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const handleDuplicateVariant = useCallback(async () => {
    if (!resume || !settings || !activeVariant) return

    setSaving(true)
    setSaveMsg(null)
    try {
      await syncCandidateProfileFromSettings(settings)
      const duplicated = await createResumeVariant(
        {
          candidateProfileId: activeVariant.candidateProfileId,
          name: buildVariantCopyName(activeVariant),
          variantType: activeVariant.isPrimary ? 'tailored' : activeVariant.variantType,
          isPrimary: false,
          sourceJobTitle: activeVariant.sourceJobTitle,
          sourceJobCompany: activeVariant.sourceJobCompany,
          sourceJobUrl: activeVariant.sourceJobUrl,
          notes: activeVariant.notes,
          content: resume,
        },
        { settings }
      )

      if (!duplicated) {
        setSaveMsg('Run migration 003 to unlock saved resume variants. Your master resume still works.')
        return
      }

      await loadWorkspace(settings, duplicated.id)
      setSaveMsg('Created a new resume variant.')
      setTimeout(() => setSaveMsg(null), 3000)
    } catch (error) {
      setSaveMsg(error instanceof Error ? error.message : 'Error creating resume variant.')
    } finally {
      setSaving(false)
    }
  }, [activeVariant, loadWorkspace, resume, settings])

  const handleSetAsPrimaryVariant = useCallback(async () => {
    if (!resume || !settings || !activeVariant) return

    setSaving(true)
    setSaveMsg(null)
    try {
      const savedVariant = await saveResumeVariant(
        {
          ...activeVariant,
          variantType: 'master',
          isPrimary: true,
          content: resume,
        },
        { settings }
      )
      await loadWorkspace(settings, savedVariant.id)
      setSaveMsg('Set this resume as the primary master version.')
      setTimeout(() => setSaveMsg(null), 3000)
    } catch (error) {
      setSaveMsg(error instanceof Error ? error.message : 'Error promoting resume variant.')
    } finally {
      setSaving(false)
    }
  }, [activeVariant, loadWorkspace, resume, settings])

  const handleDeleteVariant = useCallback(async () => {
    if (!settings || !activeVariant || activeVariant.isPrimary) return

    const confirmed = window.confirm(`Delete "${activeVariant.name}"? This cannot be undone.`)
    if (!confirmed) return

    setSaving(true)
    setSaveMsg(null)
    try {
      const deleted = await deleteResumeVariant(activeVariant.id)
      if (!deleted) {
        setSaveMsg('Resume variants are not available yet. Apply migration 003 first.')
        return
      }

      await loadWorkspace(settings)
      setSaveMsg('Resume variant deleted.')
      setTimeout(() => setSaveMsg(null), 3000)
    } catch (error) {
      setSaveMsg(error instanceof Error ? error.message : 'Error deleting resume variant.')
    } finally {
      setSaving(false)
    }
  }, [activeVariant, loadWorkspace, settings])

  const expSection = resume?.sections.find(s => s.type === 'experience') as import('@/types/resume').ResumeExperienceSection | undefined
  const summSection = resume?.sections.find(s => s.type === 'summary') as import('@/types/resume').ResumeSummarySection | undefined
  const eduSection = resume?.sections.find(s => s.type === 'education') as import('@/types/resume').ResumeEducationSection | undefined
  const skillsSection = resume?.sections.find(s => s.type === 'skills') as import('@/types/resume').ResumeSkillsSection | undefined

  const addProjectExperience = (project: Project) => {
    if (!expSection) return
    const newItem: ProjectExperienceItem = {
      kind: 'project',
      projectId: project.id,
      titleOverride: project.title,
      subtitle: '',
      url: project.demo_url ?? '',
      githubUrl: project.github_url
        ? project.github_url.replace(/^https?:\/\//, '')
        : '',
      org: '',
      dateRange: '',
      bullets: extractBulletsFromProject(project),
    }
    updateSection('experience', { items: [...expSection.items, newItem] })
  }

  const addCustomExperience = () => {
    if (!expSection) return
    const newItem: CustomExperienceItem = {
      kind: 'custom',
      id: crypto.randomUUID(),
      role: '',
      subtitle: '',
      url: '',
      org: '',
      dateRange: '',
      bullets: [''],
    }
    updateSection('experience', { items: [...expSection.items, newItem] })
  }

  const updateExpItem = (index: number, item: ExperienceItem) => {
    if (!expSection) return
    const items = [...expSection.items]
    items[index] = item
    updateSection('experience', { items })
  }

  const removeExpItem = (index: number) => {
    if (!expSection) return
    updateSection('experience', { items: expSection.items.filter((_, i) => i !== index) })
  }

  const persistActiveVariant = useCallback(async (
    options?: {
      announce?: boolean
      resumeOverride?: ResumeContent
      applicationPatch?: Partial<Pick<ApplicationRecord, 'status' | 'cover_letter' | 'resume_variant_id'>>
    }
  ) => {
    const announce = options?.announce ?? false
    const contentToSave = options?.resumeOverride ?? resume
    if (!contentToSave || !settings) return null

    if (announce) {
      setSaving(true)
      setSaveMsg(null)
    }

    try {
      const baseVariant = activeVariant ?? {
        id: 'resume-variant-new-master',
        candidateProfileId: null,
        name: 'Master Resume',
        variantType: 'master' as const,
        isPrimary: true,
        sourceJobTitle: '',
        sourceJobCompany: '',
        sourceJobUrl: '',
        notes: '',
        content: contentToSave,
        createdAt: null,
        updatedAt: null,
        isFallback: true,
      }

      const savedVariant = await saveResumeVariant(
        {
          ...baseVariant,
          content: contentToSave,
        },
        { settings }
      )

      const normalizedContent = normalizeResumeForSettings(savedVariant.content, settings)
      lastSavedVariantSnapshotRef.current = buildVariantSnapshot(savedVariant, normalizedContent)
      setResume(normalizedContent)
      setResumeVariants((prev) => mergeSavedVariantList(prev, savedVariant, baseVariant.id))
      setActiveVariantId(savedVariant.id)

      if (selectedJob && selectedApplication && (!savedVariant.isPrimary || savedVariant.variantType !== 'master')) {
        await syncSelectedApplication(savedVariant.id, options?.applicationPatch)
      }

      if (announce) {
        setSaveMsg(savedVariant.isFallback ? 'Saved to the legacy master resume.' : 'Saved!')
        setTimeout(() => setSaveMsg(null), 3000)
      }

      return savedVariant
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error saving. Please try again.'
      setSaveMsg(message)
      if (!announce) {
        setAutosaveState('error')
      }
      throw error
    } finally {
      if (announce) {
        setSaving(false)
      }
    }
  }, [activeVariant, resume, selectedApplication, selectedJob, settings, syncSelectedApplication])

  useEffect(() => {
    if (!resume || !activeVariant || !hasHydratedResumeRef.current) return

    const nextSnapshot = buildVariantSnapshot(activeVariant, resume)
    if (nextSnapshot === lastSavedVariantSnapshotRef.current) return

    setAutosaveState('saving')
    const timeoutId = window.setTimeout(() => {
      void persistActiveVariant()
        .then((savedVariant) => {
          if (!savedVariant) return
          setAutosaveState('saved')
          window.setTimeout(() => setAutosaveState((current) => (current === 'saved' ? 'idle' : current)), 1500)
        })
        .catch(() => {
          setAutosaveState('error')
        })
    }, 900)

    return () => window.clearTimeout(timeoutId)
  }, [activeVariant, persistActiveVariant, resume])

  const handleSave = async () => {
    await persistActiveVariant({ announce: true })
  }

  const handlePrint = () => {
    if (!resume || !settings) return
    saveResumePrintDraft({ resume, settings, projects, skills })
    const win = window.open(getAdminPath('resume/print'), '_blank', 'noopener,noreferrer')
    if (!win) {
      setSaveMsg('Print popup was blocked. Allow popups and try again.')
      setTimeout(() => setSaveMsg(null), 5000)
    }
  }

  const handleGenerateSummary = async () => {
    if (!resume || !settings || !HAS_RESUME_AI) return
    setSummaryGenerating(true)
    try {
      const expItems = expSection?.items ?? []
      const includedProjectIds = expItems.map(it => it.kind === 'project' ? (it as ProjectExperienceItem).projectId : null).filter(Boolean)
      const includedProjects = projects.filter(p => includedProjectIds.includes(p.id))
      const includedSkills = skillsSection?.includedIds === 'all'
        ? skills
        : skills.filter(s => (skillsSection?.includedIds as string[] | undefined || []).includes(s.id))

      const text = await generateResumeSummary(settings, includedSkills, includedProjects, expItems)
      updateSection('summary', { text })
    } catch (e) {
      // show error in save msg area
      setSaveMsg(e instanceof Error ? e.message : 'Summary generation failed')
      setTimeout(() => setSaveMsg(null), 5000)
    } finally {
      setSummaryGenerating(false)
    }
  }

  const handleTailorToJD = async () => {
    if (!resume || !HAS_RESUME_AI || !jdText.trim() || (!tailorSummaryEnabled && !tailorBulletsEnabled)) return
    setTailoring(true)
    setTailorMsg(null)
    try {
      const expItems = expSection?.items ?? []
      const currentSummary = summSection?.text ?? ''
      const { summary, bullets } = await tailorResumeToJob(jdText, currentSummary, expItems, projects, skills, orphanedSkillsNames)
      const nextResume: ResumeContent = {
        ...resume,
        sections: resume.sections.map((section) => {
          if (section.type === 'summary' && tailorSummaryEnabled) {
            return {
              ...section,
              text: summary,
            }
          }

          if (section.type === 'experience' && tailorBulletsEnabled) {
            return {
              ...section,
              items: section.items.map((item, index) =>
                bullets[index] ? { ...item, bullets: bullets[index] } : item
              ),
            }
          }

          return section
        }),
      }
      setResume(nextResume)
      const savedVariant = await persistActiveVariant({
        resumeOverride: nextResume,
        applicationPatch:
          selectedApplication && (selectedApplication.status === 'saved' || selectedApplication.status === 'tailoring')
            ? { status: 'ready_to_apply' }
            : undefined,
      })
      const tailoredParts = [
        tailorSummaryEnabled ? 'summary' : null,
        tailorBulletsEnabled ? 'bullets' : null,
      ].filter(Boolean).join(' + ')
      const packetMessage = selectedApplication && savedVariant
        ? ' The application packet was updated automatically.'
        : ''
      setTailorMsg(`Tailored ${tailoredParts}. Review your bullets and fill in any blanks.${packetMessage}`)
      setTimeout(() => setTailorMsg(null), 8000)
    } catch (e) {
      setTailorMsg(e instanceof Error ? `Error: ${e.message}` : 'Tailoring failed — try again')
    } finally {
      setTailoring(false)
    }
  }

  const handleAnalyzeMatch = async () => {
    if (!resume || !HAS_RESUME_AI || !jdText.trim()) return
    setAnalyzingAts(true)
    setTailorMsg(null)
    
    // Build a text blob of the current resume to scan against
    const resumeText = [
      resume.header.name,
      resume.header.contactLine,
      ...resume.sections.map(s => {
        if (s.type === 'summary') return s.text
        if (s.type === 'skills') {
          return s.includedIds === 'all' 
            ? skills.map(sk => sk.name).join(', ') 
            : Array.isArray(s.includedIds) ? skills.filter(sk => s.includedIds.includes(sk.id)).map(sk => sk.name).join(', ') : ''
        }
        if (s.type === 'experience') {
          return s.items?.map(i => {
            const title = i.kind === 'project' ? i.titleOverride : i.role
            return `${title}\n${i.bullets.join('\n')}`
          }).join('\n\n')
        }
        return ''
      })
    ].join('\n\n')

    try {
      const match = await analyzeJdMatch(jdText, resumeText)
      setAtsMatchScore(match.score)
      setAtsMatchKeywords({ found: match.foundKeywords, missing: match.missingKeywords })
      setAtsRedFlags(match.redFlags)
    } catch (e) {
      setTailorMsg(e instanceof Error ? `Error: ${e.message}` : 'Analysis failed')
    } finally {
      setAnalyzingAts(false)
    }
  }

  // Word count across all text content
  const wordCount = resume
    ? [
        summSection?.text || '',
        ...(expSection?.items.flatMap(i => i.bullets) || []),
      ].map(countWords).reduce((a, b) => a + b, 0)
    : 0

  const targetWords = resume?.targetWords || 550
  const wordPct = Math.min(100, Math.round((wordCount / targetWords) * 100))
  const lengthLabel =
    wordCount < targetWords * 0.6 ? 'Too sparse' :
    wordCount > targetWords * 1.2 ? 'May exceed 1 page' :
    '~1 page'

  // Projects not yet on resume
  const usedProjectIds = new Set(
    expSection?.items.filter(i => i.kind === 'project').map(i => (i as ProjectExperienceItem).projectId) || []
  )
  const availableProjects = projects.filter(p => !usedProjectIds.has(p.id))
  const getSectionIndex = (type: ResumeSectionType) =>
    resume?.sections.findIndex((section) => section.type === type) ?? -1

  if (!resume || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="sticky top-0 z-20 rounded-xl border border-white/10 bg-background/85 px-4 py-3 backdrop-blur">
        <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold gradient-text">Resume Builder</h1>
            {activeVariant && (
              <Badge variant="secondary" className="border border-white/10 bg-white/5">
                {activeVariant.name}
              </Badge>
            )}
            <Badge variant="secondary" className="border border-white/10 bg-white/5">
              {wordCount}/{targetWords} words
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ATS-friendly resume editor · data synced from your portfolio
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!saveMsg && autosaveState !== 'idle' && (
            <span
              className={cn(
                'text-sm',
                autosaveState === 'error' ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {autosaveState === 'saving'
                ? 'Autosaving…'
                : autosaveState === 'saved'
                  ? 'Autosaved'
                  : 'Autosave failed'}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowPreview(p => !p)}
            className="gap-2 glass border-white/10">
            <Eye className="h-4 w-4" />
            {showPreview ? 'Hide preview' : 'Show preview'}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 glass border-white/10">
            <Printer className="h-4 w-4" />
            Print / PDF
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {saveMsg && (
            <span className={cn('text-sm', saveMsg.startsWith('Error') ? 'text-destructive' : 'text-green-400')}>
              {saveMsg}
            </span>
          )}
        </div>
      </div>
      </div>

      <Card className="glass">
        <CardContent className="pt-4">
          <Tabs value={utilityTab} onValueChange={(value) => setUtilityTab(value as 'resume' | 'layout' | 'tailor')} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList className="h-auto bg-black/30 p-1">
                <TabsTrigger value="resume">Resume</TabsTrigger>
                <TabsTrigger value="layout">Layout</TabsTrigger>
                <TabsTrigger value="tailor">Tailor</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span>{wordCount} / {targetWords} words</span>
                <div className="flex-1 min-w-[120px] max-w-[140px] h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      wordPct > 120 ? 'bg-red-500' : wordPct > 80 ? 'bg-green-500' : 'bg-yellow-500'
                    )}
                    style={{ width: `${wordPct}%` }}
                  />
                </div>
                <span className={cn(
                  wordPct > 120 ? 'text-red-400' : wordPct > 80 ? 'text-green-400' : 'text-yellow-400'
                )}>{lengthLabel}</span>
                <span className="flex items-center gap-1">
                  Target
                  <Input
                    type="number"
                    value={resume.targetWords}
                    onChange={e => setResume(r => r ? { ...r, targetWords: Number(e.target.value) } : r)}
                    className="w-16 h-8 text-xs px-2 bg-black/40 border-white/10"
                    min={200} max={2000} step={50}
                  />
                </span>
              </div>
            </div>

            {selectedJob && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-950/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-blue-200/70">Selected Job Context</p>
                    <h3 className="mt-1 text-sm font-semibold text-white">
                      {selectedJob.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[selectedJob.company, selectedJob.location].filter(Boolean).join(' • ') || 'Saved job'}
                    </p>
                    {selectedApplication && (
                      <p className="mt-2 text-[11px] text-emerald-300/80">
                        Linked application: {selectedApplication.status.replace(/_/g, ' ')}
                        {selectedApplication.resume_variant_id ? ' • resume packet attached' : ''}
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-blue-100/70">
                      The job description is loaded into the Tailor tab. Use a tailored copy if you do not want to touch the primary master.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedJob.job_url && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="glass border-white/10"
                        onClick={() => window.open(selectedJob.job_url, '_blank', 'noopener,noreferrer')}
                      >
                        Open posting
                      </Button>
                    )}
                    {activeVariant?.isPrimary && variantsSupported ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateVariantFromSelectedJob}
                        disabled={saving || !resume || !settings}
                        className="gap-2"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create tailored copy
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={applySelectedJobToCurrentVariant}
                        className="glass border-white/10"
                      >
                        Use on current variant
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearSelectedJobContext}
                      className="text-muted-foreground hover:text-white"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <TabsContent value="resume" className="mt-0">
              {!variantsSupported && (
                <div className="rounded-lg border border-yellow-800/40 bg-yellow-950/20 px-3 py-2 text-[11px] text-yellow-300/80 mb-3">
                  Saved variants are disabled until <code className="text-yellow-200">003_resume_foundation.sql</code> is applied.
                </div>
              )}
              {/* Compact variant selector row */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={activeVariant?.id ?? ''}
                  onChange={(e) => handleSelectVariant(e.target.value)}
                  className="h-8 rounded-md border border-white/10 bg-black/40 px-2 text-sm min-w-[200px]"
                >
                  {resumeVariants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}{variant.isPrimary ? ' · Primary' : ''}
                    </option>
                  ))}
                </select>

                {activeVariant?.isPrimary ? (
                  <Badge variant="secondary" className="bg-green-500/10 text-green-300 border border-green-500/20 text-[10px]">
                    Primary master
                  </Badge>
                ) : activeVariant ? (
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px]">
                    {activeVariant.variantType}
                  </Badge>
                ) : null}

                <div className="ml-auto flex items-center gap-1.5">
                  <Button type="button" variant="outline" size="sm" onClick={handleDuplicateVariant}
                    disabled={saving || !resume || !settings || !variantsSupported}
                    className="glass border-white/10 gap-1.5 h-7 text-xs px-2">
                    <Plus className="h-3 w-3" /> Duplicate
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleSetAsPrimaryVariant}
                    disabled={saving || !resume || !settings || !variantsSupported || activeVariant?.isPrimary}
                    className="glass border-white/10 h-7 text-xs px-2">
                    Set as master
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={handleDeleteVariant}
                    disabled={saving || !variantsSupported || !activeVariant || activeVariant.isPrimary}
                    className="text-destructive hover:text-destructive h-7 w-7 p-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Collapsed variant metadata */}
              <details className="mt-2 rounded-lg border border-white/10 bg-black/20">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
                  Edit variant details (name, target role, company, URL)
                </summary>
                <div className="grid gap-2 border-t border-white/10 px-3 py-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Variant name</Label>
                    <Input value={activeVariant?.name ?? ''} onChange={(e) => updateActiveVariant({ name: e.target.value })}
                      placeholder="Master Resume" className="bg-black/40 border-white/10 h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Target role</Label>
                    <Input value={activeVariant?.sourceJobTitle ?? ''} onChange={(e) => updateActiveVariant({ sourceJobTitle: e.target.value })}
                      placeholder="ML Engineer" className="bg-black/40 border-white/10 h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Target company</Label>
                    <Input value={activeVariant?.sourceJobCompany ?? ''} onChange={(e) => updateActiveVariant({ sourceJobCompany: e.target.value })}
                      placeholder="Company" className="bg-black/40 border-white/10 h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Job URL</Label>
                    <Input value={activeVariant?.sourceJobUrl ?? ''} onChange={(e) => updateActiveVariant({ sourceJobUrl: e.target.value })}
                      placeholder="https://..." className="bg-black/40 border-white/10 h-8 text-xs" />
                  </div>
                </div>
              </details>
            </TabsContent>

            <TabsContent value="layout" className="mt-0 space-y-3">
              <div className="flex flex-wrap gap-2">
                {LAYOUT_PRESET_OPTIONS.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="glass border-white/10"
                    onClick={() => applyLayoutPreset(preset.id)}
                    title={preset.description}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {resume.sections.map((section, index) => (
                  <Badge key={section.type} variant="secondary" className="gap-1.5">
                    <span>{index + 1}.</span>
                    <span>{SECTION_LABELS[section.type]}</span>
                  </Badge>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground/60">
                Use the section cards below or the jump bar to fine-tune the order after picking a preset.
              </p>
            </TabsContent>

            <TabsContent value="tailor" className="mt-0 space-y-3">
              {selectedJob && (
                <div className="rounded-lg border border-blue-500/20 bg-blue-950/10 px-3 py-2 text-xs text-blue-100/80">
                  Tailoring against <span className="font-semibold text-white">{selectedJob.title}</span>
                  {selectedJob.company ? <> at <span className="font-semibold text-white">{selectedJob.company}</span></> : null}.
                  {' '}The description below came from your saved Jobs entry.
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={tailorSummaryEnabled} onCheckedChange={setTailorSummaryEnabled} />
                  Tailor summary
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={tailorBulletsEnabled} onCheckedChange={setTailorBulletsEnabled} />
                  Tailor bullets
                </label>
                {activeVariant?.isPrimary && variantsSupported && (
                  <span className="text-[11px] text-blue-300/70">
                    Duplicate the master first if you want a job-specific copy.
                  </span>
                )}
              </div>
              <Textarea
                value={jdText}
                onChange={e => setJdText(e.target.value)}
                placeholder="Paste the full job description here..."
                className="bg-black/40 border-white/10 min-h-[120px] text-sm resize-none"
              />
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      disabled={!GEMINI_KEY || tailoring || analyzingAts || !jdText.trim()}
                      onClick={handleAnalyzeMatch}
                      variant="outline"
                      className="gap-2 border-purple-500/30 text-purple-200 hover:bg-purple-950/40"
                      size="sm"
                    >
                      {analyzingAts
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning...</>
                        : <><Sparkles className="h-3.5 w-3.5 text-purple-400" /> ATS Scan</>
                      }
                    </Button>
                    <Button
                      type="button"
                      disabled={!GEMINI_KEY || tailoring || analyzingAts || !jdText.trim() || !resume || (!tailorSummaryEnabled && !tailorBulletsEnabled)}
                      onClick={handleTailorToJD}
                      className={cn(
                        'gap-2',
                        GEMINI_KEY ? 'bg-purple-600 hover:bg-purple-500 text-white' : ''
                      )}
                      size="sm"
                    >
                      {tailoring
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Tailoring resume...</>
                        : <><Sparkles className="h-3.5 w-3.5" /> Tailor with AI</>
                      }
                    </Button>
                  </div>
                  {tailorMsg && (
                    <p className={cn(
                      'text-[11px] max-w-sm',
                      tailorMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'
                    )}>{tailorMsg}</p>
                  )}
                  {!tailorSummaryEnabled && !tailorBulletsEnabled && (
                    <p className="text-[11px] text-yellow-400">
                      Select at least one target before tailoring.
                    </p>
                  )}
                </div>

                {atsMatchScore !== null && atsMatchKeywords && (
                  <div className="flex-1 min-w-[300px] border border-white/10 rounded-lg bg-black/40 p-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "text-xl font-bold flex items-center justify-center h-12 w-12 rounded-full border-4",
                        atsMatchScore >= 85 ? "border-green-500 text-green-400" :
                        atsMatchScore >= 70 ? "border-yellow-500 text-yellow-400" :
                        "border-red-500 text-red-400"
                      )}>
                        {atsMatchScore}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">ATS Match Score</h4>
                        <p className="text-[11px] text-muted-foreground">
                          {atsMatchScore >= 85 ? 'Excellent alignment! Ready to export.' :
                           atsMatchScore >= 70 ? 'Good, but could use more specific keywords.' :
                           'Needs significant tailoring before applying.'}
                        </p>
                      </div>
                    </div>

                    {atsMatchKeywords.missing.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-red-300">Missing Keywords to Add:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {atsMatchKeywords.missing.map(kw => (
                            <Badge key={kw} variant="outline" className="text-[10px] bg-red-950/30 text-red-200 border-red-900/50">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {atsRedFlags.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-yellow-300">Red Flags:</p>
                        <ul className="list-disc list-inside text-[11px] text-yellow-200/80 space-y-0.5">
                          {atsRedFlags.map((flag, i) => (
                            <li key={i}>{flag}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="hidden">
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Resume Variants
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Keep a primary master resume, then clone tailored copies for specific roles or companies.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!variantsSupported && (
            <div className="rounded-lg border border-yellow-800/40 bg-yellow-950/20 px-3 py-2 text-[11px] text-yellow-300/80">
              Saved variants are disabled until <code className="text-yellow-200">003_resume_foundation.sql</code> is applied.
              You can still edit and save the legacy master resume safely.
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Current variant</Label>
              <select
                value={activeVariant?.id ?? ''}
                onChange={(e) => handleSelectVariant(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
              >
                {resumeVariants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}{variant.isPrimary ? ' · Primary' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground/60">
                Save before switching if you want to keep the current draft changes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeVariant?.isPrimary ? (
                <Badge variant="secondary" className="bg-green-500/10 text-green-300 border border-green-500/20">
                  Primary master
                </Badge>
              ) : activeVariant ? (
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  {activeVariant.variantType}
                </Badge>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDuplicateVariant}
                disabled={saving || !resume || !settings || !variantsSupported}
                className="glass border-white/10 gap-2"
              >
                <Plus className="h-3.5 w-3.5" />
                Duplicate
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSetAsPrimaryVariant}
                disabled={saving || !resume || !settings || !variantsSupported || activeVariant?.isPrimary}
                className="glass border-white/10"
              >
                Set as master
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDeleteVariant}
                disabled={saving || !variantsSupported || !activeVariant || activeVariant.isPrimary}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {activeVariant && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Variant name</Label>
                <Input
                  value={activeVariant.name}
                  onChange={(e) => updateActiveVariant({ name: e.target.value })}
                  placeholder="Master Resume"
                  className="bg-black/40 border-white/10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Variant type</Label>
                <select
                  value={activeVariant.variantType}
                  onChange={(e) =>
                    updateActiveVariant({
                      variantType: e.target.value as ResumeVariant['variantType'],
                    })
                  }
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                >
                  <option value="master">Master</option>
                  <option value="tailored">Tailored</option>
                  <option value="snapshot">Snapshot</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Target role</Label>
                <Input
                  value={activeVariant.sourceJobTitle}
                  onChange={(e) => updateActiveVariant({ sourceJobTitle: e.target.value })}
                  placeholder="Machine Learning Engineer"
                  className="bg-black/40 border-white/10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Target company</Label>
                <Input
                  value={activeVariant.sourceJobCompany}
                  onChange={(e) => updateActiveVariant({ sourceJobCompany: e.target.value })}
                  placeholder="Company name"
                  className="bg-black/40 border-white/10"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs text-muted-foreground">Job URL</Label>
                <Input
                  value={activeVariant.sourceJobUrl}
                  onChange={(e) => updateActiveVariant({ sourceJobUrl: e.target.value })}
                  placeholder="https://company.com/jobs/..."
                  className="bg-black/40 border-white/10"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea
                  value={activeVariant.notes}
                  onChange={(e) => updateActiveVariant({ notes: e.target.value })}
                  placeholder="Keep track of keywords, recruiter notes, or why this variant exists."
                  className="bg-black/40 border-white/10 min-h-[72px] text-sm resize-none"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Length indicator */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span>{wordCount} / {targetWords} words</span>
        <div className="flex-1 max-w-[120px] h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all',
              wordPct > 120 ? 'bg-red-500' : wordPct > 80 ? 'bg-green-500' : 'bg-yellow-500'
            )}
            style={{ width: `${wordPct}%` }}
          />
        </div>
        <span className={cn(
          wordPct > 120 ? 'text-red-400' : wordPct > 80 ? 'text-green-400' : 'text-yellow-400'
        )}>{lengthLabel}</span>
        <span className="ml-auto text-muted-foreground/60">
          Target:{' '}
          <Input
            type="number"
            value={resume.targetWords}
            onChange={e => setResume(r => r ? { ...r, targetWords: Number(e.target.value) } : r)}
            className="inline-block w-16 h-5 text-xs px-1 py-0 bg-black/40 border-white/10"
            min={200} max={2000} step={50}
          />
          {' '}words
        </span>
      </div>

      {/* ── Best Practices panel ─────────────────────────────────────────── */}
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GripVertical className="h-4 w-4" />
            Layout & Section Order
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose a preset or move sections manually. Preview, print, and saved output all use this order.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {LAYOUT_PRESET_OPTIONS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="outline"
                size="sm"
                className="glass border-white/10"
                onClick={() => applyLayoutPreset(preset.id)}
                title={preset.description}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Current order</Label>
            <div className="flex flex-wrap gap-2">
              {resume.sections.map((section, index) => (
                <Badge key={section.type} variant="secondary" className="gap-1.5">
                  <span>{index + 1}.</span>
                  <span>{SECTION_LABELS[section.type]}</span>
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <BestPracticesPanel />

      {/* ── Tailor to Job Description ─────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowJDPanel(o => !o)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-left hover:bg-white/5 transition-colors"
        >
          <Sparkles className={cn('h-4 w-4', GEMINI_KEY ? 'text-purple-400' : 'text-muted-foreground')} />
          <span className={GEMINI_KEY ? 'text-white' : 'text-muted-foreground'}>
            Tailor resume to a job description
            {!GEMINI_KEY && <span className="ml-2 text-[10px] opacity-50">(requires Supabase resume AI)</span>}
          </span>
          <span className="ml-auto text-xs opacity-50">{showJDPanel ? 'hide' : 'show'}</span>
        </button>
        {showJDPanel && (
          <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-3">
            <p className="text-[11px] text-muted-foreground/70">
              Paste the job description below. Secure server-side AI will rewrite your summary and project bullets to emphasize the exact skills and keywords the employer wants without fabricating experience.
              <span className="text-yellow-400/70"> Review everything and fill in any [X] placeholders after.</span>
              {activeVariant?.isPrimary && variantsSupported && (
                <span className="text-blue-300/70"> Duplicate the master first if you want to keep a separate job-specific copy.</span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={tailorSummaryEnabled} onCheckedChange={setTailorSummaryEnabled} />
                Tailor summary
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={tailorBulletsEnabled} onCheckedChange={setTailorBulletsEnabled} />
                Tailor bullets
              </label>
            </div>
            <Textarea
              value={jdText}
              onChange={e => setJdText(e.target.value)}
              placeholder="Paste the full job description here…"
              className="bg-black/40 border-white/10 min-h-[120px] text-sm resize-none"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                type="button"
                disabled={!GEMINI_KEY || tailoring || !jdText.trim() || !resume || (!tailorSummaryEnabled && !tailorBulletsEnabled)}
                onClick={handleTailorToJD}
                className={cn(
                  'gap-2',
                  GEMINI_KEY ? 'bg-purple-600 hover:bg-purple-500 text-white' : ''
                )}
                size="sm"
              >
                {tailoring
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Tailoring resume…</>
                  : <><Sparkles className="h-3.5 w-3.5" /> Tailor resume with AI</>
                }
              </Button>
              {tailorMsg && (
                <p className={cn(
                  'text-[11px] flex-1',
                  tailorMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'
                )}>{tailorMsg}</p>
              )}
              {!tailorSummaryEnabled && !tailorBulletsEnabled && (
                <p className="text-[11px] text-yellow-400">
                  Select at least one target before tailoring.
                </p>
              )}
            </div>
            {!GEMINI_KEY && (
              <p className="text-[11px] text-muted-foreground/50">
                AI actions stay disabled until Supabase is configured and the <code>resume-ai</code> Edge Function is deployed with a <code>GEMINI_API_KEY</code> secret.
              </p>
            )}
          </div>
        )}
      </div>

      </div>

      {/* Two-panel layout */}
      <div className={cn('gap-6', showPreview ? 'grid grid-cols-1 xl:grid-cols-2' : 'flex flex-col max-w-2xl')}>
        {/* ── Left: Editor ── */}
        <div className="flex flex-col gap-4 min-w-0">

          <div className="sticky top-24 z-10 rounded-xl border border-white/10 bg-background/90 p-2 backdrop-blur">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => jumpToEditorSection('header')}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs transition-colors',
                  activeSection === null
                    ? 'border-white/30 bg-white/10 text-white'
                    : 'border-white/10 text-muted-foreground hover:text-white'
                )}
              >
                Header
              </button>
              {resume.sections.map((section) => (
                <button
                  key={section.type}
                  type="button"
                  onClick={() => jumpToEditorSection(section.type)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs transition-colors',
                    activeSection === section.type
                      ? 'border-white/30 bg-white/10 text-white'
                      : 'border-white/10 text-muted-foreground hover:text-white'
                  )}
                >
                  {SECTION_LABELS[section.type]}
                </button>
              ))}
            </div>
          </div>

          {/* Header section */}
          <div ref={(node) => { sectionRefs.current.header = node }}>
          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Header
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Full name</Label>
                <Input
                  value={resume.header.name}
                  onChange={e => setResume(r => r ? { ...r, header: { ...r.header, name: e.target.value } } : r)}
                  placeholder="Your Name"
                  className="bg-black/40 border-white/10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Contact line</Label>
                <Input
                  value={resume.header.contactLine}
                  onChange={e => setResume(r => r ? { ...r, header: { ...r.header, contactLine: e.target.value } } : r)}
                  placeholder="email · city · linkedin.com/in/x · github.com/x"
                  className="bg-black/40 border-white/10"
                />
                <p className="text-[11px] text-muted-foreground/60">
                  Auto-filled from Settings. Edit freely.
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm"
                className="text-xs text-muted-foreground hover:text-white"
                onClick={() => setResume(r => r ? {
                  ...r, header: { ...r.header, contactLine: buildContactLineFromSettings(settings) }
                } : r)}>
                Reset from Settings
              </Button>
            </CardContent>
          </Card>
          </div>

          {/* Summary section */}
          <div ref={(node) => { sectionRefs.current.summary = node }} style={{ order: getSectionIndex('summary') }}>
          <SectionCard
            label="Summary"
            enabled={summSection?.enabled ?? true}
            onToggle={v => updateSection('summary', { enabled: v })}
            active={activeSection === 'summary'}
            onToggleActive={() => setActiveSection(s => s === 'summary' ? null : 'summary')}
            canMoveUp={getSectionIndex('summary') > 0}
            canMoveDown={getSectionIndex('summary') < resume.sections.length - 1}
            onMoveUp={() => moveSection('summary', 'up')}
            onMoveDown={() => moveSection('summary', 'down')}
          >
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Section heading on resume</Label>
                <Input
                  value={summSection?.sectionTitle ?? 'SUMMARY'}
                  onChange={e => updateSection('summary', { sectionTitle: e.target.value })}
                  placeholder="SUMMARY"
                  className="bg-black/40 border-white/10 text-sm"
                />
              </div>
              {/* Best practice reminder */}
              <div className="rounded-md bg-blue-950/30 border border-blue-800/30 px-3 py-2 text-[11px] text-blue-300/80 space-y-0.5">
                <div><span className="font-semibold text-blue-300">Best practice:</span> 3–4 sentences · 70–100 words · lead with degree/title · include 1 metric · end with value you bring</div>
                <div className="text-blue-300/60">
                  <span className="font-medium text-blue-300/80">Template:</span> [Degree/Title] with [context]. Skilled in [tools]. Achieved [metric] on [project]. Passionate about [value].
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">Your summary</Label>
                <div className="flex gap-1">
                  {GEMINI_KEY ? (
                    <Button type="button" variant="ghost" size="sm" disabled={summaryGenerating}
                      className="gap-1 text-[11px] h-6 px-2 text-purple-400 hover:text-purple-300"
                      onClick={handleGenerateSummary}
                      title="Generate a personalized summary using the secure resume AI function">
                      {summaryGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      {summaryGenerating ? 'Writing…' : 'AI write summary'}
                    </Button>
                  ) : (
                    <Button type="button" variant="ghost" size="sm"
                      className="gap-1 text-[11px] h-6 px-2 text-muted-foreground hover:text-white"
                      onClick={() => updateSection('summary', { text: buildSummaryTemplate(settings, skills) })}
                      title="Fill in a structured template you can edit">
                      <Sparkles className="h-3 w-3" /> Template
                    </Button>
                  )}
                </div>
              </div>
              <Textarea
                value={summSection?.text || ''}
                onChange={e => updateSection('summary', { text: e.target.value })}
                placeholder="Data Science undergraduate at University of Houston–Downtown with research and project experience in ML, NLP, and deep learning. Skilled in Python, R, and SQL…"
                className="bg-black/40 border-white/10 min-h-[90px] text-sm resize-none"
              />
              <div className="flex items-center gap-2">
                <p className={cn(
                  'text-[11px]',
                  countWords(summSection?.text || '') < 40 ? 'text-yellow-400' :
                  countWords(summSection?.text || '') > 120 ? 'text-red-400' : 'text-green-400'
                )}>
                  {countWords(summSection?.text || '')} words
                  {countWords(summSection?.text || '') < 40 && ' — aim for 70–100'}
                  {countWords(summSection?.text || '') > 120 && ' — trim to 70–100'}
                  {countWords(summSection?.text || '') >= 40 && countWords(summSection?.text || '') <= 120 && ' ✓'}
                </p>
              </div>
            </div>
          </SectionCard>
          </div>

          {/* Education section */}
          <div ref={(node) => { sectionRefs.current.education = node }} style={{ order: getSectionIndex('education') }}>
          <SectionCard
            label="Education"
            enabled={eduSection?.enabled ?? true}
            onToggle={v => updateSection('education', { enabled: v })}
            active={activeSection === 'education'}
            onToggleActive={() => setActiveSection(s => s === 'education' ? null : 'education')}
            canMoveUp={getSectionIndex('education') > 0}
            canMoveDown={getSectionIndex('education') < resume.sections.length - 1}
            onMoveUp={() => moveSection('education', 'up')}
            onMoveDown={() => moveSection('education', 'down')}
          >
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Section heading on resume</Label>
                <Input
                  value={eduSection?.sectionTitle ?? 'EDUCATION'}
                  onChange={e => updateSection('education', { sectionTitle: e.target.value })}
                  placeholder="EDUCATION"
                  className="bg-black/40 border-white/10 text-sm"
                />
              </div>
              {settings.education.length === 0 && (
                <p className="text-xs text-muted-foreground/60">
                  No education entries yet. Add them in Settings → Profile → Education.
                </p>
              )}
              {settings.education.map((entry, i) => {
                const included = eduSection?.includedIndices.includes(i) ?? true
                return (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-black/30 px-3 py-2.5">
                    <Switch
                      checked={included}
                      onCheckedChange={v => {
                        const cur = eduSection?.includedIndices || []
                        updateSection('education', {
                          includedIndices: v ? [...cur, i] : cur.filter(x => x !== i)
                        })
                      }}
                      className="mt-0.5"
                    />
                    <div className="text-sm">
                      <div className="font-medium">{entry.title}</div>
                      <div className="text-muted-foreground text-xs">{entry.issuer} · {entry.date}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
          </div>

          {/* Experience / Projects section */}
          <div ref={(node) => { sectionRefs.current.experience = node }} style={{ order: getSectionIndex('experience') }}>
          <SectionCard
            label="Projects / Experience"
            enabled={expSection?.enabled ?? true}
            onToggle={v => updateSection('experience', { enabled: v })}
            active={activeSection === 'experience'}
            onToggleActive={() => setActiveSection(s => s === 'experience' ? null : 'experience')}
            canMoveUp={getSectionIndex('experience') > 0}
            canMoveDown={getSectionIndex('experience') < resume.sections.length - 1}
            onMoveUp={() => moveSection('experience', 'up')}
            onMoveDown={() => moveSection('experience', 'down')}
          >
            <div className="space-y-3">
              {/* Section heading override */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Section heading on resume</Label>
                <Input
                  value={expSection?.sectionTitle ?? 'PROJECTS'}
                  onChange={e => updateSection('experience', { sectionTitle: e.target.value })}
                  placeholder="PROJECTS"
                  className="bg-black/40 border-white/10 text-sm"
                />
              </div>
              {/* Existing items */}
              {expSection?.items.map((item, i) => (
                <ExperienceItemEditor
                  key={item.kind === 'project' ? item.projectId : item.id}
                  item={item}
                  projects={projects}
                  index={i}
                  onUpdate={updated => updateExpItem(i, updated)}
                  onRemove={() => removeExpItem(i)}
                  geminiKey={GEMINI_KEY}
                  orphanedSkillsNames={orphanedSkillsNames}
                />
              ))}

              {/* Add from project */}
              {availableProjects.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Add from portfolio project</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableProjects.map(p => (
                      <Button
                        key={p.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addProjectExperience(p)}
                        className="glass border-white/10 text-xs gap-1 h-7"
                      >
                        <Plus className="h-3 w-3" /> {p.title}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCustomExperience}
                className="glass border-white/10 gap-2 w-full text-xs"
              >
                <Plus className="h-3 w-3" /> Add custom experience
              </Button>
            </div>
          </SectionCard>
          </div>

          {/* Skills section */}
          <div ref={(node) => { sectionRefs.current.skills = node }} style={{ order: getSectionIndex('skills') }}>
          <SectionCard
            label="Skills"
            enabled={skillsSection?.enabled ?? true}
            onToggle={v => updateSection('skills', { enabled: v })}
            active={activeSection === 'skills'}
            onToggleActive={() => setActiveSection(s => s === 'skills' ? null : 'skills')}
            canMoveUp={getSectionIndex('skills') > 0}
            canMoveDown={getSectionIndex('skills') < resume.sections.length - 1}
            onMoveUp={() => moveSection('skills', 'up')}
            onMoveDown={() => moveSection('skills', 'down')}
          >
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Section heading on resume</Label>
                <Input
                  value={skillsSection?.sectionTitle ?? 'SKILLS'}
                  onChange={e => updateSection('skills', { sectionTitle: e.target.value })}
                  placeholder="SKILLS"
                  className="bg-black/40 border-white/10 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Display style</Label>
                <select
                  value={skillsSection?.displayStyle ?? (skillsSection?.groupByCategory ? 'categorized' : 'comma')}
                  onChange={(e) => {
                    const displayStyle = e.target.value as 'categorized' | 'comma' | 'pipe' | 'bullet'
                    updateSection('skills', {
                      displayStyle,
                      groupByCategory: displayStyle === 'categorized',
                    })
                  }}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
                >
                  <option value="categorized">Categorized list</option>
                  <option value="comma">Comma-separated</option>
                  <option value="pipe">Pipe-separated</option>
                  <option value="bullet">Bullet-separated</option>
                </select>
              </div>
              
              {/* Orphaned Skills Warning */}
              {orphanedSkillsNames.length > 0 && (
                <div className="rounded-md bg-yellow-950/30 border border-yellow-800/30 px-3 py-2 space-y-1">
                  <Label className="text-xs font-semibold text-yellow-300 flex items-center gap-1.5">
                    Orphaned Skills Detected
                  </Label>
                  <p className="text-[11px] text-yellow-200/80 leading-snug">
                    The following skills are included in your Skills section but never mentioned in your Project/Experience bullets. Consider adding them to a bullet to pass ATS verification (or use AI Improve which will auto-incorporate them):
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {orphanedSkillsNames.map(name => (
                      <span key={name} className="text-[10px] bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 px-1.5 py-0.5 rounded">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Include skills</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => updateSection('skills', { includedIds: 'all' })}
                    className={cn(
                      'text-xs px-2 py-1 rounded border transition-colors',
                      skillsSection?.includedIds === 'all'
                        ? 'bg-white/10 border-white/30 text-white'
                        : 'border-white/10 text-muted-foreground hover:text-white'
                    )}
                  >
                    All skills
                  </button>
                  {skills.map(sk => {
                    const included = skillsSection?.includedIds === 'all' ||
                      (Array.isArray(skillsSection?.includedIds) && skillsSection.includedIds.includes(sk.id))
                    return (
                      <button
                        key={sk.id}
                        type="button"
                        onClick={() => {
                          const cur = skillsSection?.includedIds === 'all'
                            ? skills.map(s => s.id)
                            : (skillsSection?.includedIds || []) as string[]
                          const next = included ? cur.filter(id => id !== sk.id) : [...cur, sk.id]
                          updateSection('skills', { includedIds: next })
                        }}
                        className={cn(
                          'text-xs px-2 py-1 rounded border transition-colors',
                          included
                            ? 'bg-white/10 border-white/30 text-white'
                            : 'border-white/10 text-muted-foreground hover:text-white'
                        )}
                      >
                        {sk.name}
                      </button>
                    )
                  })}
                </div>
                
                <div className="flex gap-2 mt-2 max-w-sm">
                  <Input 
                    placeholder="Add a new skill (e.g. R, PostgreSQL)" 
                    className="h-8 text-xs bg-black/40"
                    value={newSkillName}
                    onChange={e => setNewSkillName(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (!newSkillName.trim() || addingSkill) return
                        setAddingSkill(true)
                        try {
                          const s = await createSkill(newSkillName.trim(), 'Other', '#475569')
                          if (s) {
                            setSkills(prev => [...prev, s])
                            if (skillsSection?.includedIds !== 'all') {
                              updateSection('skills', { includedIds: [...(skillsSection?.includedIds as string[] || []), s.id] })
                            }
                            setNewSkillName('')
                          }
                        } finally {
                          setAddingSkill(false)
                        }
                      }
                    }}
                  />
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 text-xs"
                    disabled={!newSkillName.trim() || addingSkill}
                    onClick={async () => {
                      if (!newSkillName.trim() || addingSkill) return
                      setAddingSkill(true)
                      try {
                        const s = await createSkill(newSkillName.trim(), 'Other', '#475569')
                        if (s) {
                          setSkills(prev => [...prev, s])
                          if (skillsSection?.includedIds !== 'all') {
                            updateSection('skills', { includedIds: [...(skillsSection?.includedIds as string[] || []), s.id] })
                          }
                          setNewSkillName('')
                        }
                      } finally {
                        setAddingSkill(false)
                      }
                    }}
                  >
                    {addingSkill ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </SectionCard>
          </div>

        </div>

        {/* ── Right: Interactive Preview ── */}
        {showPreview && (
          <div className="sticky top-4 self-start space-y-2">
            {/* Resume AI notice */}
            {!GEMINI_KEY && (
              <div className="rounded-lg border border-purple-800/40 bg-purple-950/20 px-3 py-2 text-[11px] text-purple-300/80 flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-purple-400" />
                <span>
                  AI features are off until the <code className="text-purple-200">resume-ai</code> Supabase Edge Function is deployed and <code className="text-purple-200">GEMINI_API_KEY</code> is stored in Supabase secrets.
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                    className="underline text-purple-300 inline-flex items-center gap-0.5 hover:text-white">
                    Finish Supabase setup
                  </a>
                </span>
              </div>
            )}
            {GEMINI_KEY && (
              <div className="rounded-lg border border-green-800/40 bg-green-950/20 px-3 py-2 text-[11px] text-green-300/80 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />
                Resume AI actions are routed through Supabase instead of a client-side key.
              </div>
            )}

            {/* edit mode hint */}
            <div className="flex items-center gap-2 px-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-blue-400/80 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Click any text in the preview to edit inline · WYSIWYG scale
              </span>
            </div>

            {/* Scaled preview — renders at exact print dimensions */}
            <div className="rounded-xl border border-white/15 overflow-hidden shadow-2xl">
              <ScaledPreviewWrapper>
                <ResumePreview
                  resume={resume}
                  settings={settings}
                  projects={projects}
                  skills={skills}
                  onUpdate={setResume}
                />
              </ScaledPreviewWrapper>
            </div>
            <p className="text-[11px] text-muted-foreground/60 text-center">
              Preview is 1:1 with the printed PDF · edits sync with left panel
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SectionCard ──────────────────────────────────────────────────────────────

interface SectionCardProps {
  label: string
  enabled: boolean
  onToggle: (v: boolean) => void
  active: boolean
  onToggleActive: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  children: React.ReactNode
}

function SectionCard({
  label,
  enabled,
  onToggle,
  active,
  onToggleActive,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  children,
}: SectionCardProps) {
  return (
    <Card className={cn('glass transition-all', enabled ? '' : 'opacity-60')}>
      <CardHeader className="pb-0">
        <div className="flex items-center gap-3">
          <Switch checked={enabled} onCheckedChange={onToggle} />
          <button
            type="button"
            onClick={onToggleActive}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <CardTitle className="text-base">{label}</CardTitle>
            {active ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />}
          </button>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!canMoveUp}
              onClick={onMoveUp}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!canMoveDown}
              onClick={onMoveDown}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {(active || label === 'Summary') && enabled && (
        <CardContent className="pt-4">
          {children}
        </CardContent>
      )}
      {!active && label !== 'Summary' && enabled && (
        <CardContent className="pt-2 pb-3">
          <button
            type="button"
            onClick={onToggleActive}
            className="text-xs text-muted-foreground hover:text-white"
          >
            Click to expand…
          </button>
        </CardContent>
      )}
    </Card>
  )
}

// ─── Print HTML generator ─────────────────────────────────────────────────────

function generatePrintHTML(
  resume: ResumeContent,
  settings: PortfolioSettings,
  projects: Project[],
  skills: Skill[]
): string {
  const eduSection = resume.sections.find(s => s.type === 'education') as import('@/types/resume').ResumeEducationSection | undefined
  const expSection = resume.sections.find(s => s.type === 'experience') as import('@/types/resume').ResumeExperienceSection | undefined
  const skillsSection = resume.sections.find(s => s.type === 'skills') as import('@/types/resume').ResumeSkillsSection | undefined
  const summSection = resume.sections.find(s => s.type === 'summary') as import('@/types/resume').ResumeSummarySection | undefined

  const includedSkills = skillsSection?.includedIds === 'all'
    ? skills
    : skills.filter(s => (skillsSection?.includedIds as string[] || []).includes(s.id))

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const skillsHTML = (() => {
    if (!skillsSection?.enabled || includedSkills.length === 0) return ''
    if (skillsSection.groupByCategory) {
      const cats = [...new Set(includedSkills.map(s => s.category))]
      return `<section>
        <h2>SKILLS</h2><hr/>
        ${cats.map(cat => {
          const catSkills = includedSkills.filter(s => s.category === cat)
          return `<p>${esc(catSkills.map(s => s.name).join(', '))}</p>`
        }).join('')}
      </section>`
    }
    return `<section>
      <h2>SKILLS</h2><hr/>
      <p>${esc(includedSkills.map(s => s.name).join(', '))}</p>
    </section>`
  })()

  const expHTML = (() => {
    if (!expSection?.enabled || expSection.items.length === 0) return ''
    const heading = expSection.sectionTitle || 'PROJECT'
    return `<section>
      <h2>${esc(heading)}</h2><hr/>
      ${expSection.items.map(item => {
        const title = item.kind === 'project'
          ? esc(item.titleOverride || projects.find(p => p.id === item.projectId)?.title || 'Project')
          : esc(item.role)
        const subtitle = item.subtitle ? ` &mdash; ${esc(item.subtitle)}` : ''
        const urlLine = item.url ? `<div class="entry-url">${esc(item.url)}</div>` : ''
        const githubPart = item.kind === 'project' && item.githubUrl ? esc(item.githubUrl) : ''
        const orgPart = item.org ? esc(item.org) : ''
        const sub2 = [githubPart, orgPart].filter(Boolean).join(' &bull; ')
        const sub2Line = sub2 ? `<div class="entry-sub2">${sub2}</div>` : ''
        return `<div class="entry">
          <div class="entry-header">
            <span class="entry-title">${title}${subtitle}</span>
            <span class="entry-date">${esc(item.dateRange)}</span>
          </div>
          ${urlLine}${sub2Line}
          <ul>${item.bullets.filter(Boolean).map(b => `<li>${esc(b)}</li>`).join('')}</ul>
        </div>`
      }).join('')}
    </section>`
  })()

  const eduHTML = (() => {
    if (!eduSection?.enabled) return ''
    const entries = eduSection.includedIndices.map(i => settings.education[i]).filter(Boolean)
    if (entries.length === 0) return ''
    return `<section>
      <h2>EDUCATION</h2><hr/>
      ${entries.map(e => `<div class="entry">
        <div class="entry-header">
          <span class="entry-title">${esc(e.title)}</span>
        </div>
        <div class="entry-sub2">${esc(e.issuer)}${e.url ? ` &bull; <span style="color:#111">${esc(e.url)}</span>` : ''} &bull; ${esc(e.date)}</div>
      </div>`).join('')}
    </section>`
  })()

  const summHTML = summSection?.enabled && summSection.text
    ? `<section><h2>SUMMARY</h2><hr/><p>${esc(summSection.text)}</p></section>`
    : ''

  // Sections in the order defined by resume.sections
  const sectionOrder = resume.sections
    .filter(s => s.enabled)
    .map(s => s.type)

  const sectionMap: Record<string, string> = {
    summary: summHTML,
    experience: expHTML,
    education: eduHTML,
    skills: skillsHTML,
  }
  const orderedHTML = sectionOrder.map(t => sectionMap[t] ?? '').join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${esc(resume.header.name)} – Resume</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', Georgia, serif;
    font-size: 10pt;
    color: #000;
    background: #fff;
    max-width: 8.5in;
    margin: 0 auto;
    padding: 0.5in 0.5in;
    line-height: 1.34;
  }
  header { text-align: center; margin-bottom: 10px; }
  header h1 {
    font-size: 14pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  header p { font-size: 9pt; color: #222; margin-top: 3px; }
  section { margin-bottom: 10px; }
  h2 {
    font-size: 10pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 2px;
  }
  hr { border: none; border-top: 1px solid #000; margin-bottom: 4px; }
  .entry { margin-bottom: 8px; }
  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .entry-title { font-weight: bold; font-size: inherit; }
  .entry-date { font-size: inherit; white-space: nowrap; flex-shrink: 0; }
  .entry-url { font-size: 9pt; color: #111; margin-top: 1px; }
  .entry-sub2 { font-size: 9pt; color: #333; margin-top: 1px; }
  ul { padding-left: 1.2em; margin-top: 3px; margin-bottom: 0; }
  li { margin-bottom: 2px; font-size: inherit; }
  p { font-size: inherit; margin-bottom: 3px; }
  @media print {
    body { padding: 0; }
    @page { size: letter; margin: 0.5in; }
  }
</style>
</head>
<body>
  <header>
    <h1>${esc(resume.header.name)}</h1>
    <p>${esc(resume.header.contactLine)}</p>
  </header>
  ${orderedHTML}
</body>
</html>`
}
