import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ExternalLink, Github } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Project } from '@/types'
import { getProjectNarrative } from '@/lib/publicPortfolio'

/** Clean up project titles that look like slugs (e.g. "My-Project-Name" → "My Project Name") */
function cleanTitle(title: string): string {
  if (title.includes('-') && !title.includes(' ') && title.split('-').length > 2) {
    return title.replace(/-/g, ' ')
  }
  return title
}

interface BentoGridProps {
  projects: Project[]
  isLoading?: boolean
}

/** Generate a gradient placeholder when no cover image is available */
function getPlaceholderGradient(index: number): string {
  const gradients = [
    'linear-gradient(135deg, hsla(var(--accent-hue), 60%, 25%, 0.8) 0%, hsla(calc(var(--accent-hue) + 40), 50%, 15%, 0.9) 100%)',
    'linear-gradient(135deg, hsla(calc(var(--accent-hue) + 60), 50%, 25%, 0.8) 0%, hsla(calc(var(--accent-hue) + 20), 40%, 15%, 0.9) 100%)',
    'linear-gradient(135deg, hsla(calc(var(--accent-hue) - 30), 50%, 25%, 0.8) 0%, hsla(var(--accent-hue), 40%, 15%, 0.9) 100%)',
    'linear-gradient(135deg, hsla(calc(var(--accent-hue) + 90), 50%, 25%, 0.8) 0%, hsla(calc(var(--accent-hue) + 50), 40%, 15%, 0.9) 100%)',
  ]
  return gradients[index % gradients.length]
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const narrative = getProjectNarrative(project)

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group overflow-hidden rounded-3xl border border-white/10 bg-black/20 transition-all hover:border-white/20 hover:bg-black/30"
    >
      {/* Cover image / gradient banner */}
      <Link to={`/projects/${project.slug}`} className="block">
        <div className="relative h-48 overflow-hidden">
          {project.cover_image ? (
            <img
              src={project.cover_image}
              alt={project.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div
              className="h-full w-full transition-transform duration-500 group-hover:scale-105"
              style={{ background: getPlaceholderGradient(index) }}
            />
          )}
          {/* Subtle overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>
      </Link>

      {/* Content */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold text-foreground">{cleanTitle(project.title)}</h3>
          </div>
          <ArrowUpRight className="mt-1 h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>

        <p className="mt-3 text-base leading-7 text-foreground/90 line-clamp-3">{narrative.hook}</p>

        {project.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {project.tags.slice(0, 5).map((tag) => (
              <Badge key={tag} variant="outline" className="border-white/10 bg-white/5">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button asChild className="rounded-full">
            <Link to={`/projects/${project.slug}`}>View project</Link>
          </Button>

          {project.demo_url && (
            <Button asChild variant="outline" className="rounded-full">
              <a href={project.demo_url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Live demo
              </a>
            </Button>
          )}

          {project.github_url && (
            <Button asChild variant="ghost" className="rounded-full">
              <a href={project.github_url} target="_blank" rel="noreferrer">
                <Github className="mr-2 h-4 w-4" />
                Code
              </a>
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  )
}

function ProjectCardSkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-3xl border border-white/10 bg-black/20 overflow-hidden"
    >
      <div className="h-48 bg-white/5 animate-pulse" />
      <div className="p-6">
        <div className="h-8 w-2/3 rounded bg-white/10" />
        <div className="mt-4 h-5 w-full rounded bg-white/10" />
        <div className="mt-2 h-5 w-5/6 rounded bg-white/10" />
        <div className="mt-6 flex gap-2">
          <div className="h-6 w-16 rounded-full bg-white/10" />
          <div className="h-6 w-20 rounded-full bg-white/10" />
          <div className="h-6 w-14 rounded-full bg-white/10" />
        </div>
      </div>
    </motion.div>
  )
}

export function BentoGrid({ projects, isLoading = false }: BentoGridProps) {
  const featuredProjects = projects.slice(0, 6)
  const hasMore = projects.length > 6

  return (
    <section id="work" className="px-4 py-24 sm:px-6 lg:px-8">
      <div id="projects" className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12 max-w-3xl"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Selected Work
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Projects that show how I think, build, and ship.
          </h2>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-2">
          {isLoading ? (
            <>
              <ProjectCardSkeleton index={0} />
              <ProjectCardSkeleton index={1} />
              <ProjectCardSkeleton index={2} />
              <ProjectCardSkeleton index={3} />
            </>
          ) : (
            featuredProjects.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} />
            ))
          )}
        </div>

        {!isLoading && featuredProjects.length === 0 && (
          <p className="rounded-3xl border border-white/10 bg-black/20 p-6 text-muted-foreground">
            No published projects are available yet.
          </p>
        )}

        {!isLoading && hasMore && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-10 text-center"
          >
            <a
              href="#projects"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              View all {projects.length} projects
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </motion.div>
        )}
      </div>
    </section>
  )
}
