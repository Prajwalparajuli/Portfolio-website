import { motion } from 'framer-motion'
import { FileDown, Github, Linkedin, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { PortfolioSettings } from '@/types'

interface ContactSectionProps {
  settings: PortfolioSettings
}

export function ContactSection({ settings }: ContactSectionProps) {
  const linkedinUrl = settings.linkedin_url || 'https://www.linkedin.com/in/prajwal-parajuli'
  const githubUrl = settings.github_url || 'https://github.com/Prajwalparajuli'

  return (
    <section id="contact" className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[2rem] border border-white/10 bg-black/20 p-8 sm:p-10"
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Let's connect.
              </h2>
              <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                Whether it's a role, a collaboration, or just a conversation about ML
                and data — I'd love to hear from you. Email works best.
              </p>

              {(settings.now_line || settings.location) && (
                <p className="mt-3 text-sm text-muted-foreground/70">
                  {[settings.now_line?.trim(), settings.location?.trim()].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-full">
                <a href={`mailto:${settings.contact_email}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email me
                </a>
              </Button>

              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/resume">
                  <FileDown className="mr-2 h-4 w-4" />
                  Resume
                </Link>
              </Button>

              <Button asChild variant="ghost" size="lg" className="rounded-full">
                <a href={linkedinUrl} target="_blank" rel="noreferrer">
                  <Linkedin className="mr-2 h-4 w-4" />
                  LinkedIn
                </a>
              </Button>

              <Button asChild variant="ghost" size="lg" className="rounded-full">
                <a href={githubUrl} target="_blank" rel="noreferrer">
                  <Github className="mr-2 h-4 w-4" />
                  GitHub
                </a>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
