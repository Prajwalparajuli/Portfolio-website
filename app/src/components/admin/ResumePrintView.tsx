/**
 * Full-page print view route for the resume.
 * Opened in a new window from the Resume Editor.
 * Uses the same React renderer as the live preview for parity.
 */
import { useEffect, useState } from 'react'
import { getSettings, getAllProjects, getSkills, getResumeContent } from '@/lib/supabase'
import { loadResumePrintDraft } from '@/lib/resumePrint'
import { PortfolioSettings, Project, Skill } from '@/types'
import { normalizeResumeContent, ResumeContent } from '@/types/resume'
import { ResumePreview } from './ResumePreview'

export function ResumePrintView() {
  const [data, setData] = useState<{
    resume: ResumeContent
    settings: PortfolioSettings
    projects: Project[]
    skills: Skill[]
  } | null>(null)

  useEffect(() => {
    const draft = loadResumePrintDraft()
    if (draft) {
      setData({
        ...draft,
        resume: normalizeResumeContent(draft.resume, {
          name: draft.resume.header.name,
          contactLine: draft.resume.header.contactLine,
          educationCount: draft.settings.education.length,
        }),
      })
      return
    }

    Promise.all([getSettings(), getAllProjects(), getSkills(), getResumeContent()]).then(
      ([settings, projects, skills, resume]) => {
        if (!resume) return
        setData({
          resume: normalizeResumeContent(resume, {
            name: resume.header.name,
            contactLine: resume.header.contactLine,
            educationCount: settings.education.length,
          }),
          settings,
          projects,
          skills,
        })
      }
    )
  }, [])

  useEffect(() => {
    if (!data) return
    const timer = window.setTimeout(() => window.print(), 250)
    return () => window.clearTimeout(timer)
  }, [data])

  if (!data) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'sans-serif',
        }}
      >
        Loading...
      </div>
    )
  }

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          @page { size: letter; margin: 0; }
        }
        html, body {
          background: #fff;
          margin: 0;
          padding: 0;
        }
      `}</style>
      <ResumePreview
        resume={data.resume}
        settings={data.settings}
        projects={data.projects}
        skills={data.skills}
      />
    </>
  )
}
