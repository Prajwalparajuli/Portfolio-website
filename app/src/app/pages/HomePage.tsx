import { useEffect, useState } from 'react'
import { useOutletContext, useLocation } from 'react-router-dom'
import { HeroSection } from '@/components/public/HeroSection'
import { BentoGrid } from '@/components/public/BentoGrid'
import { ContactSection } from '@/components/public/ContactSection'
import { EducationSection } from '@/components/public/EducationSection'
import { Footer } from '@/components/public/Footer'
import { PortfolioSettings } from '@/types'
import { getProjects, getSkills } from '@/lib/supabase'
import { Project, Skill } from '@/types'

interface OutletContext {
  settings: PortfolioSettings
}

export function HomePage() {
  const { settings } = useOutletContext<OutletContext>()
  const location = useLocation()
  const [projects, setProjects] = useState<Project[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    Promise.all([getProjects(), getSkills()])
      .then(([projectsData, skillsData]) => {
        setProjects(projectsData)
        setSkills(skillsData)
      })
      .catch(() => {
        setProjects([])
        setSkills([])
      })
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (location.hash === '#projects') {
      const el = document.getElementById('projects')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }
  }, [location.hash])

  return (
    <div>
      <HeroSection settings={settings} />
      <BentoGrid projects={projects} skills={skills} isLoading={isLoading} />
      <EducationSection settings={settings} />
      <ContactSection settings={settings} />
      <Footer settings={settings} />
    </div>
  )
}
