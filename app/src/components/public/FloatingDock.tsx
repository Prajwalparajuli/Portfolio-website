import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PortfolioSettings } from '@/types'
import { Home, FolderKanban, FileText, Mail, Github, Linkedin, Twitter } from 'lucide-react'
import { Link, useNavigate, useLocation } from 'react-router-dom'

interface FloatingDockProps {
  settings: PortfolioSettings
}

interface DockItemProps {
  icon: React.ElementType
  label: string
  href: string
  isExternal?: boolean
  /** Use native anchor so hash links (e.g. /#projects) scroll correctly */
  isHashLink?: boolean
}

function DockItem({ icon: Icon, label, href, isExternal, isHashLink }: DockItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  const content = (
    <motion.div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.2 }}
      whileTap={{ scale: 0.95 }}
      className="relative flex flex-col items-center shrink-0"
    >
      <div className="p-3 rounded-xl transition-colors dock-item-inner backdrop-blur-md">
        <Icon className="h-5 w-5 text-foreground" />
      </div>
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 4, x: '-50%' }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 bottom-full mb-2 px-3 py-1.5 rounded-lg dock-tooltip border text-xs whitespace-nowrap shadow-lg z-50 pointer-events-none text-center"
          >
            {label}
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
  const mainItems: DockItemProps[] = [
    { icon: Home, label: 'Home', href: '/' },
    { icon: FolderKanban, label: 'Projects', href: '/#projects', isHashLink: true },
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
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.5 }}
      className="pointer-events-auto"
    >
      <div className="flex items-center gap-2 p-3 rounded-2xl glass-strong">
        <div className="flex items-center gap-2">
          {mainItems.map((item) => (
            <DockItem key={item.label} {...item} />
          ))}
        </div>

        {socialItems.length > 0 && (
          <div className="w-px h-8 dock-divider mx-2" />
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
