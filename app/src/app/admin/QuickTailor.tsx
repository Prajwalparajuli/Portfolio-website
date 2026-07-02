import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Loader2, Sparkles, Copy, Check, FileText, NotebookPen, Printer, AlertCircle, CheckCircle2, ClipboardCopy
} from 'lucide-react'
import {
  getSettings, getAllProjects, getSkills, getResumeWorkspace,
  createResumeVariant, isSupabaseConfigured,
} from '@/lib/supabase'
import {
  tailorResumeToJob, generateCoverLetter, analyzeJdMatch,
} from '@/lib/resumeAi'
import { PortfolioSettings, Project, Skill } from '@/types'
import {
  ResumeContent, ResumeVariant, ResumeExperienceSection,
  ResumeSkillsSection, ResumeSummarySection, normalizeResumeContent, makeDefaultResumeContent,
} from '@/types/resume'
import { ResumePreview, PAPER_W, PAPER_H } from '@/components/admin/ResumePreview'
import { saveResumePrintDraft } from '@/lib/resumePrint'
import { cn } from '@/lib/utils'
import { getAdminPath } from '@/lib/adminConfig'

// ─── ScaledPreviewWrapper ─────────────────────────────────────────────────────

function ScaledPreviewWrapper({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => { setScale(Math.min(1, el.getBoundingClientRect().width / PAPER_W)) }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ width: '100%', overflow: 'hidden', position: 'relative', height: PAPER_H * scale }}>
      <div style={{ width: PAPER_W, transformOrigin: 'top left', transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const LS_JD_KEY = 'quick-tailor-jd'
const LS_HISTORY_KEY = 'quick-tailor-history'

interface SavedTailor {
  id: string
  jdSnippet: string
  coverLetter: string
  atsScore: number | null
  savedAt: string
}

function loadHistory(): SavedTailor[] {
  try { return JSON.parse(localStorage.getItem(LS_HISTORY_KEY) || '[]') } catch { return [] }
}

function buildContactLine(s: PortfolioSettings): string {
  const parts = [s.location, s.contact_email]
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  if (host && host !== 'localhost') parts.push(host)
  if (s.linkedin_url) parts.push(s.linkedin_url.replace(/^https?:\/\//, ''))
  if (s.github_url) parts.push(s.github_url.replace(/^https?:\/\//, ''))
  return parts.filter(Boolean).join('  ')
}

function normalizeForSettings(content: ResumeContent | null | undefined, settings: PortfolioSettings): ResumeContent {
  return normalizeResumeContent(
    content ?? makeDefaultResumeContent(settings.site_title || '', buildContactLine(settings), settings.education.length),
    { name: settings.site_title || '', contactLine: buildContactLine(settings), educationCount: settings.education.length }
  )
}

// ─── component ────────────────────────────────────────────────────────────────

export function AdminQuickTailor() {
  const [settings, setSettings] = useState<PortfolioSettings | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [variants, setVariants] = useState<ResumeVariant[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Tailor state — restore JD from localStorage
  const [jdText, setJdText] = useState(() => localStorage.getItem(LS_JD_KEY) || '')
  const [tailoring, setTailoring] = useState(false)
  const [tailoredContent, setTailoredContent] = useState<ResumeContent | null>(null)
  const [coverLetter, setCoverLetter] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<SavedTailor[]>(loadHistory)

  // ATS match
  const [atsScore, setAtsScore] = useState<number | null>(null)
  const [atsFound, setAtsFound] = useState<string[]>([])
  const [atsMissing, setAtsMissing] = useState<string[]>([])
  const [atsRedFlags, setAtsRedFlags] = useState<string[]>([])
  const [savingVariant, setSavingVariant] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  // Persist JD text to localStorage on change
  useEffect(() => { localStorage.setItem(LS_JD_KEY, jdText) }, [jdText])

  // Load workspace once
  useEffect(() => {
    let mounted = true
    const load = async () => {
      const [s, p, sk, ws] = await Promise.all([
        getSettings(), getAllProjects(), getSkills(), getResumeWorkspace(),
      ])
      if (!mounted) return
      setSettings(s)
      setProjects(p)
      setSkills(sk)
      setVariants(ws.variants)
      const primary = ws.variants.find(v => v.isPrimary) ?? ws.variants[0]
      if (primary) setSelectedVariantId(primary.id)
      setLoading(false)
    }
    void load()
    return () => { mounted = false }
  }, [])

  const selectedVariant = useMemo(
    () => variants.find(v => v.id === selectedVariantId) ?? null,
    [variants, selectedVariantId]
  )

  const baseContent = useMemo(() => {
    if (!settings || !selectedVariant) return null
    return normalizeForSettings(selectedVariant.content, settings)
  }, [settings, selectedVariant])

  // Compute orphaned skills
  const orphanedSkillNames = useMemo(() => {
    if (!baseContent || !skills.length) return []
    const skillsSection = baseContent.sections.find(s => s.type === 'skills') as ResumeSkillsSection | undefined
    const expSection = baseContent.sections.find(s => s.type === 'experience') as ResumeExperienceSection | undefined
    if (!skillsSection || !expSection) return []
    const included = skillsSection.includedIds === 'all' ? skills : skills.filter(sk => Array.isArray(skillsSection.includedIds) && skillsSection.includedIds.includes(sk.id))
    const allText = expSection.items.flatMap(i => i.bullets).join(' ').toLowerCase()
    return included.filter(sk => !allText.includes(sk.name.toLowerCase())).map(sk => sk.name)
  }, [baseContent, skills])

  // ── Tailor handler ──────────────────────────────────────────────────────────

  const handleTailor = useCallback(async () => {
    if (!baseContent || !settings || !jdText.trim()) return
    setTailoring(true)
    setErrorMsg(null)
    setTailoredContent(null)
    setCoverLetter('')
    setAtsScore(null)
    setAtsFound([])
    setAtsMissing([])
    setAtsRedFlags([])
    setSavedMsg(null)

    try {
      const summSection = baseContent.sections.find((s): s is ResumeSummarySection => s.type === 'summary')
      const expSection = baseContent.sections.find((s): s is ResumeExperienceSection => s.type === 'experience')
      if (!expSection || expSection.items.length === 0) {
        setErrorMsg('Your resume has no experience entries. Add projects in the Resume Builder first.')
        setTailoring(false)
        return
      }

      // Step 1: Tailor resume content
      const tailored = await tailorResumeToJob(
        jdText, summSection?.text ?? '', expSection.items, projects, skills, orphanedSkillNames
      )

      const nextContent: ResumeContent = {
        ...baseContent,
        sections: baseContent.sections.map(section => {
          if (section.type === 'summary') return { ...section, text: tailored.summary || section.text }
          if (section.type === 'experience') return { ...section, items: tailored.items }
          if (section.type === 'skills' && tailored.selectedSkillIds.length > 0) {
            return { ...section, includedIds: tailored.selectedSkillIds }
          }
          return section
        }),
      }
      setTailoredContent(nextContent)

      // Step 2: Generate cover letter (parallel with ATS)
      const [cl, ats] = await Promise.allSettled([
        generateCoverLetter(
          {
            title: tailored.jobTitle,
            company: tailored.jobCompany,
            location: '',
            employment_type: '',
            description: jdText,
          },
          { ...selectedVariant!, content: nextContent },
          skills
        ),
        analyzeJdMatch(
          jdText,
          [nextContent.header.name, nextContent.header.contactLine, ...nextContent.sections.map(s => {
            if (s.type === 'summary') return s.text
            if (s.type === 'experience') return s.items.map(i => i.bullets.join(' ')).join(' ')
            return ''
          })].join('\n')
        ),
      ])

      const generatedCoverLetter = cl.status === 'fulfilled' ? cl.value : ''
      setCoverLetter(generatedCoverLetter)
      setTailoredContent({
        ...nextContent,
        tailoring: {
          coverLetter: generatedCoverLetter,
          jobDescription: jdText,
          jobTitle: tailored.jobTitle,
          jobCompany: tailored.jobCompany,
          selectedProjectIds: tailored.selectedProjectIds,
          selectedSkillIds: tailored.selectedSkillIds,
          tailoredAt: new Date().toISOString(),
        },
      })
      if (ats.status === 'fulfilled') {
        setAtsScore(ats.value.score)
        setAtsFound(ats.value.foundKeywords)
        setAtsMissing(ats.value.missingKeywords)
        setAtsRedFlags(ats.value.redFlags)
      }

      // Auto-save to history
      const entry: SavedTailor = {
        id: crypto.randomUUID(),
        jdSnippet: jdText.slice(0, 100),
        coverLetter: generatedCoverLetter,
        atsScore: ats.status === 'fulfilled' ? ats.value.score : null,
        savedAt: new Date().toISOString(),
      }
      const nextHistory = [entry, ...history].slice(0, 20)
      setHistory(nextHistory)
      localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(nextHistory))
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Tailoring failed. Try again.')
    } finally {
      setTailoring(false)
    }
  }, [baseContent, settings, jdText, projects, skills, orphanedSkillNames, selectedVariant, history])

  // ── Save as variant ─────────────────────────────────────────────────────────

  const handleSaveVariant = useCallback(async () => {
    if (!tailoredContent || !selectedVariant || !settings) return
    setSavingVariant(true)
    try {
      const created = await createResumeVariant({
        candidateProfileId: selectedVariant.candidateProfileId,
        name: tailoredContent.tailoring?.jobCompany || tailoredContent.tailoring?.jobTitle
          ? [tailoredContent.tailoring.jobCompany, tailoredContent.tailoring.jobTitle].filter(Boolean).join(' - ')
          : `Tailored ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        variantType: 'tailored',
        isPrimary: false,
        sourceJobTitle: tailoredContent.tailoring?.jobTitle ?? '',
        sourceJobCompany: tailoredContent.tailoring?.jobCompany ?? '',
        sourceJobUrl: '',
        notes: `Quick Tailor — ${jdText.slice(0, 80)}...`,
        content: tailoredContent,
      }, { settings })
      if (created) {
        setVariants(prev => [created, ...prev])
        setSavedMsg(`Saved resume + cover letter as "${created.name}"`)
        setTimeout(() => setSavedMsg(null), 5000)
      } else {
        setSavedMsg('Saved variants are unavailable. Apply migration 003 first.')
      }
    } catch {
      setSavedMsg('Failed to save variant')
    } finally {
      setSavingVariant(false)
    }
  }, [tailoredContent, selectedVariant, settings, jdText])

  // ── Print PDF ───────────────────────────────────────────────────────────────

  const handlePrint = useCallback(() => {
    if (!tailoredContent || !settings) return
    saveResumePrintDraft({ resume: tailoredContent, settings, projects, skills })
    window.open(getAdminPath('resume/print'), '_blank')
  }, [tailoredContent, settings, projects, skills])

  // ── Copy cover letter ───────────────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(coverLetter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [coverLetter])

  const handleCoverLetterChange = useCallback((value: string) => {
    setCoverLetter(value)
    setTailoredContent((current) => current
      ? {
          ...current,
          tailoring: current.tailoring
            ? { ...current.tailoring, coverLetter: value }
            : undefined,
        }
      : current)
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!settings || variants.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Set up your resume first</h2>
        <p className="text-sm text-muted-foreground">
          Go to the Resume Builder and create your master resume with projects and bullets. Then come back here to tailor it.
        </p>
        <Link to={getAdminPath('resume')}>
          <Button>Open Resume Builder</Button>
        </Link>
      </div>
    )
  }

  const displayContent = tailoredContent ?? baseContent

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Quick Tailor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a job description to select the strongest portfolio evidence, write XYZ bullets, and save a tailored resume + cover letter.
        </p>
      </div>

      {/* Input area */}
      <Card className="glass border-white/10">
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Job description</label>
            <Textarea
              value={jdText}
              onChange={e => setJdText(e.target.value)}
              placeholder="Paste the full job description here..."
              rows={8}
              className="bg-black/30 border-white/10 text-sm leading-relaxed resize-y"
            />
            <p className="text-[11px] text-muted-foreground">{jdText.length > 0 ? `${jdText.length} characters` : 'Paste the entire JD — the more detail, the better the tailoring.'}</p>
          </div>

          {/* Variant picker */}
          {variants.length > 1 && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Base resume</label>
              <div className="flex flex-wrap gap-2">
                {variants.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setSelectedVariantId(v.id)
                      setTailoredContent(null)
                      setCoverLetter(v.content.tailoring?.coverLetter ?? '')
                      setAtsScore(null)
                    }}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs transition-colors',
                      v.id === selectedVariantId
                        ? 'border-accent/30 bg-accent/10 text-foreground'
                        : 'border-white/10 text-muted-foreground hover:border-white/20'
                    )}
                  >
                    {v.isPrimary ? '★ ' : ''}{v.name || 'Untitled'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tailor button */}
          <Button
            size="lg"
            className="w-full gap-2 text-sm"
            disabled={!jdText.trim() || tailoring || !isSupabaseConfigured}
            onClick={handleTailor}
          >
            {tailoring ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Tailoring resume + generating cover letter...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Tailor Resume &amp; Cover Letter
              </>
            )}
          </Button>

          {!isSupabaseConfigured && (
            <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300/80 flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              Supabase is not configured. Deploy the resume-ai edge function and set GEMINI_API_KEY in secrets.
            </div>
          )}

          {errorMsg && (
            <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-3 py-2 text-xs text-red-300">
              {errorMsg}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {(tailoredContent || tailoring) && (
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Left: Resume preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Tailored Resume</h2>
              <div className="flex items-center gap-2">
                {tailoredContent && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={handlePrint}>
                      <Printer className="h-3 w-3" /> Print PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-7"
                      onClick={handleSaveVariant}
                      disabled={savingVariant}
                    >
                      {savingVariant ? <Loader2 className="h-3 w-3 animate-spin" /> : <NotebookPen className="h-3 w-3" />}
                      Save resume + cover
                    </Button>
                    <Link to={getAdminPath('resume')}>
                      <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7">
                        Edit in Builder
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>

            {savedMsg && (
              <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-1.5 text-xs text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" /> {savedMsg}
              </div>
            )}

            {displayContent && settings && (
              <div className="rounded-xl border border-white/15 overflow-hidden shadow-2xl">
                <ScaledPreviewWrapper>
                  <ResumePreview
                    resume={displayContent}
                    settings={settings}
                    projects={projects}
                    skills={skills}
                  />
                </ScaledPreviewWrapper>
              </div>
            )}
          </div>

          {/* Right: Cover letter + ATS score */}
          <div className="space-y-4">
            {/* Cover letter */}
            <Card className="glass border-white/10">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Cover Letter</h2>
                  {coverLetter && (
                    <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={handleCopy}>
                      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                  )}
                </div>
                {coverLetter ? (
                  <Textarea
                    value={coverLetter}
                    onChange={e => handleCoverLetterChange(e.target.value)}
                    rows={14}
                    className="bg-black/30 border-white/10 text-sm leading-relaxed resize-y"
                  />
                ) : tailoring ? (
                  <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-xs">
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                  </div>
                ) : (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    Cover letter will appear here after tailoring.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ATS Match Score */}
            {atsScore != null && (
              <Card className="glass border-white/10">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">ATS Match Score</h2>
                    <span className={cn(
                      'text-2xl font-bold',
                      atsScore >= 80 ? 'text-emerald-400' : atsScore >= 60 ? 'text-amber-400' : 'text-red-400'
                    )}>
                      {atsScore}%
                    </span>
                  </div>

                  {atsFound.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] uppercase tracking-wider text-emerald-400/80">Matched keywords</p>
                      <div className="flex flex-wrap gap-1">
                        {atsFound.map(k => (
                          <Badge key={k} variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">{k}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {atsMissing.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] uppercase tracking-wider text-amber-400/80">Missing keywords</p>
                      <div className="flex flex-wrap gap-1">
                        {atsMissing.map(k => (
                          <Badge key={k} variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">{k}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {atsRedFlags.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[10px] uppercase tracking-wider text-red-400/80">Red flags</p>
                      <ul className="space-y-1">
                        {atsRedFlags.map((f, i) => (
                          <li key={i} className="text-xs text-red-300/80">• {f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quick copy all */}
            {coverLetter && tailoredContent && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={async () => {
                  // Build a plain text summary of the tailored resume
                  const summaryText = tailoredContent.sections.find(s => s.type === 'summary') as ResumeSummarySection | undefined
                  const expItems = (tailoredContent.sections.find(s => s.type === 'experience') as ResumeExperienceSection | undefined)?.items ?? []
                  const resumeText = [
                    tailoredContent.header.name,
                    summaryText?.text,
                    ...expItems.map(item => {
                      const title = item.kind === 'project' ? item.titleOverride : item.role
                      return `${title}\n${item.bullets.map(b => `• ${b}`).join('\n')}`
                    }),
                  ].filter(Boolean).join('\n\n')
                  await navigator.clipboard.writeText(`${resumeText}\n\n---\n\n${coverLetter}`)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
              >
                <ClipboardCopy className="h-3 w-3" />
                Copy everything (resume + cover letter)
              </Button>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && !tailoring && !tailoredContent && (
        <Card className="glass border-white/10">
          <CardContent className="p-4 space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Recent tailors</h2>
            <div className="space-y-1.5">
              {history.slice(0, 5).map(h => (
                <div key={h.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground truncate">{h.jdSnippet}...</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(h.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                  {h.atsScore != null && (
                    <span className={cn('text-xs font-bold ml-3', h.atsScore >= 80 ? 'text-emerald-400' : h.atsScore >= 60 ? 'text-amber-400' : 'text-red-400')}>{h.atsScore}%</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
