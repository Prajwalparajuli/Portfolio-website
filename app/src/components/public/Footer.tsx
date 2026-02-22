import { PortfolioSettings } from '@/types'
import { Printer, Github, Linkedin, Twitter } from 'lucide-react'

interface FooterProps {
  settings: PortfolioSettings
}

export function Footer({ settings }: FooterProps) {
  const handlePrint = () => window.print()

  const socials = [
    { url: settings.github_url, icon: Github, label: 'GitHub' },
    { url: settings.linkedin_url, icon: Linkedin, label: 'LinkedIn' },
    { url: settings.twitter_url, icon: Twitter, label: 'Twitter' },
  ].filter((s) => s.url)

  return (
    <footer className="relative pt-12 pb-8 px-4 sm:px-6 lg:px-8">
      {/* Gradient top border */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness)), transparent)`,
        }}
      />

      <div className="max-w-7xl mx-auto flex flex-col items-center gap-6">
        {/* Quote */}
        <p className="text-sm text-muted-foreground/60 italic text-center max-w-md">
          "The best way to predict the future is to invent it."
        </p>

        {/* Info row */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground/50 font-mono">
          {settings.location?.trim() && (
            <span>Based in {settings.location.trim()}</span>
          )}
          <span>Built with React, Tailwind & Supabase</span>
        </div>

        {/* Actions + socials */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            title="Print portfolio"
          >
            <Printer className="h-4 w-4" />
          </button>
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              title={s.label}
            >
              <s.icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
