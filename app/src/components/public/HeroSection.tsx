import { motion } from 'framer-motion'
import { PortfolioSettings, Project } from '@/types'
import { ArrowRight, FileDown, Mail, MapPin, User, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

interface HeroSectionProps {
  settings: PortfolioSettings
  projectCount: number
  projects?: Project[]
}

/** Base skills always shown even with zero projects */
const BASE_SKILLS = [
  'Python', 'PyTorch', 'Scikit-learn', 'SQL', 'Computer Vision', 'NLP',
  'Deep Learning', 'Data Pipelines', 'Recommendation Systems',
]

/** Merge base skills with project tags, deduped case-insensitively, base first */
function getHeroSkills(projects: Project[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  // Add base skills first
  for (const skill of BASE_SKILLS) {
    const key = skill.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      result.push(skill)
    }
  }

  // Add project tags that aren't already in the base
  for (const project of projects) {
    for (const tag of project.tags) {
      const normalized = tag.trim()
      const key = normalized.toLowerCase()
      if (normalized && !seen.has(key)) {
        seen.add(key)
        result.push(normalized)
      }
    }
  }

  return result
}

function cleanTitle(title: string): string {
  if (title.includes('-') && !title.includes(' ') && title.split('-').length > 2) {
    return title.replace(/-/g, ' ')
  }
  return title
}

export function HeroSection({ settings, projects = [] }: HeroSectionProps) {
  const statusParts = [
    settings.now_line?.trim() || 'Open to full-time Data & ML roles',
    settings.location?.trim() ? `Based in ${settings.location.trim()}` : '',
  ].filter(Boolean)

  // Sort by updated_at desc (latest first), take top 3
  const featuredProjects = [...projects]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3)

  const photoUrl = settings.photo_url

  // Dynamic skills: base set + project tags
  const heroSkills = getHeroSkills(projects)

  // Pull education from settings if available
  const topCredential = settings.education?.[0]

  return (
    <section className="relative overflow-hidden px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-7xl">
        {/* Top row: Photo + Identity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7"
        >
          <div className="relative flex-shrink-0">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={settings.site_title || 'Profile photo'}
                className="h-28 w-28 rounded-2xl border-2 border-white/10 object-cover shadow-2xl sm:h-32 sm:w-32"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-white/10 bg-white/[0.03] shadow-2xl sm:h-32 sm:w-32">
                <User className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}
            <div className="absolute -bottom-1.5 -right-1.5 flex items-center gap-1 rounded-full border border-background bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Available
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {settings.site_description?.split('—')[0]?.trim() || 'Data Scientist & AI Engineer'}
            </p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {settings.site_title || 'Prajwal Parajuli'}
            </h1>
            {statusParts.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {statusParts.map((part) => (
                  <span key={part} className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-accent" />
                    {part}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Main content row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start lg:gap-12"
        >
          {/* Left: Copy + Tech + CTAs */}
          <div>
            <p className="max-w-2xl text-lg leading-7 text-foreground/85 sm:text-xl sm:leading-8">
              I learn best by building. A new concept becomes a project, a project
              turns into a pipeline, and the good ones find their way to production
              — from ML research to recommendation engines and everything in between.
            </p>

            {/* CTAs */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-full">
                <a href="#work">
                  View my work
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>

              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/resume">
                  <FileDown className="mr-2 h-4 w-4" />
                  Resume
                </Link>
              </Button>

              <Button asChild size="lg" variant="ghost" className="rounded-full">
                <a href={`mailto:${settings.contact_email}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email me
                </a>
              </Button>
            </div>

            {/* Tech pills — dynamic from base + project tags */}
            <div className="mt-6 flex flex-wrap gap-2">
              {heroSkills.map((tech) => (
                <span
                  key={tech}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-muted-foreground"
                >
                  {tech}
                </span>
              ))}
            </div>

            {/* Education credential — adds weight */}
            {topCredential && (
              <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
                <GraduationCap className="h-4 w-4 text-accent/70" />
                <span>
                  {topCredential.title}
                  {topCredential.issuer ? ` — ${topCredential.issuer}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Right: Featured projects — aligned to top */}
          {featuredProjects.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Featured Work
              </p>
              {featuredProjects.map((project, i) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 + i * 0.08 }}
                >
                  <a
                    href="#work"
                    onClick={(e) => {
                      e.preventDefault()
                      const el = document.getElementById('work')
                      if (el) el.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-3 transition-all hover:border-white/15 hover:bg-white/[0.05]"
                  >
                    {project.cover_image ? (
                      <img
                        src={project.cover_image}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-accent/15 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors leading-snug">
                        {cleanTitle(project.title)}
                      </p>
                      {project.tags.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {project.tags.slice(0, 3).join(' · ')}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 flex-shrink-0" />
                  </a>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  )
}
