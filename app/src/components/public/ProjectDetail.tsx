import { motion } from 'framer-motion'
import { Project } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Github, ExternalLink, Calendar, Terminal, Copy, Check, Clock } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { getReadTimeLabel } from '@/lib/readTime'

interface ProjectDetailProps {
  project: Project
  /** When true, hide the Back link (e.g. in-admin preview). */
  hideBack?: boolean
}

function gitCloneUrl(githubUrl: string): string {
  const match = githubUrl.match(/github\.com[/]([^/]+)[/]([^/]+?)(?:[/].*)?$/i)
  if (!match) return ''
  const [, owner, repo] = match
  const cleanRepo = repo?.replace(/\.git$/, '') ?? repo
  return `git clone https://github.com/${owner}/${cleanRepo}.git`
}

function gitpodUrl(githubUrl: string): string {
  return `https://gitpod.io/#${githubUrl}`
}

export function ProjectDetail({ project, hideBack }: ProjectDetailProps) {
  const [copied, setCopied] = useState(false)
  const cloneCmd = project.github_url ? gitCloneUrl(project.github_url) : ''
  const handleCopy = () => {
    if (!cloneCmd) return
    navigator.clipboard.writeText(cloneCmd).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <article className="min-h-screen pb-24">
      <header className="relative">
        {project.cover_image && (
          <div className="relative h-[50vh] lg:h-[60vh]">
            <img
              src={project.cover_image}
              alt={project.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent" />
          </div>
        )}

        {!hideBack && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute top-8 left-4 sm:left-8 z-10"
          >
            <Link to="/">
              <Button variant="ghost" className="glass hover:bg-white/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </motion.div>
        )}

        <div className={cn(
          "relative px-4 sm:px-8 lg:px-16",
          project.cover_image ? '-mt-32' : 'pt-24'
        )}>
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="flex flex-wrap gap-2 mb-4">
                {project.tags.map((tag) => (
                  <Badge 
                    key={tag} 
                    variant="outline"
                    className="bg-white/5 font-mono"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold gradient-text mb-4">
                {project.title}
              </h1>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4 flex-wrap font-mono">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(project.created_at), 'MMMM yyyy')}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {getReadTimeLabel(project.description)}
                </span>
              </div>

              {project.ask_me_about?.trim() && (
                <p className="text-sm text-muted-foreground italic mb-8 border-l-2 border-primary/50 pl-4">
                  {project.ask_me_about.trim()}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 mb-12">
                {project.github_url && (
                  <>
                    <a
                      href={project.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button className="gap-2">
                        <Github className="h-4 w-4" />
                        View Code
                      </Button>
                    </a>
                    <a
                      href={gitpodUrl(project.github_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" className="gap-2">
                        <Terminal className="h-4 w-4" />
                        Open in Gitpod
                      </Button>
                    </a>
                    {cloneCmd && (
                      <Button variant="outline" className="gap-2" onClick={handleCopy}>
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied!' : 'Copy clone'}
                      </Button>
                    )}
                  </>
                )}
                {project.demo_url && (
                  <a
                    href={project.demo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Live Demo
                    </Button>
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="px-4 sm:px-8 lg:px-16"
      >
        <div className="max-w-4xl mx-auto">
          <div 
            className="prose prose-invert prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: project.description }}
          />
        </div>
      </motion.div>
    </article>
  )
}
