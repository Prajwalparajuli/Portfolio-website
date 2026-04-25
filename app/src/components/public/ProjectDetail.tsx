import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { ArrowLeft, ExternalLink, Github, Mail, Linkedin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Project } from '@/types'
import { getProjectNarrative } from '@/lib/publicPortfolio'

interface ProjectDetailProps {
  project: Project
  contactEmail?: string
  hideBack?: boolean
}

export function ProjectDetail({ project, contactEmail, hideBack }: ProjectDetailProps) {
  const narrative = getProjectNarrative(project)
  const timelineLabel = format(new Date(project.updated_at || project.created_at), 'MMMM yyyy')
  const safeDescription = DOMPurify.sanitize(project.description, {
    ALLOWED_TAGS: ['p', 'br', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'blockquote', 'hr', 'code'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })

  return (
    <article className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Navigation bar */}
        {!hideBack && (
          <div className="mb-8 flex items-center justify-between">
            <Button asChild variant="ghost" className="rounded-full">
              <Link to="/#work">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to portfolio
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              {project.github_url && (
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <a href={project.github_url} target="_blank" rel="noreferrer">
                    <Github className="mr-2 h-4 w-4" />
                    View Code
                  </a>
                </Button>
              )}
              {project.demo_url && (
                <Button asChild size="sm" className="rounded-full">
                  <a href={project.demo_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Live Demo
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Full-width banner */}
        {project.cover_image && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mb-10 overflow-hidden rounded-2xl border border-white/10"
          >
            <img
              src={project.cover_image}
              alt={project.title}
              className="h-64 w-full object-cover sm:h-80"
            />
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-sm text-muted-foreground">
            Prajwal Parajuli · {timelineLabel}
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {project.title}
          </h1>

          {project.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="border-white/10 bg-white/5">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </motion.div>

        {/* Divider */}
        <div className="my-10 border-t border-white/10" />

        {/* Structured case study sections */}
        <div className="space-y-10">
          {/* Overview */}
          {narrative.summary && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Overview
              </h2>
              <p className="mt-3 text-base leading-7 text-foreground/90">
                {narrative.summary}
              </p>
            </motion.section>
          )}

          {/* Key Results */}
          {narrative.outcomes.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Key Results
              </h2>
              <ul className="mt-3 space-y-2">
                {narrative.outcomes.map((outcome) => (
                  <li key={outcome} className="flex items-start gap-3 text-base leading-7 text-foreground/90">
                    <span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                    {outcome}
                  </li>
                ))}
              </ul>
            </motion.section>
          )}

          {/* What I Built */}
          {narrative.buildDetails.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                What I Built
              </h2>
              <ul className="mt-3 space-y-2">
                {narrative.buildDetails.map((detail) => (
                  <li key={detail} className="flex items-start gap-3 text-base leading-7 text-foreground/90">
                    <span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white/30" />
                    {detail}
                  </li>
                ))}
              </ul>
            </motion.section>
          )}

          {/* Full Description (prose) */}
          {safeDescription.trim() && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Project Details
              </h2>
              <div
                className="project-prose mt-4 max-w-none"
                dangerouslySetInnerHTML={{ __html: safeDescription }}
              />
            </motion.section>
          )}
        </div>

        {/* Divider */}
        <div className="my-12 border-t border-white/10" />

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center"
        >
          <p className="text-lg font-medium text-foreground">
            Interested in discussing this work?
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            I can walk through the tradeoffs, execution choices, and what I would improve next.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {contactEmail && (
              <Button asChild className="rounded-full">
                <a href={`mailto:${contactEmail}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email me
                </a>
              </Button>
            )}
            <Button asChild variant="outline" className="rounded-full">
              <a href="https://www.linkedin.com/in/prajwal-parajuli" target="_blank" rel="noreferrer">
                <Linkedin className="mr-2 h-4 w-4" />
                LinkedIn
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </article>
  )
}
