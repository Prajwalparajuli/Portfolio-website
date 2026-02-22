import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Loader2, Plus, Trash2, GripVertical, Eye, Save,
  ChevronDown, ChevronUp, FileText, Printer, Info, Sparkles
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
  if (s.contact_email) parts.push(s.contact_email)
  if (s.location) parts.push(s.location)
  if (s.linkedin_url) parts.push(s.linkedin_url.replace(/^https?:\/\//, ''))
  if (s.github_url) parts.push(s.github_url.replace(/^https?:\/\//, ''))
  return parts.join(' · ')
}

/**
 * Extract 2–3 clean, concise bullet suggestions from a project description.
 * Project descriptions are full TipTap HTML (often a README), so we must
 * aggressively strip noise before extracting meaningful sentences.
 */
function extractBulletsFromProject(project: Project): string[] {
  let text = project.description
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Remove HTML entities
    .replace(/&[a-z#0-9]+;/gi, ' ')
    // Remove emoji (supplementary + common symbols ranges)
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
    .replace(/[\u2600-\u27BF]/g, '')
    // Remove bare URLs
    .replace(/https?:\/\/\S+/g, '')
    // Remove file paths  (anything/like/this.py)
    .replace(/\S+\.(py|md|txt|js|ts|json|yaml|yml|sh|ipynb|env|csv)\b/gi, '')
    // Remove CLI commands / code artifacts
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    // Remove markdown headers
    .replace(/#{1,6}\s+[^\n]*/g, '')
    // Remove bold/italic markdown
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    // Remove lines that look like section headings or list markers
    .replace(/^([-*+]|\d+[.)]) .*/gm, '')
    // Remove horizontal rules
    .replace(/[-_*]{3,}/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()

  const SKIP = [
    /^(install|usage|getting started|table of contents|license|contributing|overview|features|requirements|prerequisites|run|demo|note)/i,
    /^(npm |pip |git |docker |python |streamlit |run |bash |sh |curl )/i,
    /\|.*\|/,         // table rows
    /^[A-Z_]{3,}:/,  // ALL_CAPS: labels
  ]

  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
    .map(s => s.trim())
    .filter(s => {
      if (s.length < 25 || s.length > 200) return false
      if (SKIP.some(re => re.test(s))) return false
      return true
    })

  // Pick first 3 good sentences, truncated to 160 chars each
  const bullets = sentences.slice(0, 3).map(s => s.length > 160 ? s.slice(0, 157) + '…' : s)
  // Always return at least one empty slot so the editor shows something
  return bullets.length > 0 ? bullets : ['']
}

// ─── sub-components ───────────────────────────────────────────────────────────

interface BulletListEditorProps {
  bullets: string[]
  onChange: (bullets: string[]) => void
}

function BulletListEditor({ bullets, onChange }: BulletListEditorProps) {
  const update = (i: number, val: string) => {
    const next = [...bullets]
    next[i] = val
    onChange(next)
  }
  const remove = (i: number) => onChange(bullets.filter((_, idx) => idx !== i))
  const add = () => onChange([...bullets, ''])

  return (
    <div className="space-y-2">
      {bullets.map((b, i) => (
        <div key={i} className="flex gap-2 items-start">
          <span className="mt-2 text-muted-foreground text-xs select-none pt-1">•</span>
          <Textarea
            value={b}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`Bullet ${i + 1}: e.g. "Built X using Y, achieving Z% improvement"`}
            className="bg-black/40 border-white/10 text-sm flex-1 min-h-[52px] resize-none"
            rows={2}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}
            className="text-destructive hover:text-destructive shrink-0 mt-1 h-7 w-7 p-0">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
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
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">2–3 sentences, keyword-rich</Label>
              <Textarea
                value={summSection?.text || ''}
                onChange={e => updateSection('summary', { text: e.target.value })}
                placeholder="Results-driven Data Scientist with experience in…"
                className="bg-black/40 border-white/10 min-h-[80px] text-sm resize-none"
              />
              <p className="text-[11px] text-muted-foreground/60">{countWords(summSection?.text || '')} words</p>
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
