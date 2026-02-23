import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AnimatedBackground } from '@/components/public/AnimatedBackground'
import { FloatingDock } from '@/components/public/FloatingDock'
import { BackToTop } from '@/components/public/BackToTop'
import { KonamiEgg } from '@/components/public/KonamiEgg'
import { ScrollProgress } from '@/components/public/ScrollProgress'
import { CustomCursor } from '@/components/public/CustomCursor'
import { useEffect, useState } from 'react'
import { PortfolioSettings } from '@/types'
import { getSettings } from '@/lib/supabase'
import { prefersReducedMotion } from '@/lib/animations'

const contactEmailDefault =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_CONTACT_EMAIL?.trim() ||
  'your.email@example.com'

const DEFAULT_SETTINGS: PortfolioSettings = {
  bio: 'Data Scientist and AI Engineer passionate about building intelligent systems that solve real-world problems.',
  contact_email: contactEmailDefault,
  resume_url: '',
  linkedin_url: '',
  github_url: '',
  twitter_url: '',
  site_title: 'AI Portfolio',
  site_description: 'Portfolio of a Data Scientist & AI Engineer',
  now_line: '',
  location: '',
  education: [],
}

export function PublicLayout() {
  const [settings, setSettings] = useState<PortfolioSettings>(DEFAULT_SETTINGS)
  const [reducedMotion, setReducedMotion] = useState(false)
  const location = useLocation()

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_SETTINGS))
    
    // Check for reduced motion preference
    setReducedMotion(prefersReducedMotion())
    
    // Listen for changes
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = () => setReducedMotion(prefersReducedMotion())
    mediaQuery.addEventListener('change', handleChange)
    
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Handle skip to content
  const handleSkipToContent = (e: React.MouseEvent) => {
    e.preventDefault()
    const main = document.getElementById('main-content')
    if (main) {
      main.focus()
      main.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="min-h-screen relative cursor-none">
      {/* Skip to content link - accessibility */}
      <a
        href="#main-content"
        onClick={handleSkipToContent}
        className="fixed top-4 left-4 z-[100] p-3 rounded-xl glass-strong text-sm font-medium
                   translate-y-[-200%] focus:translate-y-0 transition-transform duration-200
                   focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
      >
        Skip to content
      </a>

      <AnimatedBackground />
      <ScrollProgress />
      <CustomCursor />

      <div className="relative z-10 min-h-screen flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ 
              duration: reducedMotion ? 0.1 : 0.4, 
              ease: [0.22, 1, 0.36, 1] 
            }}
            className="flex-1"
          >
            <main 
              id="main-content" 
              tabIndex={-1}
              className="outline-none"
            >
              <Outlet context={{ settings }} />
            </main>
          </motion.div>
        </AnimatePresence>
        
        <div className="no-print fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <FloatingDock settings={settings} />
        </div>
      </div>
      
      <BackToTop />
      <KonamiEgg />
    </div>
  )
}
