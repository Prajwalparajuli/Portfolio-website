import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Plus, Trash2, GripVertical, Eye, Save,
  ChevronDown, ChevronUp, FileText, Printer, Info, Sparkles,
  BookOpen, CheckCircle2, XCircle, AlertCircle
} from 'lucide-react'
import {
  getSettings, getAllProjects, getSkills,
  getResumeContent, updateResumeContent
} from '@/lib/supabase'
import { PortfolioSettings } from '@/types'
import { Project } from '@/types'
import { Skill } from '@/types'
import {
  ResumeContent, ResumeSection, ExperienceItem,
  ProjectExperienceItem, CustomExperienceItem,
  makeDefaultResumeContent
} from '@/types/resume'
import { ResumePreview } from '@/components/admin/ResumePreview'
import { cn } from '@/lib/utils'

// ─── helpers ──────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function buildContactLineFromSettings(s: PortfolioSettings): string {
  const parts: string[] = []
  if (s.location) parts.push(s.location)
  if (s.contact_email) parts.push(s.contact_email)
  if (s.linkedin_url) parts.push(s.linkedin_url.replace(/^https?:\/\//, ''))
  if (s.github_url) parts.push(s.github_url.replace(/^https?:\/\//, ''))
  return parts.join('  ')
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
  let raw = project.description
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
    results.push(`Processed and cleaned [X]+ rows of real-world data using ${techStr || 'Python'}, handling missing values, outliers, and feature engineering.`)
  }

  // Bullet 3 — RESULT / IMPACT bullet
  if (candidates[2]) {
    results.push(candidates[2])
  } else {
    const metric = bigNumbers[1] ?? '[X]%'
    results.push(`Achieved ${metric} accuracy / improvement; deployed as [Streamlit app / REST API / notebook] and presented findings to [audience].`)
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
    `Proven ability to transform complex datasets into actionable insights — achieving [X]% accuracy / [metric] on [project type].`,
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
}

function BulletListEditor({ bullets, onChange }: BulletListEditorProps) {
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([])

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
                    ? 'Built [system/model] using [tech], processing [X]+ records to achieve [outcome].'
                    : i === 1
                    ? 'Engineered [feature] from [data source], reducing [metric] by [X]% through [method].'
                    : 'Evaluated model using [metric]@k / F1 / accuracy — achieved [X]%; deployed as [app/API].'}
                  className="bg-black/40 border-white/10 text-sm flex-1 min-h-[52px] resize-none"
                  rows={2}
                />
                {/* Quality badges */}
                {score && (
                  <div className="flex gap-1.5 flex-wrap pt-0.5">
                    <BulletQualityBadge label="Action verb" ok={score.hasVerb} />
                    <BulletQualityBadge label="Has metric" ok={score.hasMetric} warn={!score.hasMetric} />
                    <BulletQualityBadge
                      label={score.goodLength ? 'Good length' : b.length < 40 ? 'Too short' : 'Too long'}
                      ok={score.goodLength}
                      warn={b.length < 40}
                    />
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
      {bullets.length < 5 && (
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
}

function ExperienceItemEditor({ item, projects, onUpdate, onRemove, index }: ExperienceItemEditorProps) {
  const [expanded, setExpanded] = useState(index === 0)

  const linkedProject = item.kind === 'project'
    ? projects.find(p => p.id === item.projectId) ?? null
    : null

  const displayTitle = item.kind === 'project'
    ? (item.titleOverride || linkedProject?.title || 'Untitled project')
    : (item.role || 'Custom experience')

  const handleSuggestBullets = () => {
    if (!linkedProject) return
    const suggested = extractBulletsFromProject(linkedProject)
    onUpdate({ ...item, bullets: suggested })
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
                <Label className="text-xs text-muted-foreground">Subtitle <span className="opacity-50">(after em-dash, e.g. "Hybrid ML Ranking Pipeline")</span></Label>
                <Input
                  value={item.subtitle ?? ''}
                  onChange={e => onUpdate({ ...item, subtitle: e.target.value })}
                  placeholder="Short descriptor of the project type"
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
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                Bullet points <span className="opacity-60">(2–4 recommended, action verbs + metrics)</span>
              </Label>
              {linkedProject && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSuggestBullets}
                  className="gap-1 text-[11px] h-6 px-2 text-muted-foreground hover:text-white"
                  title="Re-extract clean bullet suggestions from project description"
                >
                  <Sparkles className="h-3 w-3" />
                  Suggest from description
                </Button>
              )}
            </div>
            <BulletListEditor
              bullets={item.bullets}
              onChange={bullets => onUpdate({ ...item, bullets })}
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
  const [settings, setSettings] = useState<PortfolioSettings | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [resume, setResume] = useState<ResumeContent | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(true)
  const [activeSection, setActiveSection] = useState<ResumeSection['type'] | null>(null)

  // Load all data
  useEffect(() => {
    Promise.all([getSettings(), getAllProjects(), getSkills(), getResumeContent()]).then(
      ([s, p, sk, r]) => {
        setSettings(s)
        setProjects(p)
        setSkills(sk)
        if (r) {
          setResume(r)
        } else {
          // Build sensible defaults from existing settings
          const def = makeDefaultResumeContent(
            s.site_title || '',
            buildContactLineFromSettings(s)
          )
          // Pre-include all education indices
          def.sections = def.sections.map(sec =>
            sec.type === 'education'
              ? { ...sec, includedIndices: s.education.map((_, i) => i) }
              : sec
          )
          setResume(def)
        }
      }
    )
  }, [])

  const updateSection = useCallback(<T extends ResumeSection>(type: T['type'], patch: Partial<T>) => {
    setResume(prev => {
      if (!prev) return prev
      return {
        ...prev,
        sections: prev.sections.map(s => s.type === type ? { ...s, ...patch } as ResumeSection : s),
      }
    })
  }, [])

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

  const handleSave = async () => {
    if (!resume) return
    setSaving(true)
    setSaveMsg(null)
    try {
      await updateResumeContent(resume)
      setSaveMsg('Saved!')
      setTimeout(() => setSaveMsg(null), 3000)
    } catch {
      setSaveMsg('Error saving. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = () => {
    if (!resume || !settings) return
    const win = window.open('', '_blank')
    if (!win) return
    const html = generatePrintHTML(resume, settings, projects, skills)
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Resume Builder</h1>
          <p className="text-muted-foreground mt-1">
            ATS-friendly resume editor · data synced from your portfolio
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
      <BestPracticesPanel />

      {/* Two-panel layout */}
      <div className={cn('gap-6', showPreview ? 'grid grid-cols-1 xl:grid-cols-2' : 'flex flex-col max-w-2xl')}>
        {/* ── Left: Editor ── */}
        <div className="space-y-4">

          {/* Header section */}
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

          {/* Summary section */}
          <SectionCard
            label="Summary"
            enabled={summSection?.enabled ?? true}
            onToggle={v => updateSection('summary', { enabled: v })}
            active={activeSection === 'summary'}
            onToggleActive={() => setActiveSection(s => s === 'summary' ? null : 'summary')}
          >
            <div className="space-y-2">
              {/* Best practice reminder */}
              <div className="rounded-md bg-blue-950/30 border border-blue-800/30 px-3 py-2 text-[11px] text-blue-300/80 space-y-0.5">
                <div><span className="font-semibold text-blue-300">Best practice:</span> 3–4 sentences · 70–100 words · lead with degree/title · include 1 metric · end with value you bring</div>
                <div className="text-blue-300/60">
                  <span className="font-medium text-blue-300/80">Template:</span> [Degree/Title] with [context]. Skilled in [tools]. Achieved [metric] on [project]. Passionate about [value].
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Your summary</Label>
                <Button type="button" variant="ghost" size="sm"
                  className="gap-1 text-[11px] h-6 px-2 text-muted-foreground hover:text-white"
                  onClick={() => updateSection('summary', { text: buildSummaryTemplate(settings, skills) })}
                  title="Fill in a structured template you can edit">
                  <Sparkles className="h-3 w-3" /> Generate template
                </Button>
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

          {/* Education section */}
          <SectionCard
            label="Education"
            enabled={eduSection?.enabled ?? true}
            onToggle={v => updateSection('education', { enabled: v })}
            active={activeSection === 'education'}
            onToggleActive={() => setActiveSection(s => s === 'education' ? null : 'education')}
          >
            <div className="space-y-2">
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

          {/* Experience / Projects section */}
          <SectionCard
            label="Projects / Experience"
            enabled={expSection?.enabled ?? true}
            onToggle={v => updateSection('experience', { enabled: v })}
            active={activeSection === 'experience'}
            onToggleActive={() => setActiveSection(s => s === 'experience' ? null : 'experience')}
          >
            <div className="space-y-3">
              {/* Section heading override */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Section heading on resume</Label>
                <Input
                  value={expSection?.sectionTitle ?? 'PROJECT'}
                  onChange={e => updateSection('experience', { sectionTitle: e.target.value })}
                  placeholder="PROJECT"
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

          {/* Skills section */}
          <SectionCard
            label="Skills"
            enabled={skillsSection?.enabled ?? true}
            onToggle={v => updateSection('skills', { enabled: v })}
            active={activeSection === 'skills'}
            onToggleActive={() => setActiveSection(s => s === 'skills' ? null : 'skills')}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={skillsSection?.groupByCategory ?? true}
                  onCheckedChange={v => updateSection('skills', { groupByCategory: v })}
                />
                <Label className="text-sm">Group by category</Label>
              </div>
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
              </div>
            </div>
          </SectionCard>

        </div>

        {/* ── Right: Interactive Preview ── */}
        {showPreview && (
          <div className="sticky top-4 self-start space-y-2">
            {/* edit mode hint */}
            <div className="flex items-center gap-2 px-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-blue-400/80 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Click any text in the preview to edit it inline
              </span>
            </div>
            <div className="rounded-xl border border-white/10 overflow-hidden bg-white shadow-2xl">
              <ResumePreview
                resume={resume}
                settings={settings}
                projects={projects}
                skills={skills}
                onUpdate={setResume}
              />
            </div>
            <p className="text-[11px] text-muted-foreground/60 text-center">
              Edits sync with the left panel · use Print / PDF to export
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
  children: React.ReactNode
}

function SectionCard({ label, enabled, onToggle, active, onToggleActive, children }: SectionCardProps) {
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
        <div class="entry-sub2">${esc(e.issuer)}${e.url ? ` &bull; <span style="color:#1a56db">${esc(e.url)}</span>` : ''} &bull; ${esc(e.date)}</div>
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
    font-size: 10.5pt;
    color: #000;
    background: #fff;
    max-width: 8.5in;
    margin: 0 auto;
    padding: 0.5in 0.55in;
    line-height: 1.42;
  }
  header { text-align: center; margin-bottom: 12px; }
  header h1 {
    font-size: 17pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  header p { font-size: 9.5pt; color: #222; margin-top: 3px; }
  section { margin-bottom: 10px; }
  h2 {
    font-size: 10pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 2px;
  }
  hr { border: none; border-top: 1px solid #000; margin-bottom: 5px; }
  .entry { margin-bottom: 9px; }
  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .entry-title { font-weight: bold; font-size: inherit; }
  .entry-date { font-size: inherit; white-space: nowrap; flex-shrink: 0; }
  .entry-url { font-size: 9.5pt; color: #1a56db; margin-top: 1px; }
  .entry-sub2 { font-size: 9.5pt; color: #333; margin-top: 1px; }
  ul { padding-left: 1.2em; margin-top: 3px; margin-bottom: 0; }
  li { margin-bottom: 2px; font-size: inherit; }
  p { font-size: inherit; margin-bottom: 3px; }
  @media print {
    body { padding: 0; }
    @page { size: letter; margin: 0.5in 0.55in; }
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
