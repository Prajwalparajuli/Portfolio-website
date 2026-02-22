import { motion } from 'framer-motion'
import { PortfolioSettings } from '@/types'
import { GraduationCap, Award, ExternalLink } from 'lucide-react'

interface EducationSectionProps {
  settings: PortfolioSettings
}

export function EducationSection({ settings }: EducationSectionProps) {
  const entries = settings.education ?? []
  if (entries.length === 0) return null

  return (
    <section id="education" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl font-bold tracking-tight gradient-text mb-2"
        >
          Education & Certifications
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-muted-foreground mb-10"
        >
          Academic background and professional credentials
        </motion.p>
        <div className="space-y-6">
          {entries.map((entry, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-2xl p-6"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-white/5 shrink-0">
                  {entry.type === 'certification' ? (
                    <Award className="h-6 w-6 text-muted-foreground" />
                  ) : (
                    <GraduationCap className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-lg text-foreground">{entry.title || '—'}</h3>
                  <p className="text-muted-foreground">{entry.issuer}</p>
                  <p className="text-sm text-muted-foreground/80 mt-1 font-mono">{entry.date}</p>
                  {entry.url && (
                    <a href={entry.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary mt-2 hover:underline">
                      <ExternalLink className="h-3.5 w-3.5" /> View
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
