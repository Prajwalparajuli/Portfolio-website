/**
 * Full-page print view route for the resume.
 * Opened in a new window from the Resume Editor.
 * Renders only the ATS preview with print-friendly CSS.
 */
import { useEffect, useState } from 'react'
import { getSettings, getAllProjects, getSkills, getResumeContent } from '@/lib/supabase'
import { PortfolioSettings, Project, Skill } from '@/types'
import { ResumeContent } from '@/types/resume'
import { ResumePreview } from './ResumePreview'

export function ResumePrintView() {
  const [data, setData] = useState<{
    resume: ResumeContent
    settings: PortfolioSettings
    projects: Project[]
    skills: Skill[]
  } | null>(null)

  useEffect(() => {
    Promise.all([getSettings(), getAllProjects(), getSkills(), getResumeContent()]).then(
      ([settings, projects, skills, resume]) => {
        if (resume) setData({ resume, settings, projects, skills })
      }
    )
  }, [])

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        Loading…
      </div>
    )
  }

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          @page { size: letter; margin: 0.6in 0.65in; }
        }
        body { background: #fff; margin: 0; padding: 0; }
      `}</style>
      <ResumePreview
        resume={data.resume}
        settings={data.settings}
        projects={data.projects}
        skills={data.skills}
        printMode
      />
    </>
  )
}
