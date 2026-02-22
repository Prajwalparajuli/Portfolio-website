import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getProjects, getSkills } from '@/lib/supabase'
import { FolderKanban, Tags, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function StatsPage() {
  const [projectsCount, setProjectsCount] = useState(0)
  const [skillsCount, setSkillsCount] = useState(0)

  useEffect(() => {
    Promise.all([getProjects(), getSkills()]).then(([projects, skills]) => {
      setProjectsCount(projects.length)
      setSkillsCount(skills.length)
    })
  }, [])

  const year = new Date().getFullYear()

  return (
    <div className="min-h-screen py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Link to="/">
            <Button variant="ghost" className="glass mb-8">
              ← Back home
            </Button>
          </Link>

          <h1 className="text-4xl font-bold gradient-text-accent mb-2">
            {year} in review
          </h1>
          <p className="text-muted-foreground mb-12">
            By the numbers
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-6"
            >
              <FolderKanban className="h-10 w-10 text-muted-foreground mb-4" />
              <div className="text-3xl font-bold text-foreground">{projectsCount}</div>
              <div className="text-sm text-muted-foreground">Projects shipped</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-6"
            >
              <Tags className="h-10 w-10 text-muted-foreground mb-4" />
              <div className="text-3xl font-bold text-foreground">{skillsCount}</div>
              <div className="text-sm text-muted-foreground">Skills & technologies</div>
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 text-sm text-muted-foreground flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Portfolio built with React, TypeScript, Supabase & Tailwind.
          </motion.p>
        </motion.div>
      </div>
    </div>
  )
}
