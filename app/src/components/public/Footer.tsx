import { motion } from 'framer-motion'
import { PortfolioSettings } from '@/types'
import { Printer, Github, Linkedin, Twitter, Heart } from 'lucide-react'

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
    <footer className="relative pt-16 pb-8 px-4 sm:px-6 lg:px-8">
      {/* Gradient top border */}
      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-1/2 max-w-md"
        style={{
          background: `linear-gradient(90deg, transparent, hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness)), transparent)`,
        }}
      />

      <div className="max-w-7xl mx-auto flex flex-col items-center gap-8">
        {/* Quote */}
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-sm text-muted-foreground/60 italic text-center max-w-md font-medium"
        >
          "The best way to predict the future is to invent it."
        </motion.p>

        {/* Info row */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground/50 font-mono"
        >
          {settings.location?.trim() && (
            <span>Based in {settings.location.trim()}</span>
          )}
          <span>Built with React, Tailwind & Supabase</span>
        </motion.div>

        {/* Actions + socials */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-3"
        >
          <motion.button
            type="button"
            onClick={handlePrint}
            className="p-3 rounded-xl glass hover:glass-strong transition-all text-muted-foreground hover:text-foreground"
            title="Print portfolio"
            whileHover={{ y: -2, scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Printer className="h-4 w-4" />
          </motion.button>
          
          {socials.map((s, index) => (
            <motion.a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-xl glass hover:glass-strong transition-all text-muted-foreground hover:text-foreground group"
              title={s.label}
              whileHover={{ y: -2, scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
            >
              <s.icon className="h-4 w-4 group-hover:text-accent transition-colors" />
            </motion.a>
          ))}
        </motion.div>

        {/* Copyright */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-xs text-muted-foreground/40 font-mono flex items-center gap-1"
        >
          Made with <Heart className="h-3 w-3 text-destructive" /> © {new Date().getFullYear()}
        </motion.p>
      </div>
    </footer>
  )
}
