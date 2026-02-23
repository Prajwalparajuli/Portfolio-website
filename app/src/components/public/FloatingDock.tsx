import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PortfolioSettings } from '@/types'
import { Home, FolderKanban, FileText, Mail, Github, Linkedin, Twitter } from 'lucide-react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface FloatingDockProps {
  settings: PortfolioSettings
}

interface DockItemProps {
  icon: React.ElementType
  label: string
  href: string
  isExternal?: boolean
  isHashLink?: boolean
  isActive?: boolean
}

function DockItem({ icon: Icon, label, href, isExternal, isHashLink, isActive }: DockItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  const content = (
    <motion.div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.15, y: -4 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'relative flex flex-col items-center shrink-0 p-3 rounded-xl transition-colors duration-200',
        'glass hover:glass-strong',
        isActive && 'bg-accent/20 border-accent/30'
      )}
    >
      <Icon className={cn(
        'h-5 w-5 transition-colors duration-200',
        isActive ? 'text-accent' : 'text-foreground'
      )} />
      
      {/* Active indicator glow */}
      {isActive && (
        <motion.div
          layoutId="activeGlow"
          className="absolute inset-0 rounded-xl bg-accent/10"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
      
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 px-3 py-1.5 rounded-lg glass-strong text-xs whitespace-nowrap font-medium z-50 pointer-events-none"
          >
            {label}
            {/* Tooltip arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-white/10" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    )
  }

  if (isHashLink || href.includes('#')) {
    return <HashLink href={href} content={content} />
  }

  return <Link to={href}>{content}</Link>
}

function HashLink({ href, content }: { href: string; content: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    const hash = href.includes('#') ? href.split('#')[1] : ''
    if (location.pathname === '/' && hash) {
      const el = document.getElementById(hash)
      if (el) el.scrollIntoView({ behavior: 'smooth' })
      else window.location.href = href
    } else {
      navigate(href)
    }
  }

  return (
    <a href={href} onClick={handleClick}>
      {content}
    </a>
  )
}

export function FloatingDock({ settings }: FloatingDockProps) {
  const location = useLocation()
  const isHome = location.pathname === '/'

  const mainItems: DockItemProps[] = [
    { icon: Home, label: 'Home', href: '/', isActive: isHome },
    { icon: FolderKanban, label: 'Projects', href: '/#projects', isHashLink: true, isActive: isHome },
    { icon: FileText, label: 'Resume', href: settings.resume_url || '#', isExternal: !!settings.resume_url },
    { icon: Mail, label: 'Contact', href: `mailto:${settings.contact_email}` },
  ]

  const socialItems: DockItemProps[] = [
    ...(settings.github_url ? [{ icon: Github, label: 'GitHub', href: settings.github_url, isExternal: true }] : []),
    ...(settings.linkedin_url ? [{ icon: Linkedin, label: 'LinkedIn', href: settings.linkedin_url, isExternal: true }] : []),
    ...(settings.twitter_url ? [{ icon: Twitter, label: 'Twitter', href: settings.twitter_url, isExternal: true }] : []),
  ]

  return (
    <motion.div
      data-dock
      initial={{ opacity: 0, y: 60, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.8, 
        delay: 0.6,
        ease: [0.34, 1.56, 0.64, 1] // bounce effect
      }}
      className="pointer-events-auto"
    >
      <div className="flex items-center gap-2 p-2.5 rounded-2xl glass-strong">
        <div className="flex items-center gap-2">
          {mainItems.map((item) => (
            <DockItem key={item.label} {...item} />
          ))}
        </div>

        {socialItems.length > 0 && (
          <div className="w-px h-6 bg-border/50 mx-1" />
        )}

        <div className="flex items-center gap-2">
          {socialItems.map((item) => (
            <DockItem key={item.label} {...item} />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
