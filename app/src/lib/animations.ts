import { Variants } from 'framer-motion'

// Easing curves - refined for smooth, professional feel
export const easings = {
  // Expo out - best for entrance animations
  expoOut: [0.22, 1, 0.36, 1] as [number, number, number, number],
  // Expo in - best for exit animations  
  expoIn: [0.64, 0, 0.78, 0] as [number, number, number, number],
  // Spring - best for playful interactions
  spring: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
  // Smooth - general purpose
  smooth: [0.4, 0, 0.2, 1] as [number, number, number, number],
}

// Duration constants - in seconds
export const durations = {
  instant: 0.1,
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
  slower: 0.8,
}

// Fade in up animation - most common entrance
export const fadeInUp: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20 
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: durations.slower,
      ease: easings.expoOut
    }
  }
}

// Fade in animation
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: {
      duration: durations.slow,
      ease: easings.smooth
    }
  }
}

// Scale in animation
export const scaleIn: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95 
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: {
      duration: durations.slow,
      ease: easings.expoOut
    }
  }
}

// Slide in from bottom
export const slideInBottom: Variants = {
  hidden: { 
    opacity: 0, 
    y: 30 
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: durations.slower,
      ease: easings.expoOut
    }
  }
}

// Bounce in animation
export const bounceIn: Variants = {
  hidden: { 
    opacity: 0, 
    y: 40, 
    scale: 0.9 
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      duration: 0.8,
      ease: easings.spring
    }
  }
}

// Text reveal animation with clip-path
export const textReveal: Variants = {
  hidden: { 
    opacity: 0, 
    y: 40, 
    clipPath: 'inset(100% 0 0 0)' 
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    clipPath: 'inset(0 0 0 0)',
    transition: {
      duration: 0.8,
      ease: easings.expoOut
    }
  }
}

// Staggered container animation
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
}

// Staggered container with slower stagger
export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2
    }
  }
}

// Card hover animation helpers
export const cardHover = {
  rest: {
    y: 0,
    transition: {
      duration: durations.normal,
      ease: easings.expoOut
    }
  },
  hover: {
    y: -4,
    transition: {
      duration: durations.normal,
      ease: easings.expoOut
    }
  }
}

// Magnetic button effect helper
export function calculateMagneticOffset(
  e: React.MouseEvent,
  rect: DOMRect,
  strength: number = 0.15
): { x: number; y: number } {
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  return {
    x: (e.clientX - centerX) * strength,
    y: (e.clientY - centerY) * strength
  }
}

// Reduced motion check helper
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Animation props for reduced motion
export function getReducedMotionProps() {
  if (prefersReducedMotion()) {
    return {
      initial: false,
      animate: { opacity: 1 },
      transition: { duration: 0.1 }
    }
  }
  return null
}

// Viewport animation settings
export const defaultViewport = {
  once: true,
  margin: '-50px'
}

// Page transition settings
export const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: {
    duration: durations.normal,
    ease: easings.expoOut
  }
}

// Number counter animation helper
export function useCountUp(
  end: number, 
  duration: number = 2
): { value: number; isComplete: boolean } {
  // This would be implemented as a React hook in actual usage
  return { value: end, isComplete: true }
}

// Spotlight position calculation
export function calculateSpotlightPosition(
  e: React.MouseEvent,
  rect: DOMRect
): { x: string; y: string } {
  const x = ((e.clientX - rect.left) / rect.width) * 100
  const y = ((e.clientY - rect.top) / rect.height) * 100
  return {
    x: `${x}%`,
    y: `${y}%`
  }
}
