import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA']

export function KonamiEgg() {
  const [revealed, setRevealed] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === KONAMI[index]) {
        const next = index + 1
        if (next === KONAMI.length) {
          setRevealed(true)
          setIndex(0)
          setTimeout(() => setRevealed(false), 4000)
        } else {
          setIndex(next)
        }
      } else {
        setIndex(0)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [index])

  return (
    <AnimatePresence>
      {revealed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
        >
          <div className="glass-strong rounded-2xl p-8 max-w-sm text-center shadow-2xl pointer-events-auto">
            <motion.span
              className="text-4xl"
              role="img"
              aria-label="party"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: 2 }}
            >
              🎉
            </motion.span>
            <h3 className="text-xl font-bold mt-4 gradient-text-accent">You found the secret!</h3>
            <p className="text-sm text-muted-foreground mt-2">
              This portfolio was built with React, TypeScript, and Supabase. Thanks for exploring.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
