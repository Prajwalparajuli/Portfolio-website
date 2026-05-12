import { Mail, FileDown, Linkedin, BriefcaseBusiness, Sparkles } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PortfolioSettings } from '@/types'

interface PublicHeaderProps {
  settings: PortfolioSettings
}

export function PublicHeader({ settings }: PublicHeaderProps) {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const workHref = isHome ? '#work' : '/#work'
  const linkedinUrl = settings.linkedin_url || 'https://www.linkedin.com/in/prajwal-parajuli'

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="min-w-0 flex items-center gap-3">
          <p className="truncate text-base font-semibold text-foreground">
            Prajwal Parajuli
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Open to work
          </span>
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild variant="ghost" size="sm">
            <a href={workHref}>
              <BriefcaseBusiness className="mr-2 h-4 w-4" />
              Work
            </a>
          </Button>

          <Button asChild variant="ghost" size="sm">
            <Link to="/now">
              <Sparkles className="mr-2 h-4 w-4" />
              Now
            </Link>
          </Button>

          <Button asChild variant="ghost" size="sm">
            <Link to="/resume">
              <FileDown className="mr-2 h-4 w-4" />
              Resume
            </Link>
          </Button>

          <Button asChild variant="ghost" size="sm">
            <a href={linkedinUrl} target="_blank" rel="noreferrer">
              <Linkedin className="mr-2 h-4 w-4" />
              LinkedIn
            </a>
          </Button>

          <Button asChild size="sm" className="rounded-full">
            <a href={`mailto:${settings.contact_email}`}>
              <Mail className="mr-2 h-4 w-4" />
              Email
            </a>
          </Button>
        </nav>
      </div>
    </header>
  )
}
