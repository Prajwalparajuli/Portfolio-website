/**
 * ResumePreview — renders at EXACTLY the same font sizes and margins as print.
 * Always 816px wide (8.5 in at 96 dpi). The caller wraps this in a CSS scale()
 * transform to fit it into the preview panel — so WYSIWYG is guaranteed.
 *
 * When `onUpdate` is provided all text fields become contentEditable inline.
 */
import { useRef, useState, useEffect } from 'react'
import {
  ResumeContent,
  ResumeEducationSection,
  ResumeExperienceSection,
  ResumeSkillsSection,
  ResumeSummarySection,
  ProjectExperienceItem,
  ExperienceItem,
} from '@/types/resume'
import { PortfolioSettings, Project, Skill } from '@/types'

// ─── print dimensions (shared between preview and actual print) ───────────────
// 8.5 in × 11 in at 96 dpi = 816 × 1056 px
export const PAPER_W = 816
export const PAPER_H = 1056

const STYLE = {
  body: '10.5pt',
  name: '17pt',
  head: '10pt',
  small: '9.5pt',
  padTop: 34,   // 0.35in — reduced to fit dense content on one page
  padBottom: 43, // 0.45in
  padH: 53,     // 0.55in left/right
  entryGap: 10,
  sectionGap: 12,
} as const

// ─── InlineEdit ───────────────────────────────────────────────────────────────

interface InlineEditProps {
  value: string
  onChange: (v: string) => void
  style?: React.CSSProperties
  multiline?: boolean
  placeholder?: string
}

function InlineEdit({ value, onChange, style, multiline = false, placeholder }: InlineEditProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [focused, setFocused] = useState(false)
  const last = useRef(value)

  useEffect(() => {
    if (ref.current) ref.current.textContent = value
    last.current = value
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focused && ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value
      last.current = value
    }
  }, [value, focused])

  const commit = () => {
    const v = (ref.current?.textContent ?? '').trim()
    last.current = v
    if (v !== value) onChange(v)
  }

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-ph={!value && !focused ? (placeholder ?? '') : undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit() }}
      onKeyDown={e => {
        if (!multiline && e.key === 'Enter') { e.preventDefault(); ref.current?.blur() }
        if (e.key === 'Escape') { if (ref.current) ref.current.textContent = last.current; ref.current?.blur() }
      }}
      className="resume-editable"
      style={{
        ...style,
        outline: 'none',
        cursor: 'text',
        borderRadius: 2,
        display: style?.display ?? 'inline-block',
        minWidth: 12,
        wordBreak: 'break-word',
        whiteSpace: multiline ? 'pre-wrap' : 'normal',
        boxShadow: focused ? 'inset 0 -2px 0 #2563eb' : 'inset 0 -1px 0 rgba(37,99,235,0)',
        background: focused ? 'rgba(37,99,235,0.05)' : 'transparent',
        transition: 'box-shadow 0.12s, background 0.12s',
      }}
    />
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: STYLE.sectionGap }}>
      <div style={{
        fontSize: STYLE.head,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        marginBottom: 2,
        fontFamily: 'inherit',
      }}>
        {title}
      </div>
      <hr style={{ border: 'none', borderTop: '0.75px solid #000', marginBottom: 5 }} />
      {children}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export interface ResumePreviewProps {
  resume: ResumeContent
  settings: PortfolioSettings
  projects: Project[]
  skills: Skill[]
  onUpdate?: (updated: ResumeContent) => void
}

