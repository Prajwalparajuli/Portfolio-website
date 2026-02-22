import { motion, useScroll, useSpring } from 'framer-motion'

export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 40, restDelta: 0.001 })

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] z-[60] origin-left no-print"
      style={{
        scaleX,
        background: `linear-gradient(90deg,
          hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness)),
          hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) - 15%))
        )`,
      }}
    />
  )
}
