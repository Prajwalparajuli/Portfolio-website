/**
 * ResumePreview — ATS-style resume preview with optional inline editing.
 *
 * When `onUpdate` is provided:
 *   • All text fields (name, contact, summary, titles, org, dates, bullets)
 *     become contentEditable — click any text to edit in place.
 *   • Hover an experience entry to reveal a remove (×) button.
 *   • Hover a bullet to reveal a remove (×) button.
 *   • "+ add bullet" button appears at the bottom of each bullet list.
 *   • Education & Skills remain read-only (managed elsewhere).
 *
 * When `printMode` is true, everything is read-only and styled for print.
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

// ─── InlineEdit ───────────────────────────────────────────────────────────────
/**
 * A contentEditable span that looks like normal resume text but turns blue
 * on focus so the user knows it's editable.
 * • Single-line (default): Enter blurs (commits). Escape reverts.
 * • Multi-line: Enter inserts a newline. Escape reverts.
 */
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

  // Initialise DOM content on mount only
  useEffect(() => {
    if (ref.current) ref.current.textContent = value
    last.current = value
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync external value changes when not actively editing
  useEffect(() => {
    if (!focused && ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value
      last.current = value
    }
  }, [value, focused])

  const commit = () => {
    const newVal = (ref.current?.textContent ?? '').trim()
    last.current = newVal
    if (newVal !== value) onChange(newVal)
  }

  const isEmpty = !value && !focused

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      // data-ph drives the CSS ::before placeholder
      data-ph={isEmpty ? (placeholder ?? '') : undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit() }}
      onKeyDown={(e) => {
        if (!multiline && e.key === 'Enter') { e.preventDefault(); ref.current?.blur() }
        if (e.key === 'Escape') {
          if (ref.current) ref.current.textContent = last.current
          ref.current?.blur()
        }
      }}
      className="resume-editable"
      style={{
        ...style,
        outline: 'none',
        cursor: 'text',
        borderRadius: 2,
        display: style?.display ?? 'inline-block',
        minWidth: 16,
        wordBreak: 'break-word',
        whiteSpace: multiline ? 'pre-wrap' : 'normal',
        boxShadow: focused
          ? 'inset 0 -2px 0 #2563eb'
          : 'inset 0 -1px 0 rgba(37,99,235,0)',
        background: focused ? 'rgba(37,99,235,0.05)' : 'transparent',
        transition: 'box-shadow 0.12s, background 0.12s',
      }}
    />
  )
}

// ─── component ────────────────────────────────────────────────────────────────

export interface ResumePreviewProps {
  resume: ResumeContent
  settings: PortfolioSettings
  projects: Project[]
  skills: Skill[]
  printMode?: boolean
  /** When provided, the preview becomes inline-editable */
  onUpdate?: (updated: ResumeContent) => void
}

