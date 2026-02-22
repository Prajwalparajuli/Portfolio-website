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
  const location = useLocation()

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_SETTINGS))
  }, [])

  return (
    <div className="min-h-screen relative cursor-custom">
      <AnimatedBackground />
      <ScrollProgress />
      <CustomCursor />

      <div className="relative z-10 min-h-screen flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1"
          >
            <Outlet context={{ settings }} />
          </motion.div>
        </AnimatePresence>
        <div className="no-print fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-4 pt-2 pointer-events-none md:relative md:sticky md:bottom-0">
          <FloatingDock settings={settings} />
        </div>
      </div>
      <BackToTop />
      <KonamiEgg />
    </div>
  )
}
