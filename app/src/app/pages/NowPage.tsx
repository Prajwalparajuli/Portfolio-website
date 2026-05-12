import { useEffect, useState, useMemo } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, Rocket, BookOpen, Brain, Code2, Calendar, MapPin, Sparkles, Coffee } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/public/Footer'
import { PortfolioSettings, Project } from '@/types'
import { getProjects } from '@/lib/supabase'

interface OutletContext {
  settings: PortfolioSettings
}

/** A single "now" entry — what you're currently up to. */
interface NowEntry {
  icon: React.ReactNode
  category: string
  title: string
  description: string
  link?: string
  linkLabel?: string
  accent?: string
}

/**
 * Build the /now entries dynamically from settings + projects.
 * Edit these directly when your focus changes — no DB needed.
 */
function buildNowEntries(settings: PortfolioSettings, projects: Project[]): NowEntry[] {
  const entries: NowEntry[] = []

  // 1. Primary focus — derived from now_line or hardcoded
  const nowLine = settings.now_line?.trim()
  entries.push({
    icon: <Rocket className="h-5 w-5" />,
    category: 'Primary Focus',
    title: nowLine || 'Building intelligent systems that solve real problems',
    description:
      'Developing LifeOS — a neuro-adaptive, privacy-first productivity platform with burnout detection, cross-platform sync, and AI-driven daily planning. Full-stack TypeScript monorepo with React Native, Next.js, and Supabase.',
    link: undefined,
    linkLabel: undefined,
    accent: 'from-blue-500 to-cyan-400',
  })

  // 2. Research
  entries.push({
    icon: <Brain className="h-5 w-5" />,
    category: 'Research',
    title: 'ADHD Diagnostic Classification from fMRI Data',
    description:
      'Building a reproducible ML pipeline for the ADHD-200 dataset — comparing Random Forests, SVMs, and neural architectures across functional connectivity, fALFF, and combined feature representations. Focused on statistical rigor and honest reporting.',
    link: undefined,
    linkLabel: undefined,
    accent: 'from-violet-500 to-purple-400',
  })

  // 3. Career engine
  entries.push({
    icon: <Code2 className="h-5 w-5" />,
    category: 'Side Project',
    title: 'Career Cockpit — AI-Powered Job Search Engine',
    description:
      'An internal tool that auto-discovers job postings, scores them with semantic matching against my resume, generates ATS-tailored resumes, and tracks the full application lifecycle. Built with Supabase Edge Functions and Gemini.',
    link: '/resume',
    linkLabel: 'View my resume',
    accent: 'from-emerald-500 to-green-400',
  })

  // 4. Learning
  entries.push({
    icon: <BookOpen className="h-5 w-5" />,
    category: 'Currently Learning',
    title: 'Advanced MLOps & Production ML Systems',
    description:
      'Deep-diving into model serving patterns, feature stores, experiment tracking with MLflow, and CI/CD for ML pipelines. Also exploring RAG architectures and vector search for production applications.',
    accent: 'from-amber-500 to-orange-400',
  })

  // 5. Reading / exploration
  entries.push({
    icon: <Coffee className="h-5 w-5" />,
    category: 'On My Radar',
    title: 'What I\'m exploring next',
    description:
      'Interested in multimodal AI systems, knowledge graphs for personal data, and the intersection of neuroscience and adaptive interfaces. Always looking for research collaborations in computational psychiatry.',
    accent: 'from-rose-500 to-pink-400',
  })

  return entries
}

/** Format a date as "Month YYYY" */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** Relative time since last update */
function relativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}

const staggerChildren = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

export function NowPage() {
  const { settings } = useOutletContext<OutletContext>()
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .catch(() => setProjects([]))
  }, [])

  const entries = useMemo(() => buildNowEntries(settings, projects), [settings, projects])

  // Last updated — set to today or whenever you last edited this
  const lastUpdated = new Date()

  // Recently shipped projects (last 3 updated)
  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 4),
    [projects]
  )

  return (
    <div>
      <section className="relative overflow-hidden px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-emerald-400">Live</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Updated {relativeTime(lastUpdated)} · {formatDate(lastUpdated)}
              </span>
            </div>

            <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              What I'm Working On
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-muted-foreground leading-relaxed">
              A living snapshot of my current projects, research, and interests.
              Inspired by{' '}
              <a
                href="https://nownownow.com/about"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                the /now page movement
              </a>
              .
            </p>

            {settings.location && (
              <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-accent" />
                {settings.location}
              </div>
            )}
          </motion.div>

          {/* Now entries */}
          <motion.div
            variants={staggerChildren}
            initial="hidden"
            animate="visible"
            className="mt-12 space-y-6"
          >
            {entries.map((entry, i) => (
              <motion.div key={i} variants={fadeInUp}>
                <div className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition-all hover:border-white/15 hover:bg-white/[0.04]">
                  {/* Subtle gradient accent bar */}
                  <div
                    className={`absolute left-0 top-6 bottom-6 w-[3px] rounded-full bg-gradient-to-b ${entry.accent || 'from-accent to-accent/50'} opacity-60 group-hover:opacity-100 transition-opacity`}
                  />

                  <div className="pl-4">
                    <div className="flex items-center gap-2.5 mb-2">
                      <span className="text-muted-foreground group-hover:text-accent transition-colors">
                        {entry.icon}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                        {entry.category}
                      </span>
                    </div>

                    <h2 className="text-lg font-semibold text-foreground leading-snug font-display">
                      {entry.title}
                    </h2>

                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                      {entry.description}
                    </p>

                    {entry.link && (
                      <Link
                        to={entry.link}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                      >
                        {entry.linkLabel || 'Learn more'}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Recently shipped */}
          {recentProjects.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mt-16"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-5 w-5 text-accent" />
                  <h2 className="text-xl font-semibold text-foreground font-display">
                    Recently Shipped
                  </h2>
                </div>
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                  <Link to="/projects">
                    All projects
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.slug}`}
                    className="group flex items-start gap-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-all hover:border-white/15 hover:bg-white/[0.05]"
                  >
                    {project.cover_image ? (
                      <img
                        src={project.cover_image}
                        alt=""
                        className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-accent/15 flex-shrink-0 flex items-center justify-center">
                        <Code2 className="h-5 w-5 text-accent/50" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors leading-snug">
                        {project.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {project.tags.slice(0, 3).join(' · ')}
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-accent transition-colors flex-shrink-0 mt-0.5" />
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* CTA / availability */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mt-16 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-8 text-center"
          >
            <div className="flex justify-center mb-4">
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-medium text-emerald-400">Open to opportunities</span>
              </div>
            </div>
            <h2 className="text-2xl font-semibold text-foreground font-display">
              Let's build something together
            </h2>
            <p className="mt-2 text-muted-foreground max-w-lg mx-auto">
              I'm currently open to full-time Data Science, ML Engineering, and AI roles.
              If my work resonates, I'd love to hear from you.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="rounded-full">
                <a href={`mailto:${settings.contact_email}`}>
                  Get in touch
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/resume">
                  <Calendar className="mr-2 h-4 w-4" />
                  View resume
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer settings={settings} />
    </div>
  )
}
