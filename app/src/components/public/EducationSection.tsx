import { motion } from 'framer-motion'
import { PortfolioSettings } from '@/types'
import { GraduationCap, Award, ExternalLink, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EducationSectionProps {
  settings: PortfolioSettings
}

export function EducationSection({ settings }: EducationSectionProps) {
  const entries = settings.education ?? []
  if (entries.length === 0) return null

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }
    }
  }

  return (
    <section id="education" className="py-24 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12"
        >
          <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight gradient-text mb-4">
            Education & Certifications
          </h2>
          <p className="text-lg text-muted-foreground">
            Academic background and professional credentials
          </p>
        </motion.div>

        {/* Education cards */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="space-y-4"
        >
          {entries.map((entry, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="group glass-strong rounded-2xl p-6 transition-all duration-300 hover:glass-elevated"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={cn(
                  'p-3 rounded-xl shrink-0 transition-colors duration-300',
                  entry.type === 'certification' 
                    ? 'bg-warning/10 group-hover:bg-warning/20' 
                    : 'bg-accent/10 group-hover:bg-accent/20'
                )}>
                  {entry.type === 'certification' ? (
                    <Award className="h-5 w-5 text-warning" />
                  ) : (
                    <GraduationCap className="h-5 w-5 text-accent" />
                  )}
                </div>
                
                {/* Content */}
                <div className="min-w-0 flex-1">
                  <h3 className="font-display font-semibold text-xl text-foreground mb-1">
                    {entry.title || '—'}
                  </h3>
                  <p className="text-muted-foreground mb-2">
                    {entry.issuer}
                  </p>
                  
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground/80 font-mono">
                      <Calendar className="h-3.5 w-3.5" />
                      {entry.date}
                    </span>
                    
                    {entry.url && (
                      <a 
                        href={entry.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors group/link"
                      >
                        <span className="link-hover">View credential</span>
                        <ExternalLink className="h-3.5 w-3.5 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
