import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FolderKanban, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getProjects, getSkills } from '@/lib/supabase'

export function StatsPage() {
  const [projectsCount, setProjectsCount] = useState(0)
  const [skillsCount, setSkillsCount] = useState(0)

  useEffect(() => {
    Promise.all([getProjects(), getSkills()]).then(([projects, skills]) => {
      setProjectsCount(projects.length)
      setSkillsCount(skills.length)
    })
  }, [])

  return (
    <div className="min-h-screen px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Button asChild variant="ghost" className="mb-8 rounded-full">
            <Link to="/#work">Back to selected work</Link>
          </Button>

          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Reference Page
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Portfolio snapshot
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            This route stays live for reference, but the primary recruiter path is the homepage and project case studies.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <FolderKanban className="h-10 w-10 text-muted-foreground" />
              <div className="mt-4 text-3xl font-semibold text-foreground">{projectsCount}</div>
              <div className="mt-2 text-sm text-muted-foreground">Published projects</div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <Tags className="h-10 w-10 text-muted-foreground" />
              <div className="mt-4 text-3xl font-semibold text-foreground">{skillsCount}</div>
              <div className="mt-2 text-sm text-muted-foreground">Tracked skills</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
