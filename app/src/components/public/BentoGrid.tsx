import { useState, useRef, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Project, Skill } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Github, ExternalLink, Search, BarChart3, Clock, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { getReadTimeLabel } from '@/lib/readTime'

interface BentoGridProps {
  projects: Project[]
  skills: Skill[]
  isLoading?: boolean
}

interface ProjectCardProps {
  project: Project
  index: number
  featured?: boolean
}

// Spotlight effect hook
function useSpotlight(ref: React.RefObject<HTMLElement>) {
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [isHovering, setIsHovering] = useState(false)

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPosition({ x, y })
  }, [ref])

  return { position, isHovering, handleMouseMove, setIsHovering }
}

function ProjectCard({ project, index, featured = false }: ProjectCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const { position, isHovering, handleMouseMove, setIsHovering } = useSpotlight(cardRef as React.RefObject<HTMLElement>)

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ 
        duration: 0.6, 
        delay: index * 0.08, 
        ease: [0.22, 1, 0.36, 1]
      }}
      className={cn(
        'group relative',
        // Mobile: always 1 column
        // Tablet (md): featured spans full width (2 cols), regular spans 1 col
        // Desktop (lg): featured spans 2 cols, regular spans 1 col (3 col grid)
        featured ? 'md:col-span-2' : ''
      )}
    >
      <Link to={`/projects/${project.slug}`} className="block h-full">
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className="project-card h-full flex flex-col overflow-hidden"
          style={{
            '--mouse-x': `${position.x}%`,
            '--mouse-y': `${position.y}%`,
          } as React.CSSProperties}
        >
          {/* Spotlight overlay */}
          <div 
            className={cn(
              'absolute inset-0 pointer-events-none transition-opacity duration-300 z-10',
              isHovering ? 'opacity-100' : 'opacity-0'
            )}
            style={{
              background: `radial-gradient(600px circle at ${position.x}% ${position.y}%, hsla(var(--accent-hue), 60%, 50%, 0.08), transparent 40%)`,
            }}
          />

          {/* Project image */}
          {project.cover_image ? (
            <div className={cn(
              'relative overflow-hidden shrink-0',
              featured ? 'h-48 md:h-64' : 'h-40 md:h-48'
            )}>
              <img
                src={project.cover_image}
                alt={project.title}
                className="project-image w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </div>
          ) : (
            <div className={cn(
              'shrink-0 flex items-center justify-center bg-gradient-to-br from-surface to-surface-elevated',
              featured ? 'h-48 md:h-64' : 'h-40 md:h-48'
            )}>
              <span className="text-4xl font-display font-bold text-muted-foreground/20">
                {project.title.charAt(0)}
              </span>
            </div>
          )}

          {/* Content */}
          <div className="p-5 flex flex-col flex-1">
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className={cn(
                  'font-semibold group-hover:text-white transition-colors leading-tight',
                  featured ? 'text-xl md:text-2xl' : 'text-lg'
                )}>
                  {project.title}
                </h3>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0 shrink-0" />
              </div>

              <p
                className={cn(
                  'text-muted-foreground mb-4',
                  featured ? 'text-base line-clamp-2 md:line-clamp-3' : 'text-sm line-clamp-2'
                )}
                dangerouslySetInnerHTML={{
                  __html: project.description.replace(/<[^>]*>/g, '').slice(0, featured ? 160 : 100) + '...'
                }}
              />
            </div>

            <div className="flex items-center justify-between mt-auto pt-2">
              <div className="flex flex-wrap gap-1.5">
                {project.tags.slice(0, featured ? 4 : 3).map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-xs bg-white/5 border-white/10 font-mono"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground/70 flex items-center gap-1 font-mono">
                  <Clock className="h-3 w-3" />
                  {getReadTimeLabel(project.description)}
                </span>
              </div>
            </div>

            {/* Hover action buttons */}
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-20">
              {project.github_url && (
                <a
                  href={project.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 rounded-lg glass hover:bg-white/10 transition-colors"
                >
                  <Github className="h-4 w-4" />
                </a>
              )}
              {project.demo_url && (
                <a
                  href={project.demo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 rounded-lg glass hover:bg-white/10 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function SkillPill({ skill, index }: { skill: Skill; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.02,
        ease: [0.22, 1, 0.36, 1]
      }}
      className="skill-pill group"
      style={{ boxShadow: `0 0 16px ${skill.color}18, 0 0 4px ${skill.color}10` }}
    >
      <div
        className="w-2 h-2 rounded-full shrink-0 transition-transform group-hover:scale-125"
        style={{ backgroundColor: skill.color }}
      />
      <span className="font-mono text-sm font-medium">{skill.name}</span>
    </motion.div>
  )
}

function SkillMarquee({ skills, direction }: { skills: Skill[]; direction: 'left' | 'right' }) {
  if (skills.length === 0) return null
  const doubled = [...skills, ...skills, ...skills]
  return (
    <div className="overflow-hidden relative">
      <div
        className={cn(
          'flex gap-3 w-max marquee-track',
          direction === 'left' ? 'animate-marquee-left' : 'animate-marquee-right'
        )}
      >
        {doubled.map((skill, i) => (
          <SkillPill key={`${skill.id}-${i}`} skill={skill} index={i % skills.length} />
        ))}
      </div>
      {/* Fade edges */}
      <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
      <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
    </div>
  )
}

function ProjectCardSkeleton({ index, featured = false }: { index: number; featured?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'rounded-2xl overflow-hidden glass animate-pulse flex flex-col',
        featured ? 'md:col-span-2 lg:col-span-2' : ''
      )}
    >
      <div className={cn(
        'bg-white/5 shrink-0',
        featured ? 'h-48 md:h-64' : 'h-40 md:h-48'
      )} />
      <div className="p-5 space-y-3 flex-1">
        <div className="h-5 w-3/4 rounded bg-white/5" />
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="h-4 w-2/3 rounded bg-white/5" />
        <div className="flex gap-2 pt-2">
          <div className="h-5 w-16 rounded-full bg-white/5" />
          <div className="h-5 w-20 rounded-full bg-white/5" />
          <div className="h-5 w-14 rounded-full bg-white/5" />
        </div>
      </div>
    </motion.div>
  )
}

function SkillMarqueeSkeleton() {
  return (
    <div className="overflow-hidden space-y-3">
      {[0, 1].map((row) => (
        <div key={row} className="flex gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="glass rounded-full px-4 py-2 flex items-center gap-2 shrink-0 animate-pulse"
              style={{ animationDelay: `${(row * 8 + i) * 30}ms` }}
            >
              <div className="w-2 h-2 rounded-full bg-white/10" />
              <div className="h-4 w-16 rounded bg-white/10" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function BentoGrid({ projects, skills, isLoading = false }: BentoGridProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const allTags = useMemo(
    () => [...new Set(projects.flatMap((p) => p.tags))].sort(),
    [projects]
  )

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchTag = !selectedTag || project.tags.includes(selectedTag)
      const plainDesc = project.description.replace(/<[^>]*>/g, '')
      const matchSearch =
        !searchQuery.trim() ||
        project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plainDesc.toLowerCase().includes(searchQuery.toLowerCase())
      return matchTag && matchSearch
    })
  }, [projects, selectedTag, searchQuery])

  // Alternating bento pattern: projects at indices 0, 2, 4... span 2 columns
  // Projects at indices 1, 3, 5... span 1 column
  const isFeatured = (index: number) => index % 2 === 0

  return (
    <section id="projects" className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-16"
        >
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight gradient-text mb-4">
            Featured Projects
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl">
            A selection of my recent work in data science, AI, and software engineering
          </p>
        </motion.div>

        {/* Filter controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 flex flex-col sm:flex-row gap-4"
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 py-3 rounded-xl bg-surface border-border/50 focus:border-accent/50 transition-colors"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={selectedTag === null ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer transition-all px-3 py-1.5',
                selectedTag === null 
                  ? 'bg-accent text-accent-foreground hover:opacity-90' 
                  : 'bg-surface border-border hover:bg-surface-elevated'
              )}
              onClick={() => setSelectedTag(null)}
            >
              All
            </Badge>
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTag === tag ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer transition-all px-3 py-1.5',
                  selectedTag === tag 
                    ? 'bg-accent text-accent-foreground hover:opacity-90' 
                    : 'bg-surface border-border hover:bg-surface-elevated'
                )}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </motion.div>

        {/* Bento Grid - Alternating pattern: 2-col, 1-col, 2-col, 1-col... */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 auto-rows-fr">
          {isLoading ? (
            <>
              <ProjectCardSkeleton index={0} featured />
              <ProjectCardSkeleton index={1} />
              <ProjectCardSkeleton index={2} featured />
              <ProjectCardSkeleton index={3} />
              <ProjectCardSkeleton index={4} featured />
              <ProjectCardSkeleton index={5} />
            </>
          ) : (
            filteredProjects.map((project, index) => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                index={index} 
                featured={isFeatured(index)} 
              />
            ))
          )}
        </div>

        {!isLoading && filteredProjects.length === 0 && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-muted-foreground py-16"
          >
            No projects match your search. Try adjusting your filters.
          </motion.p>
        )}

        {/* Skills section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mt-32 mb-10"
        >
          <div className="flex flex-wrap items-end justify-between gap-4 mb-12">
            <div>
              <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight gradient-text mb-3">
                Skills & Technologies
              </h2>
              <p className="text-muted-foreground">
                Tools and technologies I work with daily
              </p>
            </div>
            <Link
              to="/stats"
              className="group text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2 transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="relative">
                Year in review
                <span className="absolute bottom-0 left-0 w-0 h-px bg-foreground group-hover:w-full transition-all duration-300" />
              </span>
              <ArrowUpRight className="h-3 w-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </Link>
          </div>
        </motion.div>

        {isLoading ? (
          <SkillMarqueeSkeleton />
        ) : (
          <div className="space-y-4">
            <SkillMarquee skills={skills.slice(0, Math.ceil(skills.length / 2))} direction="left" />
            <SkillMarquee skills={skills.slice(Math.ceil(skills.length / 2))} direction="right" />
          </div>
        )}
      </div>
    </section>
  )
}