export function ResumePreview({
  resume,
  settings,
  projects,
  skills,
  printMode = false,
  onUpdate,
}: ResumePreviewProps) {
  const editable = !!onUpdate && !printMode

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
    patchSections(secs => secs.map(s => s.type === 'summary' ? { ...s, text } : s))

  const patchExpItem = (idx: number, patch: Partial<ExperienceItem>) =>
    patchSections(secs => secs.map(s =>
      s.type === 'experience'
        ? { ...s, items: s.items.map((it, i) => i === idx ? { ...it, ...patch } as ExperienceItem : it) }
        : s
    ))

  const patchBullet = (itemIdx: number, bulletIdx: number, val: string) =>
    patchSections(secs => secs.map(s =>
      s.type === 'experience'
        ? {
            ...s, items: s.items.map((it, i) => {
              if (i !== itemIdx) return it
              const bullets = [...it.bullets]
              bullets[bulletIdx] = val
              return { ...it, bullets }
            })
          }
        : s
    ))

  const addBullet = (itemIdx: number) =>
    patchSections(secs => secs.map(s =>
      s.type === 'experience'
        ? { ...s, items: s.items.map((it, i) => i === itemIdx ? { ...it, bullets: [...it.bullets, ''] } : it) }
        : s
    ))

  const removeBullet = (itemIdx: number, bulletIdx: number) =>
    patchSections(secs => secs.map(s =>
      s.type === 'experience'
        ? {
            ...s, items: s.items.map((it, i) =>
              i === itemIdx ? { ...it, bullets: it.bullets.filter((_, j) => j !== bulletIdx) } : it
            )
          }
        : s
    ))

  const removeExpItem = (idx: number) =>
    patchSections(secs => secs.map(s =>
      s.type === 'experience' ? { ...s, items: s.items.filter((_, i) => i !== idx) } : s
    ))

  // ── derived ─────────────────────────────────────────────────────────────────

  const includedSkills = skillsSection?.includedIds === 'all'
    ? skills
    : skills.filter(s => (skillsSection?.includedIds as string[] | undefined || []).includes(s.id))

  const includedEdu = eduSection?.includedIndices
    .map(i => settings.education[i])
    .filter(Boolean) ?? []

  // ── render ───────────────────────────────────────────────────────────────────

  const body: React.CSSProperties = {
    fontFamily: "'Times New Roman', Georgia, serif",
    lineHeight: 1.45,
    padding: printMode ? '0.75in 0.75in' : '20px 24px',
    fontSize: printMode ? '11pt' : '9.5pt',
  }

  return (
    <div
      style={{
        width: '100%',
        minHeight: printMode ? '100vh' : 700,
        background: '#fff',
        color: '#000',
        position: 'relative',
      }}
      id="resume-preview-root"
    >
      {/* Inline styles for editable hover effects */}
      {editable && (
        <style>{`
          .resume-editable:hover:not(:focus) {
            box-shadow: inset 0 -1px 0 rgba(37,99,235,0.4) !important;
          }
          [data-ph]:empty::before {
            content: attr(data-ph);
            color: #bbb;
            font-style: italic;
            pointer-events: none;
          }
          .exp-entry:hover .exp-remove { opacity: 1 !important; }
          .bullet-row:hover .bullet-del { opacity: 1 !important; }
        `}</style>
      )}

      <div style={body}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header style={{ textAlign: 'center', marginBottom: 14 }}>
          {editable ? (
            <>
              <InlineEdit
                value={resume.header.name}
                onChange={name => patchHeader({ name })}
                placeholder="Your Name"
                style={{
                  fontSize: '15pt', fontWeight: 'bold', letterSpacing: '0.02em',
                  display: 'block', textAlign: 'center', width: '100%',
                }}
              />
              <InlineEdit
                value={resume.header.contactLine}
                onChange={contactLine => patchHeader({ contactLine })}
                placeholder="email · city · linkedin.com/in/x · github.com/x"
                style={{
                  fontSize: '8.5pt', color: '#444', marginTop: 3,
                  display: 'block', textAlign: 'center', width: '100%',
                }}
              />
            </>
          ) : (
            <>
              <div style={{ fontSize: printMode ? '18pt' : '15pt', fontWeight: 'bold', letterSpacing: '0.02em' }}>
                {resume.header.name || 'Your Name'}
              </div>
              <div style={{ fontSize: printMode ? '9.5pt' : '8.5pt', color: '#444', marginTop: 3 }}>
                {resume.header.contactLine || 'email · location · linkedin · github'}
              </div>
            </>
          )}
        </header>

        {/* ── Summary ─────────────────────────────────────────────────────── */}
        {summSection?.enabled && (editable || summSection.text) && (
          <Section title="SUMMARY" printMode={printMode}>
            {editable ? (
              <InlineEdit
                value={summSection.text}
                onChange={patchSummary}
                multiline
                placeholder="2–3 sentences: who you are, what you build, your impact…"
                style={{ fontSize: 'inherit', display: 'block', width: '100%', lineHeight: 'inherit' }}
              />
            ) : (
              <p style={{ fontSize: 'inherit', margin: 0 }}>{summSection.text}</p>
            )}
          </Section>
        )}

        {/* ── Experience ──────────────────────────────────────────────────── */}
        {expSection?.enabled && expSection.items.length > 0 && (
          <Section title="EXPERIENCE" printMode={printMode}>
            {expSection.items.map((item, i) => {
              const titleVal = item.kind === 'project'
                ? (item.titleOverride || projects.find(p => p.id === (item as ProjectExperienceItem).projectId)?.title || '')
                : item.role

              return (
                <div
                  key={i}
                  className="exp-entry"
                  style={{ marginBottom: 10, position: 'relative', paddingRight: editable ? 20 : 0 }}
                >
                  {/* ✕ remove entry */}
                  {editable && (
                    <button
                      className="exp-remove"
                      onClick={() => removeExpItem(i)}
                      title="Remove this entry"
                      contentEditable={false}
                      style={{
                        position: 'absolute', right: 0, top: 0,
                        opacity: 0, transition: 'opacity 0.15s',
                        background: 'rgba(220,38,38,0.1)', border: 'none',
                        borderRadius: 3, width: 16, height: 16,
                        fontSize: 11, lineHeight: '16px', cursor: 'pointer',
                        color: '#dc2626', textAlign: 'center',
                      }}
                    >×</button>
                  )}

                  {/* title + date */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    {editable ? (
                      <>
                        <InlineEdit
                          value={titleVal}
                          onChange={v => patchExpItem(i, item.kind === 'project' ? { titleOverride: v } : { role: v })}
                          placeholder="Project / Role Title"
                          style={{ fontWeight: 'bold', fontSize: 'inherit', flex: 1 }}
                        />
                        <InlineEdit
                          value={item.dateRange}
                          onChange={v => patchExpItem(i, { dateRange: v })}
                          placeholder="Date range"
                          style={{ fontSize: 'inherit', whiteSpace: 'nowrap', color: '#333', flexShrink: 0 }}
                        />
                      </>
                    ) : (
                      <>
                        <span style={{ fontWeight: 'bold', fontSize: 'inherit' }}>{titleVal}</span>
                        <span style={{ fontSize: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.dateRange}</span>
                      </>
                    )}
                  </div>

                  {/* org */}
                  {(editable || item.org) && (
                    <div style={{ fontStyle: 'italic', color: '#333', fontSize: 'inherit', marginBottom: 2 }}>
                      {editable ? (
                        <InlineEdit
                          value={item.org}
                          onChange={v => patchExpItem(i, { org: v })}
                          placeholder="Organization / Company"
                          style={{ fontStyle: 'italic', color: '#333', fontSize: 'inherit', display: 'block', width: '100%' }}
                        />
                      ) : item.org}
                    </div>
                  )}

                  {/* bullets */}
                  {(editable || item.bullets.filter(Boolean).length > 0) && (
                    <ul style={{ paddingLeft: '1.2em', marginTop: 3, marginBottom: 0 }}>
                      {item.bullets.map((b, j) => {
                        if (!editable && !b) return null
                        return (
                          <li
                            key={j}
                            className="bullet-row"
                            style={{ marginBottom: 3, fontSize: 'inherit', display: 'flex', alignItems: 'flex-start', gap: 3 }}
                          >
                            {editable ? (
                              <>
                                <InlineEdit
                                  value={b}
                                  onChange={v => patchBullet(i, j, v)}
                                  multiline
                                  placeholder="Impact bullet: Built X using Y, achieving Z"
                                  style={{ fontSize: 'inherit', flex: 1, lineHeight: 'inherit', display: 'block' }}
                                />
                                <button
                                  className="bullet-del"
                                  onClick={() => removeBullet(i, j)}
                                  title="Remove bullet"
                                  contentEditable={false}
                                  style={{
                                    opacity: 0, transition: 'opacity 0.15s',
                                    background: 'none', border: 'none',
                                    fontSize: 11, lineHeight: 1, cursor: 'pointer',
                                    color: '#dc2626', flexShrink: 0, padding: '2px 2px 0',
                                  }}
                                >×</button>
                              </>
                            ) : b}
                          </li>
                        )
                      })}

                      {/* + add bullet */}
                      {editable && (
                        <li style={{ listStyle: 'none', marginTop: 3 }}>
                          <button
                            onClick={() => addBullet(i)}
                            contentEditable={false}
                            style={{
                              background: 'none',
                              border: '1px dashed rgba(37,99,235,0.35)',
                              borderRadius: 2,
                              fontSize: '7.5pt',
                              color: '#2563eb',
                              cursor: 'pointer',
                              padding: '1px 6px',
                            }}
                          >+ add bullet</button>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )
            })}
          </Section>
        )}

        {/* ── Education (read-only) ────────────────────────────────────────── */}
        {eduSection?.enabled && includedEdu.length > 0 && (
          <Section title="EDUCATION" printMode={printMode}>
            {includedEdu.map((entry, i) => (
              <div key={i} style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontWeight: 'bold', fontSize: 'inherit' }}>{entry.title}</span>
                  <span style={{ fontSize: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>{entry.date}</span>
                </div>
                <div style={{ fontStyle: 'italic', color: '#333', fontSize: 'inherit' }}>{entry.issuer}</div>
              </div>
            ))}
          </Section>
        )}

        {/* ── Skills (read-only) ───────────────────────────────────────────── */}
        {skillsSection?.enabled && includedSkills.length > 0 && (
          <Section title="SKILLS" printMode={printMode}>
            {skillsSection.groupByCategory
              ? (() => {
                  const cats = [...new Set(includedSkills.map(s => s.category))]
                  return cats.map(cat => {
                    const catSkills = includedSkills.filter(s => s.category === cat)
                    return (
                      <p key={cat} style={{ marginBottom: 4, fontSize: 'inherit' }}>
                        <strong style={{ textTransform: 'capitalize' }}>{cat}:</strong>{' '}
                        {catSkills.map(s => s.name).join(', ')}
                      </p>
                    )
                  })
                })()
              : <p style={{ fontSize: 'inherit' }}>{includedSkills.map(s => s.name).join(', ')}</p>
            }
          </Section>
        )}

        {/* Note for editable mode */}
        {editable && (includedEdu.length > 0 || includedSkills.length > 0) && (
          <p style={{ fontSize: '7pt', color: '#bbb', marginTop: 10, fontFamily: 'sans-serif', fontStyle: 'italic' }}>
            Education and Skills are managed in the panel on the left.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, children, printMode }: { title: string; children: React.ReactNode; printMode: boolean }) {
  return (
    <div style={{ marginBottom: printMode ? 12 : 10 }}>
      <div style={{
        fontSize: printMode ? '10.5pt' : '9pt',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 2,
        fontFamily: "'Times New Roman', Georgia, serif",
      }}>
        {title}
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid #000', marginBottom: 6 }} />
      {children}
    </div>
  )
}
