import { motion } from 'framer-motion'
import { Project } from '@/types'

interface SkillsSectionProps {
  projects: Project[]
}

/** Compute tag frequency from all published projects, return sorted by frequency desc */
function getTagsWithFrequency(projects: Project[]): { tag: string; count: number }[] {
  const freq = new Map<string, number>()
  for (const project of projects) {
    for (const tag of project.tags) {
      const normalized = tag.trim()
      if (normalized) {
        freq.set(normalized, (freq.get(normalized) || 0) + 1)
      }
    }
  }
  return Array.from(freq.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

export function SkillsSection({ projects }: SkillsSectionProps) {
  const tagsWithFrequency = getTagsWithFrequency(projects)

  if (tagsWithFrequency.length < 3) return null

  const maxCount = tagsWithFrequency[0]?.count ?? 1

  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Tech I Work With
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {tagsWithFrequency.map(({ tag, count }, i) => {
              // Tags appearing in more projects get more visual weight
              const weight = count / maxCount
              const isHighWeight = weight > 0.5

              return (
                <motion.span
                  key={tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.02 }}
                  className={[
                    'inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors',
                    isHighWeight
                      ? 'border-accent/30 bg-accent/10 text-foreground font-medium'
                      : 'border-white/10 bg-white/5 text-muted-foreground',
                    'hover:border-accent/40 hover:bg-accent/15 hover:text-foreground',
                  ].join(' ')}
                >
                  {tag}
                </motion.span>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
