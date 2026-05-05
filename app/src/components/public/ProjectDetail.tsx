import { useState } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import DOMPurify from 'dompurify'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Github,
  Lightbulb,
  Mail,
  Linkedin,
  Target,
  Wrench,
  Zap,
  CheckCircle,
  AlertTriangle,
  Info,
  Flame,
  ArrowRight,
  BarChart3,
  Play,
  Monitor,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Project, NarrativeMetric, NarrativeScreenshot, NarrativeCallout, NarrativePipelineStep } from '@/types'
import { getProjectNarrative } from '@/lib/publicPortfolio'
import { ChartsGrid } from './ProjectCharts'

interface ProjectDetailProps {
  project: Project
  contactEmail?: string
  hideBack?: boolean
}

/* ── Theme helpers ── */
function useTheme(project: Project) {
  const sn = project.structured_narrative
  const accent = sn?.theme?.accent || '#22d3ee'
  const accentAlt = sn?.theme?.accentAlt || accent
  const variant = sn?.theme?.variant || 'default'
  return { accent, accentAlt, variant }
}

/* ── Metrics cards row ── */
function MetricsRow({ metrics, accent }: { metrics: NarrativeMetric[]; accent: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {metrics.map((metric, i) => (
        <motion.div
          key={metric.label}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-sm"
          style={{ borderTopColor: `${accent}33`, borderTopWidth: 2 }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {metric.label}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {metric.value}
          </p>
          {metric.context && (
            <p className="mt-0.5 text-xs text-muted-foreground leading-tight">{metric.context}</p>
          )}
        </motion.div>
      ))}
    </div>
  )
}

/* ── Callout cards (unique findings) ── */
function CalloutCards({ callouts, accent }: { callouts: NarrativeCallout[]; accent: string }) {
  const iconMap = {
    success: <CheckCircle className="h-5 w-5" />,
    warning: <AlertTriangle className="h-5 w-5" />,
    info: <Info className="h-5 w-5" />,
    critical: <Flame className="h-5 w-5" />,
  }
  const bgMap = {
    success: 'bg-emerald-500/8 border-emerald-500/20',
    warning: 'bg-amber-500/8 border-amber-500/20',
    info: 'bg-blue-500/8 border-blue-500/20',
    critical: 'bg-red-500/8 border-red-500/20',
  }
  const colorMap = {
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    info: 'text-blue-400',
    critical: 'text-red-400',
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {callouts.map((c, i) => (
        <motion.div
          key={c.title}
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: i * 0.08 }}
          className={`rounded-xl border p-4 backdrop-blur-sm ${bgMap[c.type]}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className={colorMap[c.type]}>{iconMap[c.type]}</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {c.title}
            </span>
          </div>
          <p className="text-xl font-bold text-foreground" style={{ color: accent }}>
            {c.value}
          </p>
          <p className="mt-1 text-xs text-foreground/70 leading-5">{c.description}</p>
        </motion.div>
      ))}
    </div>
  )
}

/* ── Pipeline steps (visual flow) ── */
function PipelineFlow({ steps, accent }: { steps: NarrativePipelineStep[]; accent: string }) {
  return (
    <div className="relative">
      {steps.map((step, i) => (
        <motion.div
          key={step.label}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: i * 0.1 }}
          className="flex items-start gap-3 relative"
        >
          {/* Connector line */}
          <div className="flex flex-col items-center">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: `${accent}20`, color: accent, border: `1px solid ${accent}40` }}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className="w-px h-8 my-1" style={{ backgroundColor: `${accent}30` }} />
            )}
          </div>
          <div className="pb-4 min-w-0">
            <p className="text-sm font-semibold text-foreground">{step.label}</p>
            <p className="text-xs text-muted-foreground leading-5 mt-0.5">{step.detail}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

/* ── Screenshot carousel ── */
function ScreenshotCarousel({ screenshots }: { screenshots: NarrativeScreenshot[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const current = screenshots[activeIndex]
  if (!current) return null

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30">
        <img
          src={current.url}
          alt={current.caption}
          className="w-full object-contain"
          style={{ maxHeight: 360 }}
        />
        {screenshots.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActiveIndex((activeIndex - 1 + screenshots.length) % screenshots.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-1.5 backdrop-blur-sm transition-colors hover:bg-black/80"
              aria-label="Previous"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveIndex((activeIndex + 1) % screenshots.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-1.5 backdrop-blur-sm transition-colors hover:bg-black/80"
              aria-label="Next"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">{current.caption}</p>
      {screenshots.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {screenshots.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === activeIndex ? 'bg-accent' : 'bg-white/20 hover:bg-white/40'
              }`}
              aria-label={`View screenshot ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Architecture diagram ── */
function ArchitectureDiagram({ source }: { source: string }) {
  const isUrl = source.startsWith('http') || source.startsWith('/')
  if (isUrl) {
    return (
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
        <img src={source} alt="System architecture" className="w-full object-contain" />
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4">
      <pre className="text-[11px] leading-[1.6] text-foreground/80 whitespace-pre font-mono">
        {source}
      </pre>
    </div>
  )
}

/* ── Section heading (themed) ── */
function SectionHeading({ icon, label, accent }: { icon: React.ReactNode; label: string; accent?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span
        className="flex h-6 w-6 items-center justify-center rounded-md"
        style={{
          backgroundColor: accent ? `${accent}15` : undefined,
          color: accent || undefined,
        }}
      >
        {icon}
      </span>
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </h2>
    </div>
  )
}

export function ProjectDetail({ project, contactEmail, hideBack }: ProjectDetailProps) {
  const narrative = getProjectNarrative(project)
  const sn = project.structured_narrative
  const { accent, accentAlt, variant } = useTheme(project)
  const timelineLabel = format(new Date(project.updated_at || project.created_at), 'MMMM yyyy')
  const safeDescription = DOMPurify.sanitize(project.description, {
    ALLOWED_TAGS: ['p', 'br', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'blockquote', 'hr', 'code'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })

  const metrics = sn?.metrics ?? []
  const screenshots = sn?.screenshots ?? []
  const architecture = sn?.architecture
  const techHighlights = sn?.techHighlights ?? []
  const charts = sn?.charts ?? []
  const callouts = sn?.callouts ?? []
  const pipelineSteps = sn?.pipelineSteps ?? []
  const demoVideo = sn?.demoVideo
  const embedUrl = sn?.embedUrl
  const demoUrl = sn?.demoUrl ?? project.demo_url
  const hasStructured = !!sn
  const [showEmbed, setShowEmbed] = useState(false)

  /* Dashboard variant: charts first, text minimal */
  const isDashboard = variant === 'dashboard'
  /* Research variant: findings callouts prominent, methodology focus */
  const isResearch = variant === 'research'
  /* Showcase variant: pipeline + demo emphasis */
  const isShowcase = variant === 'showcase'

  return (
    <article className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* ── Top bar: Back + Actions ── */}
        {!hideBack && (
          <div className="mb-6 flex items-center justify-between">
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link to="/#work">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              {project.github_url && (
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <a href={project.github_url} target="_blank" rel="noreferrer">
                    <Github className="mr-1.5 h-3.5 w-3.5" />
                    Code
                  </a>
                </Button>
              )}
              {demoUrl && (
                <Button asChild size="sm" className="rounded-full">
                  <a href={demoUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Live Demo
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Hero: Cover + Title side by side ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] as const }}
          className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center"
        >
          {project.cover_image && (
            <div
              className="overflow-hidden rounded-2xl border"
              style={{ borderColor: `${accent}25` }}
            >
              <img
                src={project.cover_image}
                alt={project.title}
                className="h-56 w-full object-cover sm:h-64 lg:h-72"
              />
            </div>
          )}

          <div className={project.cover_image ? '' : 'lg:col-span-2'}>
            <p className="text-xs text-muted-foreground">
              Prajwal Parajuli · {timelineLabel}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {project.title}
            </h1>
            {narrative.hook && narrative.hook !== project.title && (
              <p className="mt-3 text-base leading-7 text-foreground/80 lg:text-lg">
                {narrative.hook}
              </p>
            )}
            {project.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {project.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-xs"
                    style={{ borderColor: `${accent}30`, backgroundColor: `${accent}08` }}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Accent divider ── */}
        <div
          className="my-8 h-px"
          style={{ background: `linear-gradient(to right, ${accent}40, transparent)` }}
        />

        {/* ── Metrics cards ── */}
        {metrics.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35 }}
            className="mb-8"
          >
            <SectionHeading icon={<Zap className="h-3.5 w-3.5" />} label="Key Metrics" accent={accent} />
            <MetricsRow metrics={metrics} accent={accent} />
          </motion.section>
        )}

        {/* ── Callouts: prominent findings (research/dashboard variants) ── */}
        {callouts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35 }}
            className="mb-8"
          >
            <SectionHeading icon={<Flame className="h-3.5 w-3.5" />} label="Key Findings" accent={accent} />
            <CalloutCards callouts={callouts} accent={accent} />
          </motion.section>
        )}

        {/* ── Charts (full width, before narrative for dashboard variant) ── */}
        {charts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35 }}
            className="mb-8"
          >
            <SectionHeading icon={<BarChart3 className="h-3.5 w-3.5" />} label="Data Insights" accent={accent} />
            <ChartsGrid charts={charts} />
          </motion.section>
        )}

        {/* ── Pipeline steps (showcase variant) ── */}
        {pipelineSteps.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35 }}
            className="mb-8"
          >
            <SectionHeading icon={<ArrowRight className="h-3.5 w-3.5" />} label="Pipeline" accent={accent} />
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <PipelineFlow steps={pipelineSteps} accent={accent} />
            </div>
          </motion.section>
        )}

        {/* ── Demo video / embed ── */}
        {(demoVideo || embedUrl) && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-3">
              <SectionHeading icon={<Play className="h-3.5 w-3.5" />} label="Live Demo" accent={accent} />
              {demoVideo && embedUrl && (
                <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                  <button
                    type="button"
                    onClick={() => setShowEmbed(false)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
                      !showEmbed ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Play className="h-3 w-3" /> Recording
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmbed(true)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
                      showEmbed ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Monitor className="h-3 w-3" /> Interactive
                  </button>
                </div>
              )}
            </div>
            <div
              className="overflow-hidden rounded-xl border bg-black/30"
              style={{ borderColor: `${accent}20` }}
            >
              {(showEmbed && embedUrl) ? (
                <iframe
                  src={embedUrl}
                  title="Live demo"
                  className="w-full border-0"
                  style={{ height: 520 }}
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : demoVideo ? (
                <img
                  src={demoVideo}
                  alt="Demo walkthrough"
                  className="w-full object-contain"
                  style={{ maxHeight: 520 }}
                />
              ) : null}
            </div>
            {demoUrl && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                <a
                  href={demoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-white/20 hover:decoration-white/60 transition-colors"
                  style={{ color: accent }}
                >
                  Open full app in new tab →
                </a>
              </p>
            )}
          </motion.section>
        )}

        {/* ── Two-column body ── */}
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">

          {/* LEFT COLUMN */}
          <div className="space-y-8">
            {narrative.summary && (
              <section>
                <SectionHeading icon={<Target className="h-3.5 w-3.5" />} label="Overview" accent={accent} />
                <p className="text-sm leading-7 text-foreground/90">{narrative.summary}</p>
              </section>
            )}

            {sn?.problem && (
              <section>
                <SectionHeading icon={<Target className="h-3.5 w-3.5" />} label="The Problem" accent={accent} />
                <p className="text-sm leading-7 text-foreground/90">{sn.problem}</p>
              </section>
            )}

            {sn?.approach && (
              <section>
                <SectionHeading icon={<Wrench className="h-3.5 w-3.5" />} label="The Approach" accent={accent} />
                <p className="text-sm leading-7 text-foreground/90">{sn.approach}</p>
              </section>
            )}

            {narrative.outcomes.length > 0 && (
              <section>
                <SectionHeading icon={<Zap className="h-3.5 w-3.5" />} label="Key Results" accent={accent} />
                <ul className="space-y-1.5">
                  {narrative.outcomes.map((outcome) => (
                    <li key={outcome} className="flex items-start gap-2 text-sm leading-6 text-foreground/90">
                      <span
                        className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                      {outcome}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {sn?.learned && sn.learned.length > 0 && (
              <section>
                <SectionHeading icon={<Lightbulb className="h-3.5 w-3.5" />} label="What I Learned" accent={accent} />
                <ul className="space-y-1.5">
                  {sn.learned.map((lesson) => (
                    <li key={lesson} className="flex items-start gap-2 text-sm leading-6 text-foreground/90">
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-400/50" />
                      {lesson}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-8">
            {architecture && (
              <section>
                <SectionHeading icon={<Wrench className="h-3.5 w-3.5" />} label="Architecture" accent={accent} />
                <ArchitectureDiagram source={architecture} />
              </section>
            )}

            {screenshots.length > 0 && (
              <section>
                <SectionHeading icon={<ExternalLink className="h-3.5 w-3.5" />} label="In Action" accent={accent} />
                <ScreenshotCarousel screenshots={screenshots} />
              </section>
            )}

            {techHighlights.length > 0 && (
              <section>
                <SectionHeading icon={<Lightbulb className="h-3.5 w-3.5" />} label="Tech Decisions" accent={accent} />
                <div className="space-y-2">
                  {techHighlights.map((highlight) => (
                    <div
                      key={highlight}
                      className="rounded-lg border px-3.5 py-2.5"
                      style={{ borderColor: `${accent}15`, backgroundColor: `${accent}05` }}
                    >
                      <p className="text-sm leading-6 text-foreground/90">{highlight}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!hasStructured && safeDescription.trim() && (
              <section>
                <SectionHeading icon={<Wrench className="h-3.5 w-3.5" />} label="Project Details" accent={accent} />
                <div
                  className="project-prose mt-2 max-w-none"
                  dangerouslySetInnerHTML={{ __html: safeDescription }}
                />
              </section>
            )}
          </div>
        </div>

        {/* ── Divider ── */}
        <div
          className="my-8 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${accent}30, transparent)` }}
        />

        {/* ── Contact CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35 }}
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-black/20 px-6 py-5"
          style={{ borderColor: `${accent}20` }}
        >
          <div>
            <p className="text-base font-medium text-foreground">
              Interested in discussing this work?
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              I can walk through the tradeoffs, execution choices, and what I would improve next.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {contactEmail && (
              <Button asChild size="sm" className="rounded-full">
                <a href={`mailto:${contactEmail}`}>
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  Email me
                </a>
              </Button>
            )}
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <a href="https://www.linkedin.com/in/prajwal-parajuli" target="_blank" rel="noreferrer">
                <Linkedin className="mr-1.5 h-3.5 w-3.5" />
                LinkedIn
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </article>
  )
}