export function ResumePreview({
  resume, settings, projects, skills, onUpdate,
}: ResumePreviewProps) {
  const editable = !!onUpdate

  const eduSection = resume.sections.find(s => s.type === 'education') as ResumeEducationSection | undefined
  const expSection = resume.sections.find(s => s.type === 'experience') as ResumeExperienceSection | undefined
  const skillsSection = resume.sections.find(s => s.type === 'skills') as ResumeSkillsSection | undefined
  const summSection = resume.sections.find(s => s.type === 'summary') as ResumeSummarySection | undefined

  // ── update helpers ──────────────────────────────────────────────────────────
  const patchHeader = (patch: Partial<ResumeContent['header']>) =>
    onUpdate?.({ ...resume, header: { ...resume.header, ...patch } })

  const patchSections = (fn: (s: ResumeContent['sections']) => ResumeContent['sections']) =>
    onUpdate?.({ ...resume, sections: fn(resume.sections) })

  const patchSummary = (text: string) =>
    patchSections(s => s.map(x => x.type === 'summary' ? { ...x, text } : x))

  const patchExpItem = (idx: number, patch: Partial<ExperienceItem>) =>
    patchSections(s => s.map(x =>
      x.type === 'experience'
        ? { ...x, items: x.items.map((it, i) => i === idx ? { ...it, ...patch } as ExperienceItem : it) }
        : x
    ))

  const patchBullet = (itemIdx: number, bi: number, val: string) =>
    patchSections(s => s.map(x =>
      x.type === 'experience'
        ? {
            ...x, items: x.items.map((it, i) => {
              if (i !== itemIdx) return it
              const bullets = [...it.bullets]; bullets[bi] = val; return { ...it, bullets }
            })
          }
        : x
    ))

  const addBullet = (itemIdx: number) =>
    patchSections(s => s.map(x =>
      x.type === 'experience'
        ? { ...x, items: x.items.map((it, i) => i === itemIdx ? { ...it, bullets: [...it.bullets, ''] } : it) }
        : x
    ))

  const removeBullet = (itemIdx: number, bi: number) =>
    patchSections(s => s.map(x =>
      x.type === 'experience'
        ? { ...x, items: x.items.map((it, i) => i === itemIdx ? { ...it, bullets: it.bullets.filter((_, j) => j !== bi) } : it) }
        : x
    ))

  const removeExpItem = (idx: number) =>
    patchSections(s => s.map(x =>
      x.type === 'experience' ? { ...x, items: x.items.filter((_, i) => i !== idx) } : x
    ))

  // ── derived ─────────────────────────────────────────────────────────────────
  const includedSkills = skillsSection?.includedIds === 'all'
    ? skills
    : skills.filter(s => (skillsSection?.includedIds as string[] | undefined || []).includes(s.id))

  const includedEdu = eduSection?.includedIndices
    .map(i => settings.education[i]).filter(Boolean) ?? []

  // ── font styles ─────────────────────────────────────────────────────────────
  const bodyStyle: React.CSSProperties = {
    fontFamily: "'Times New Roman', Georgia, serif",
    fontSize: STYLE.body,
    lineHeight: 1.42,
    color: '#000',
    background: '#fff',
    width: PAPER_W,
    minHeight: PAPER_H,
    padding: `${STYLE.padTop}px ${STYLE.padH}px ${STYLE.padBottom}px`,
    boxSizing: 'border-box',
  }

  return (
    <div id="resume-preview-root" style={{ width: PAPER_W, background: '#fff' }}>
      {editable && (
        <style>{`
          .resume-editable:hover:not(:focus) { box-shadow: inset 0 -1px 0 rgba(37,99,235,0.5) !important; }
          [data-ph]:empty::before { content: attr(data-ph); color: #bbb; font-style: italic; pointer-events: none; }
          .exp-entry:hover .exp-rm { opacity: 1 !important; }
          .bul-row:hover .bul-rm { opacity: 1 !important; }
        `}</style>
      )}

      <div style={bodyStyle}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header style={{ textAlign: 'center', marginBottom: STYLE.sectionGap }}>
          {editable ? (
            <>
              <InlineEdit
                value={resume.header.name}
                onChange={v => patchHeader({ name: v })}
                placeholder="YOUR NAME"
                style={{
                  fontSize: STYLE.name, fontWeight: 'bold', letterSpacing: '0.04em',
                  textTransform: 'uppercase', display: 'block', textAlign: 'center', width: '100%',
                }}
              />
              <InlineEdit
                value={resume.header.contactLine}
                onChange={v => patchHeader({ contactLine: v })}
                placeholder="City State  email  phone  linkedin.com/in/x  github.com/x"
                style={{ fontSize: STYLE.small, color: '#222', marginTop: 3, display: 'block', textAlign: 'center', width: '100%' }}
              />
            </>
          ) : (
            <>
              <div style={{ fontSize: STYLE.name, fontWeight: 'bold', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {resume.header.name || 'YOUR NAME'}
              </div>
              <div style={{ fontSize: STYLE.small, color: '#222', marginTop: 3 }}>
                {resume.header.contactLine}
              </div>
            </>
          )}
        </header>

        {/* ── Sections in declared order ───────────────────────────────────── */}
        {resume.sections.map((sec, si) => {

          /* ── Summary ──────────────────────────────────────────────────── */
          if (sec.type === 'summary' && sec.enabled) {
            if (!editable && !summSection?.text) return null
            return (
              <Section key={si} title="SUMMARY">
                {editable ? (
                  <InlineEdit
                    value={summSection?.text ?? ''}
                    onChange={patchSummary}
                    multiline
                    placeholder="2–3 sentences: your background, skills, and focus area…"
                    style={{ fontSize: 'inherit', display: 'block', width: '100%', lineHeight: 'inherit' }}
                  />
                ) : (
                  <p style={{ margin: 0 }}>{summSection?.text}</p>
                )}
              </Section>
            )
          }

          /* ── Experience / Projects ────────────────────────────────────── */
          if (sec.type === 'experience' && sec.enabled && expSection && expSection.items.length > 0) {
            return (
              <Section key={si} title={expSection.sectionTitle || 'PROJECT'}>
                {expSection.items.map((item, i) => {
                  const titleVal = item.kind === 'project'
                    ? (item.titleOverride || projects.find(p => p.id === (item as ProjectExperienceItem).projectId)?.title || '')
                    : item.role
                  const subtitleVal = item.subtitle ?? ''
                  const urlVal = item.url ?? ''
                  const githubUrlVal = item.kind === 'project' ? ((item as ProjectExperienceItem).githubUrl ?? '') : ''

                  return (
                    <div
                      key={i}
                      className="exp-entry"
                      style={{ marginBottom: STYLE.entryGap, position: 'relative', paddingRight: editable ? 18 : 0 }}
                    >
                      {/* ✕ remove entry */}
                      {editable && (
                        <button className="exp-rm" onClick={() => removeExpItem(i)} contentEditable={false}
                          style={{
                            position: 'absolute', right: 0, top: 0, opacity: 0, transition: 'opacity 0.15s',
                            background: 'rgba(220,38,38,0.1)', border: 'none', borderRadius: 3,
                            width: 15, height: 15, fontSize: 10, cursor: 'pointer', color: '#dc2626', textAlign: 'center',
                          }}>×</button>
                      )}

                      {/* Row 1: Title [— Subtitle]  Date */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, flex: 1, flexWrap: 'wrap' }}>
                          {editable ? (
                            <>
                              <InlineEdit
                                value={titleVal}
                                onChange={v => patchExpItem(i, item.kind === 'project' ? { titleOverride: v } : { role: v })}
                                placeholder="Project / Role Title"
                                style={{ fontWeight: 'bold', fontSize: 'inherit' }}
                              />
                              {(subtitleVal || editable) && (
                                <span style={{ color: '#333' }}>
                                  {' — '}
                                  <InlineEdit
                                    value={subtitleVal}
                                    onChange={v => patchExpItem(i, { subtitle: v })}
                                    placeholder="Subtitle"
                                    style={{ fontSize: 'inherit', color: '#333' }}
                                  />
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <span style={{ fontWeight: 'bold' }}>{titleVal}</span>
                              {subtitleVal && <span style={{ color: '#333' }}> — {subtitleVal}</span>}
                            </>
                          )}
                        </div>
                        {editable ? (
                          <InlineEdit
                            value={item.dateRange}
                            onChange={v => patchExpItem(i, { dateRange: v })}
                            placeholder="Date range"
                            style={{ fontSize: 'inherit', whiteSpace: 'nowrap', color: '#333', flexShrink: 0 }}
                          />
                        ) : (
                          item.dateRange && (
                            <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{item.dateRange}</span>
                          )
                        )}
                      </div>

                      {/* Row 2: primary URL */}
                      {(editable || urlVal) && (
                        <div style={{ fontSize: STYLE.small, marginTop: 1 }}>
                          {editable ? (
                            <InlineEdit
                              value={urlVal}
                              onChange={v => patchExpItem(i, { url: v })}
                              placeholder="https://demo-url (optional)"
                              style={{ fontSize: 'inherit', color: '#1a56db' }}
                            />
                          ) : (
                            <span style={{ color: '#1a56db' }}>{urlVal}</span>
                          )}
                        </div>
                      )}

                      {/* Row 3: github URL • org */}
                      {(editable || githubUrlVal || item.org) && (
                        <div style={{ fontSize: STYLE.small, color: '#333', marginTop: 1, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'baseline' }}>
                          {editable ? (
                            <>
                              {item.kind === 'project' && (
                                <InlineEdit
                                  value={githubUrlVal}
                                  onChange={v => patchExpItem(i, { githubUrl: v })}
                                  placeholder="github.com/user/repo (optional)"
                                  style={{ fontSize: 'inherit', color: '#333' }}
                                />
                              )}
                              {(githubUrlVal || item.kind === 'project') && item.org && (
                                <span style={{ color: '#999' }}> • </span>
                              )}
                              <InlineEdit
                                value={item.org}
                                onChange={v => patchExpItem(i, { org: v })}
                                placeholder="Organization (optional)"
                                style={{ fontSize: 'inherit', color: '#333' }}
                              />
                            </>
                          ) : (
                            <>
                              {githubUrlVal && <span>{githubUrlVal}</span>}
                              {githubUrlVal && item.org && <span style={{ color: '#999' }}> • </span>}
                              {item.org && <span>{item.org}</span>}
                            </>
                          )}
                        </div>
                      )}

                      {/* Bullets */}
                      {(editable || item.bullets.filter(Boolean).length > 0) && (
                        <ul style={{ paddingLeft: '1.15em', marginTop: 3, marginBottom: 0 }}>
                          {item.bullets.map((b, j) => {
                            if (!editable && !b) return null
                            return (
                              <li key={j} className="bul-row"
                                style={{ marginBottom: 2, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                {editable ? (
                                  <>
                                    <InlineEdit
                                      value={b}
                                      onChange={v => patchBullet(i, j, v)}
                                      multiline
                                      placeholder="[Action Verb] + [what + tools/scale] + [quantified result]"
                                      style={{ fontSize: 'inherit', flex: 1, lineHeight: 'inherit', display: 'block' }}
                                    />
                                    <button className="bul-rm" onClick={() => removeBullet(i, j)} contentEditable={false}
                                      style={{ opacity: 0, transition: 'opacity 0.15s', background: 'none', border: 'none', fontSize: 10, cursor: 'pointer', color: '#dc2626', padding: '1px 2px', flexShrink: 0 }}>
                                      ×
                                    </button>
                                  </>
                                ) : b}
                              </li>
                            )
                          })}
                          {editable && (
                            <li style={{ listStyle: 'none', marginTop: 3 }}>
                              <button onClick={() => addBullet(i)} contentEditable={false}
                                style={{ background: 'none', border: '1px dashed rgba(37,99,235,0.35)', borderRadius: 2, fontSize: '8pt', color: '#2563eb', cursor: 'pointer', padding: '1px 6px' }}>
                                + add bullet
                              </button>
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </Section>
            )
          }

          /* ── Skills ───────────────────────────────────────────────────── */
          if (sec.type === 'skills' && sec.enabled && includedSkills.length > 0) {
            return (
              <Section key={si} title="SKILLS">
                {skillsSection!.groupByCategory
                  ? (() => {
                      const cats = [...new Set(includedSkills.map(s => s.category))]
                      return cats.map(cat => {
                        const catSkills = includedSkills.filter(s => s.category === cat)
                        return (
                          <p key={cat} style={{ margin: '0 0 3px' }}>
                            {catSkills.map(s => s.name).join(', ')}
                          </p>
                        )
                      })
                    })()
                  : <p style={{ margin: 0 }}>{includedSkills.map(s => s.name).join(', ')}</p>
                }
              </Section>
            )
          }

          /* ── Education ────────────────────────────────────────────────── */
          if (sec.type === 'education' && sec.enabled && includedEdu.length > 0) {
            return (
              <Section key={si} title="EDUCATION">
                {includedEdu.map((entry, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <div style={{ fontWeight: 'bold' }}>{entry.title}</div>
                    <div style={{ fontSize: STYLE.small, color: '#222' }}>
                      {entry.issuer}
                      {entry.url ? <span> • <span style={{ color: '#1a56db' }}>{entry.url}</span></span> : null}
                      {' • '}{entry.date}
                    </div>
                  </div>
                ))}
              </Section>
            )
          }

          return null
        })}

        {editable && (
          <p style={{ fontSize: '7pt', color: '#bbb', marginTop: 8, fontFamily: 'sans-serif', fontStyle: 'italic' }}>
            Education and Skills are managed in the left panel.
          </p>
        )}

      </div>
    </div>
  )
}
