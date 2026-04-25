import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { PortfolioSettings } from '@/types'
import { Footer } from '@/components/public/Footer'

interface OutletContext {
  settings: PortfolioSettings
}

export function ResumePage() {
  const { settings } = useOutletContext<OutletContext>()
  const resumeUrl = settings.resume_url

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

              {resumeUrl && (
                <Button asChild variant="outline" className="rounded-full">
                  <a href={resumeUrl} download target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </a>
                </Button>
              )}
            </div>

            {resumeUrl ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                <iframe
                  src={resumeUrl}
                  title="Resume - Prajwal Parajuli"
                  className="h-[85vh] w-full"
                  style={{ border: 'none' }}
                />
              </div>
            ) : (
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
