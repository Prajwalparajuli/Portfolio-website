import { useEffect, useState } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowUpRight, ExternalLink, Github, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/public/Footer'
import { getProjects } from '@/lib/supabase'
import { getProjectNarrative } from '@/lib/publicPortfolio'
import { PortfolioSettings, Project } from '@/types'

interface OutletContext {
  settings: PortfolioSettings
}

/** Clean up project titles that look like slugs */
function cleanTitle(title: string): string {
  if (title.includes('-') && !title.includes(' ') && title.split('-').length > 2) {
    return title.replace(/-/g, ' ')
  }
  return title
}

/** Collect all unique tags across projects for filtering */
function collectTags(projects: Project[]): string[] {
  const tagCount = new Map<string, number>()
  for (const project of projects) {
    for (const tag of project.tags) {
      const key = tag.trim().toLowerCase()
      if (key) tagCount.set(key, (tagCount.get(key) ?? 0) + 1)
    }
  }
  return [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
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

export function AllProjectsPage() {
  const { settings } = useOutletContext<OutletContext>()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setIsLoading(true)
    getProjects()
      .then((data) => setProjects(data))
      .catch(() => setProjects([]))
      .finally(() => setIsLoading(false))
  }, [])

  // Set SEO meta
  useEffect(() => {
    document.title = 'All Projects | Prajwal Parajuli'
    const setMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name'
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, name)
        document.head.appendChild(el)
      }
      el.content = content
    }
    setMeta('description', 'Browse all projects by Prajwal Parajuli — ML pipelines, data science, computer vision, and full-stack applications.')
    setMeta('og:title', 'All Projects | Prajwal Parajuli', true)
    setMeta('og:description', 'Browse all projects by Prajwal Parajuli', true)
  }, [])

  const allTags = collectTags(projects)

  const filteredProjects = projects.filter((project) => {
    if (activeTag && !project.tags.some((tag) => tag.toLowerCase() === activeTag)) {
      return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const narrative = getProjectNarrative(project)
      const searchable = [
        project.title,
        narrative.hook,
        narrative.summary,
        ...project.tags,
      ]
        .join(' ')
        .toLowerCase()
      if (!searchable.includes(q)) return false
    }
    return true
  })

  return (
    <div>
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-8 flex items-center justify-between gap-4">
              <Button asChild variant="ghost" className="rounded-full">
                <Link to="/#work">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to portfolio
                </Link>
              </Button>
            </div>

            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              All Projects
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Everything I've built.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-foreground/80">
              {projects.length} projects spanning machine learning, data science, computer vision,
              and full-stack engineering. Click any project for the full case study.
            </p>
          </motion.div>

          {/* Search + Filter bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 space-y-4"
          >
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-white/10 bg-black/20 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
              />
            </div>

            {/* Tag filters */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTag(null)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTag === null
                      ? 'border-accent/30 bg-accent/10 text-foreground'
                      : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All ({projects.length})
                </button>
                {allTags.slice(0, 12).map((tag) => {
                  const count = projects.filter((p) =>
                    p.tags.some((t) => t.toLowerCase() === tag)
                  ).length
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        activeTag === tag
                          ? 'border-accent/30 bg-accent/10 text-foreground'
                          : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tag} ({count})
                    </button>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* Projects grid */}
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
              <>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="rounded-3xl border border-white/10 bg-black/20 overflow-hidden"
                  >
                    <div className="h-40 bg-white/5 animate-pulse" />
                    <div className="p-5">
                      <div className="h-6 w-2/3 rounded bg-white/10" />
                      <div className="mt-3 h-4 w-full rounded bg-white/10" />
                      <div className="mt-2 h-4 w-5/6 rounded bg-white/10" />
                    </div>
                  </div>
                ))}
              </>
            ) : filteredProjects.length > 0 ? (
              filteredProjects.map((project, index) => (
                <AllProjectCard key={project.id} project={project} index={index} />
              ))
            ) : (
              <div className="col-span-full rounded-3xl border border-white/10 bg-black/20 p-8 text-center">
                <p className="text-muted-foreground">
                  {searchQuery || activeTag
                    ? 'No projects match your filters. Try a different search or tag.'
                    : 'No published projects are available yet.'}
                </p>
              </div>
            )}
          </div>

          {/* Result count */}
          {!isLoading && filteredProjects.length > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-8 text-center text-sm text-muted-foreground"
            >
              Showing {filteredProjects.length} of {projects.length} projects
            </motion.p>
          )}
        </div>
      </section>
      <Footer settings={settings} />
    </div>
  )
}

function AllProjectCard({ project, index }: { project: Project; index: number }) {
  const narrative = getProjectNarrative(project)

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="group overflow-hidden rounded-3xl border border-white/10 bg-black/20 transition-all hover:border-white/20 hover:bg-black/30"
    >
      {/* Cover image / gradient */}
      <Link to={`/projects/${project.slug}`} className="block">
        <div className="relative h-40 overflow-hidden">
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>
      </Link>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-foreground leading-snug">
            {cleanTitle(project.title)}
          </h3>
          <ArrowUpRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>

        <p className="mt-2 text-sm leading-6 text-foreground/80 line-clamp-2">
          {narrative.hook}
        </p>

        {project.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {project.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="border-white/10 bg-white/5 text-xs">
                {tag}
              </Badge>
            ))}
            {project.tags.length > 4 && (
              <span className="inline-flex items-center text-xs text-muted-foreground">
                +{project.tags.length - 4}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button asChild size="sm" className="rounded-full">
            <Link to={`/projects/${project.slug}`}>View details</Link>
          </Button>

          {project.demo_url && (
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <a href={project.demo_url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Demo
              </a>
            </Button>
          )}

          {project.github_url && (
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <a href={project.github_url} target="_blank" rel="noreferrer">
                <Github className="mr-1.5 h-3.5 w-3.5" />
                Code
              </a>
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  )
}
