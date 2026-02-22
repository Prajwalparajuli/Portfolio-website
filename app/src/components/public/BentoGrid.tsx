import { useState, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Project, Skill } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Github, ExternalLink, Search, BarChart3, Clock } from 'lucide-react'
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
}

function ProjectCard({ project, index }: ProjectCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const midX = rect.width / 2
    const midY = rect.height / 2
    const rotateY = ((x - midX) / midX) * 8
    const rotateX = ((midY - y) / midY) * 8
    setTilt({ rotateX, rotateY })
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setTilt({ rotateX: 0, rotateY: 0 })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-40px', amount: 0.2 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="relative group col-span-1 row-span-1"
      style={{ perspective: '800px' }}
    >
      <Link to={`/projects/${project.slug}`}>
        {/* Animated gradient border wrapper */}
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={handleMouseLeave}
          className="relative h-full rounded-2xl p-[1px] cursor-pointer transition-[transform] duration-200 ease-out"
          style={{
            transform: isHovered
              ? `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`
              : 'rotateX(0deg) rotateY(0deg)',
            transformStyle: 'preserve-3d',
            background: isHovered
              ? 'conic-gradient(from var(--angle), rgba(255,255,255,0.18), rgba(255,255,255,0.05), rgba(255,255,255,0.18))'
              : 'rgba(255,255,255,0.1)',
            animation: isHovered ? 'border-rotate 4s linear infinite' : 'none',
          }}
        >
          <div className="relative h-full rounded-2xl overflow-hidden bg-black/40 backdrop-blur-md">
            {project.cover_image && (
              <div className="relative overflow-hidden h-36">
                <img
                  src={project.cover_image}
                  alt={project.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              </div>
            )}

            <div className={cn(
              'p-5',
              !project.cover_image && 'h-full flex flex-col justify-center'
            )}>
              <h3 className="font-semibold text-lg mb-2 group-hover:text-white transition-colors">
                {project.title}
              </h3>

              <p
                className="text-sm text-muted-foreground mb-3 line-clamp-2"
                dangerouslySetInnerHTML={{
                  __html: project.description.replace(/<[^>]*>/g, '').slice(0, 100) + '...'
                }}
              />

              <div className="flex flex-wrap gap-2 mb-3">
                {project.tags.slice(0, 3).map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-xs bg-white/5 font-mono"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                  <Clock className="h-3.5 w-3.5" />
                  {getReadTimeLabel(project.description)}
                </span>
                {project.github_url && (
                  <a
                    href={project.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
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
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function SkillPill({ skill }: { skill: Skill }) {
  return (
    <div
      className="glass rounded-full px-4 py-2 flex items-center gap-2 shrink-0 whitespace-nowrap"
      style={{ boxShadow: `0 0 16px ${skill.color}22, 0 0 4px ${skill.color}11` }}
    >
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: skill.color }}
      />
      <span className="font-mono text-sm font-medium">{skill.name}</span>
    </div>
  )
}

function SkillMarquee({ skills, direction }: { skills: Skill[]; direction: 'left' | 'right' }) {
  if (skills.length === 0) return null
  const doubled = [...skills, ...skills]
  return (
    <div className="overflow-hidden relative">
      <div
        className={cn(
          'flex gap-3 w-max marquee-track',
          direction === 'left' ? 'animate-marquee-left' : 'animate-marquee-right'
        )}
      >
        {doubled.map((skill, i) => (
          <SkillPill key={`${skill.id}-${i}`} skill={skill} />
        ))}
      </div>
    </div>
  )
}

function ProjectCardSkeleton({ index }: { index: number }) {
  return (
    <div
      className="col-span-1 row-span-1 rounded-2xl overflow-hidden glass animate-pulse"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="h-36 bg-white/10" />
      <div className="p-5 space-y-3">
        <div className="h-5 w-3/4 rounded bg-white/10" />
        <div className="h-4 w-full rounded bg-white/10" />
        <div className="h-4 w-2/3 rounded bg-white/10" />
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full bg-white/10" />
          <div className="h-5 w-20 rounded-full bg-white/10" />
          <div className="h-5 w-14 rounded-full bg-white/10" />
        </div>
      </div>
    </div>
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
              <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <div className="h-4 w-16 rounded bg-white/20" />
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

  return (
    <section id="projects" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-16"
        >
          <h2 className="text-4xl font-bold tracking-tight gradient-text mb-2">Featured Projects</h2>
          <p className="text-muted-foreground">
            A selection of my recent work in data science and AI
          </p>
        </motion.div>

        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-black/40 border-white/10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={selectedTag === null ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer transition-colors',
                selectedTag === null ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'
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
                  'cursor-pointer transition-colors',
                  selectedTag === tag ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'
                )}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-[360px]">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <ProjectCardSkeleton key={i} index={i} />
              ))
            : filteredProjects.map((project, index) => (
                <ProjectCard key={project.id} project={project} index={index} />
              ))}
        </div>
        {!isLoading && filteredProjects.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No projects match your filters.</p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-24 mb-8 flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <h2 className="text-4xl font-bold tracking-tight gradient-text mb-2">Skills & Technologies</h2>
            <p className="text-muted-foreground">
              Tools and technologies I work with
            </p>
          </div>
          <Link
            to="/stats"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2 transition-colors"
          >
            <BarChart3 className="h-4 w-4" />
            Year in review
          </Link>
        </motion.div>

        {isLoading ? (
          <SkillMarqueeSkeleton />
        ) : (
          <div className="space-y-3">
            <SkillMarquee skills={skills.slice(0, Math.ceil(skills.length / 2))} direction="left" />
            <SkillMarquee skills={skills.slice(Math.ceil(skills.length / 2))} direction="right" />
          </div>
        )}
      </div>
    </section>
  )
}
