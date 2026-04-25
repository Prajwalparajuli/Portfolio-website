import { useEffect, useState } from 'react'
import { useOutletContext, useLocation } from 'react-router-dom'
import { HeroSection } from '@/components/public/HeroSection'
import { BentoGrid } from '@/components/public/BentoGrid'
import { ContactSection } from '@/components/public/ContactSection'
import { EducationSection } from '@/components/public/EducationSection'
import { Footer } from '@/components/public/Footer'
import { PortfolioSettings } from '@/types'
import { getProjects } from '@/lib/supabase'
import { Project } from '@/types'

interface OutletContext {
  settings: PortfolioSettings
}

export function HomePage() {
  const { settings } = useOutletContext<OutletContext>()
  const location = useLocation()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    getProjects()
      .then((projectsData) => setProjects(projectsData))
      .catch(() => {
        setProjects([])
      })
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (location.hash) {
      const targetId = location.hash.replace('#', '')
      const el = document.getElementById(targetId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [location.hash])

  return (
    <div>
      <HeroSection settings={settings} projectCount={projects.length} projects={projects} />
      <BentoGrid projects={projects} isLoading={isLoading} />
      <EducationSection settings={settings} />
      <ContactSection settings={settings} />
      <Footer settings={settings} />
    </div>
  )
}
