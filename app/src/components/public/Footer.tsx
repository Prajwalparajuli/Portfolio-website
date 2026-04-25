import { motion } from 'framer-motion'
import { Github, Linkedin, Mail } from 'lucide-react'
import { PortfolioSettings } from '@/types'

interface FooterProps {
  settings: PortfolioSettings
}

export function Footer({ settings }: FooterProps) {
  const year = new Date().getFullYear()
  const links = [
    { url: `mailto:${settings.contact_email}`, icon: Mail, label: 'Email' },
    { url: settings.linkedin_url || 'https://www.linkedin.com/in/prajwal-parajuli', icon: Linkedin, label: 'LinkedIn' },
    { url: settings.github_url || 'https://github.com/Prajwalparajuli', icon: Github, label: 'GitHub' },
  ].filter((s) => s.url)

  return (
    <footer className="border-t border-white/10 px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-sm text-muted-foreground">
          © {year} Prajwal Parajuli
        </p>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.url}
              target={link.url.startsWith('mailto:') ? undefined : '_blank'}
              rel="noreferrer"
              className="inline-flex items-center gap-2 hover:text-foreground transition-colors"
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </a>
          ))}
        </div>
      </motion.div>
    </footer>
  )
}
