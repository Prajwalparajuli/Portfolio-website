import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { PortfolioSettings, Project, Skill } from '@/types'
import { normalizeResumeContent, ResumeContent } from '@/types/resume'
import { getResumeContent, getAllProjects, getSkills, getSettings } from '@/lib/supabase'
import { ResumePreview } from '@/components/admin/ResumePreview'
import { saveResumePrintDraft } from '@/lib/resumePrint'
import { Footer } from '@/components/public/Footer'

interface OutletContext {
  settings: PortfolioSettings
}

export function ResumePage() {
  const { settings } = useOutletContext<OutletContext>()

  const [resumeData, setResumeData] = useState<{
    resume: ResumeContent
    settings: PortfolioSettings
    projects: Project[]
    skills: Skill[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load the master resume from the resume builder
  useEffect(() => {
    setIsLoading(true)

    Promise.all([getResumeContent(), getAllProjects(), getSkills(), getSettings()])
      .then(([resume, projects, skills, freshSettings]) => {
        if (resume && resume.header?.name) {
          setResumeData({
            resume: normalizeResumeContent(resume, {
              name: resume.header.name,
              contactLine: resume.header.contactLine,
              educationCount: freshSettings.education.length,
            }),
            settings: freshSettings,
            projects,
            skills,
          })
        }
      })
      .catch(() => {
        // Silently handle — will show empty state
      })
      .finally(() => setIsLoading(false))
  }, [])

  // SEO
  useEffect(() => {
    document.title = 'Resume | Prajwal Parajuli'
  }, [])

  const handlePrint = () => {
    if (!resumeData) return
    saveResumePrintDraft(resumeData)
    window.open('/admin/resume/print', '_blank')
  }

  return (
    <div>
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-6 flex items-center justify-between gap-4">
              <Button asChild variant="ghost" className="rounded-full">
                <Link to="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Link>
              </Button>

              {resumeData && (
                <Button variant="outline" className="rounded-full gap-2" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />
                  Print / Download PDF
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="flex h-[60vh] items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                <Loader2 className="h-8 w-8 animate-spin text-white/50" />
              </div>
            ) : resumeData ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
                <div className="mx-auto" style={{ maxWidth: '8.5in' }}>
                  <ResumePreview
                    resume={resumeData.resume}
                    settings={resumeData.settings}
                    projects={resumeData.projects}
                    skills={resumeData.skills}
                  />
                </div>
              </div>
            ) : (
              <div className="flex h-[60vh] items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                <div className="text-center">
                  <p className="text-lg font-medium text-foreground">Resume not set up yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Please contact me via email for a copy of my resume.
                  </p>
                  <Button asChild className="mt-4 rounded-full">
                    <a href={`mailto:${settings.contact_email}`}>Email me</a>
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>
      <Footer settings={settings} />
    </div>
  )
}
