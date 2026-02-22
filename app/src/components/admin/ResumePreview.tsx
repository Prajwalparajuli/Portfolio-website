/**
 * Live ATS-style preview of the resume.
 * Renders a single-column MIT-style layout in light mode (white background, serif font).
 * Used both as the side-by-side editor preview and as the print view base.
 */
import { ResumeContent, ResumeEducationSection, ResumeExperienceSection, ResumeSkillsSection, ResumeSummarySection, ProjectExperienceItem } from '@/types/resume'
import { PortfolioSettings, Project, Skill } from '@/types'

interface ResumePreviewProps {
  resume: ResumeContent
  settings: PortfolioSettings
  projects: Project[]
  skills: Skill[]
  /** When true, renders in print-optimised full-page mode (used by ResumePrintView) */
  printMode?: boolean
}

export function ResumePreview({ resume, settings, projects, skills, printMode = false }: ResumePreviewProps) {
  const eduSection = resume.sections.find(s => s.type === 'education') as ResumeEducationSection | undefined
  const expSection = resume.sections.find(s => s.type === 'experience') as ResumeExperienceSection | undefined
  const skillsSection = resume.sections.find(s => s.type === 'skills') as ResumeSkillsSection | undefined
  const summSection = resume.sections.find(s => s.type === 'summary') as ResumeSummarySection | undefined

  const includedSkills = skillsSection?.includedIds === 'all'
    ? skills
    : skills.filter(s => (skillsSection?.includedIds as string[] | undefined || []).includes(s.id))

  const includedEdu = eduSection?.includedIndices
    .map(i => settings.education[i])
    .filter(Boolean) ?? []

  const outerStyle: React.CSSProperties = printMode
    ? { width: '100%', minHeight: '100vh', background: '#fff', color: '#000' }
    : {
        width: '100%',
        minHeight: '800px',
        background: '#fff',
        color: '#000',
        fontSize: '10pt',
        transform: 'scale(1)',
        transformOrigin: 'top left',
      }

  const bodyStyle: React.CSSProperties = {
    fontFamily: "'Times New Roman', Georgia, serif",
    lineHeight: 1.4,
    padding: printMode ? '0.75in 0.75in' : '20px 22px',
    fontSize: printMode ? '11pt' : '9.5pt',
  }

  return (
    <div style={outerStyle} id="resume-preview-root">
      <div style={bodyStyle}>
        {/* Header */}
        <header style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: printMode ? '18pt' : '15pt', fontWeight: 'bold', letterSpacing: '0.02em' }}>
            {resume.header.name || 'Your Name'}
          </div>
          <div style={{ fontSize: printMode ? '9.5pt' : '8.5pt', color: '#444', marginTop: 3 }}>
            {resume.header.contactLine || 'email · location · linkedin · github'}
          </div>
        </header>

        {/* Summary */}
        {summSection?.enabled && summSection.text && (
          <Section title="SUMMARY" printMode={printMode}>
            <p style={{ fontSize: 'inherit' }}>{summSection.text}</p>
          </Section>
        )}

        {/* Experience */}
        {expSection?.enabled && expSection.items.length > 0 && (
          <Section title="EXPERIENCE" printMode={printMode}>
            {expSection.items.map((item, i) => {
              const title = item.kind === 'project'
                ? (item.titleOverride || projects.find(p => p.id === (item as ProjectExperienceItem).projectId)?.title || 'Project')
                : item.role
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  {/* Title + date on one line */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontWeight: 'bold', fontSize: 'inherit' }}>{title}</span>
                    <span style={{ fontSize: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.dateRange}</span>
                  </div>
                  {/* Org on second line, italic */}
                  {item.org && (
                    <div style={{ fontStyle: 'italic', color: '#333', fontSize: 'inherit', marginBottom: 2 }}>
                      {item.org}
                    </div>
                  )}
                  {item.bullets.filter(Boolean).length > 0 && (
                    <ul style={{ paddingLeft: '1.2em', marginTop: 3 }}>
                      {item.bullets.filter(Boolean).map((b, j) => (
                        <li key={j} style={{ marginBottom: 2, fontSize: 'inherit' }}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </Section>
        )}

        {/* Education */}
        {eduSection?.enabled && includedEdu.length > 0 && (
          <Section title="EDUCATION" printMode={printMode}>
            {includedEdu.map((entry, i) => (
              <div key={i} style={{ marginBottom: 7 }}>
                {/* Row 1: degree title (bold, left) + year (right) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontWeight: 'bold', fontSize: 'inherit' }}>{entry.title}</span>
                  <span style={{ fontSize: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>{entry.date}</span>
                </div>
                {/* Row 2: institution name (italic, left) */}
                <div style={{ fontStyle: 'italic', color: '#333', fontSize: 'inherit' }}>{entry.issuer}</div>
              </div>
            ))}
          </Section>
        )}

        {/* Skills */}
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
              : (
                <p style={{ fontSize: 'inherit' }}>{includedSkills.map(s => s.name).join(', ')}</p>
              )
            }
          </Section>
        )}
      </div>
    </div>
  )
}

interface SectionProps {
  title: string
  children: React.ReactNode
  printMode: boolean
}

function Section({ title, children, printMode }: SectionProps) {
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
