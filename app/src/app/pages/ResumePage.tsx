import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { PortfolioSettings, Project, Skill } from '@/types'
import { normalizeResumeContent, ResumeContent } from '@/types/resume'
import { getResumeContent, getAllProjects, getSkills, getSettings } from '@/lib/supabase'
import { ResumePreview } from '@/components/admin/ResumePreview'
import { Footer } from '@/components/public/Footer'

interface OutletContext {
  settings: PortfolioSettings
}

export function ResumePage() {
  const { settings } = useOutletContext<OutletContext>()
  const legacyResumeUrl = settings.resume_url

  const [resumeData, setResumeData] = useState<{
    resume: ResumeContent
    settings: PortfolioSettings
    projects: Project[]
    skills: Skill[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [useBuilderView, setUseBuilderView] = useState(false)

  // Attempt to load the master resume from the resume builder
  useEffect(() => {
    setIsLoading(true)

    Promise.all([getResumeContent(), getAllProjects(), getSkills(), getSettings()])
      .then(([resume, projects, skills, freshSettings]) => {
        if (resume && resume.header?.name) {
          // We have a builder resume — use it
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
          setUseBuilderView(true)
        }
      })
      .catch(() => {
        // Fall back to legacy PDF
      })
      .finally(() => setIsLoading(false))
  }, [])

  // SEO
  useEffect(() => {
    document.title = 'Resume | Prajwal Parajuli'
  }, [])

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

              <div className="flex items-center gap-2">
                {/* Toggle between builder view and PDF view when both exist */}
                {useBuilderView && legacyResumeUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-muted-foreground"
                    onClick={() => setUseBuilderView(!useBuilderView)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {useBuilderView ? 'View PDF' : 'View formatted'}
                  </Button>
                )}

                {legacyResumeUrl && (
                  <Button asChild variant="outline" className="rounded-full">
                    <a href={legacyResumeUrl} download target="_blank" rel="noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="flex h-[60vh] items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                <Loader2 className="h-8 w-8 animate-spin text-white/50" />
              </div>
            ) : useBuilderView && resumeData ? (
              /* Render the master resume from the builder */
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
            ) : legacyResumeUrl ? (
              /* Fallback: show the uploaded PDF in an iframe */
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                <iframe
                  src={legacyResumeUrl}
                  title="Resume - Prajwal Parajuli"
                  className="h-[85vh] w-full"
                  style={{ border: 'none' }}
                />
              </div>
            ) : (
              /* No resume at all */
              <div className="flex h-[60vh] items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                <div className="text-center">
                  <p className="text-lg font-medium text-foreground">Resume not uploaded yet</p>
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
