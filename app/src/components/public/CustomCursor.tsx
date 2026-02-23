import { useEffect, useRef, useCallback, useState } from 'react'

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: -100, y: -100 })
  const dotPos = useRef({ x: -100, y: -100 })
  const ringPos = useRef({ x: -100, y: -100 })
  const hoveringRef = useRef(false)
  const clickingRef = useRef(false)
  const visibleRef = useRef(false)
  const rafRef = useRef(0)
  
  // Only render on client side after hydration
  const [isClient, setIsClient] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  const tick = useCallback(() => {
    // Different lerp speeds for dot (faster) and ring (slower)
    dotPos.current.x = lerp(dotPos.current.x, pos.current.x, 0.4)
    dotPos.current.y = lerp(dotPos.current.y, pos.current.y, 0.4)
    ringPos.current.x = lerp(ringPos.current.x, pos.current.x, 0.12)
    ringPos.current.y = lerp(ringPos.current.y, pos.current.y, 0.12)

    if (dotRef.current) {
      dotRef.current.style.transform = `translate3d(${dotPos.current.x - 4}px, ${dotPos.current.y - 4}px, 0) scale(${clickingRef.current ? 0.8 : 1})`
      dotRef.current.style.opacity = visibleRef.current ? '1' : '0'
    }
    
    if (ringRef.current) {
      const baseSize = hoveringRef.current ? 48 : 40
      const size = clickingRef.current ? baseSize * 0.85 : baseSize
      const half = size / 2
      ringRef.current.style.transform = `translate3d(${ringPos.current.x - half}px, ${ringPos.current.y - half}px, 0)`
      ringRef.current.style.width = `${size}px`
      ringRef.current.style.height = `${size}px`
      ringRef.current.style.opacity = visibleRef.current ? '0.5' : '0'
      ringRef.current.style.background = hoveringRef.current
        ? 'hsla(var(--accent-hue), var(--accent-saturation), var(--accent-lightness), 0.1)'
        : 'transparent'
    }
    
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    // Mark as client-side
    setIsClient(true)
    
    // Check for touch device
    const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    setIsTouchDevice(isTouch)
    
    if (isTouch) return

    const move = (e: MouseEvent) => {
      pos.current = { x: e.clientX, y: e.clientY }
      visibleRef.current = true
    }

    const enter = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest?.('a, button, [role="button"], input, textarea, select, label[for], [data-hoverable]')) {
        hoveringRef.current = true
      }
    }

    const leave = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest?.('a, button, [role="button"], input, textarea, select, label[for], [data-hoverable]')) {
        hoveringRef.current = false
      }
    }

    const mouseDown = () => { clickingRef.current = true }
    const mouseUp = () => { clickingRef.current = false }
    const hide = () => { visibleRef.current = false }
    const show = () => { visibleRef.current = true }

    window.addEventListener('mousemove', move, { passive: true })
    document.addEventListener('mouseover', enter, { passive: true })
    document.addEventListener('mouseout', leave, { passive: true })
    document.addEventListener('mousedown', mouseDown)
    document.addEventListener('mouseup', mouseUp)
    document.addEventListener('mouseleave', hide)
    document.addEventListener('mouseenter', show)

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('mousemove', move)
      document.removeEventListener('mouseover', enter)
      document.removeEventListener('mouseout', leave)
      document.removeEventListener('mousedown', mouseDown)
      document.removeEventListener('mouseup', mouseUp)
      document.removeEventListener('mouseleave', hide)
      document.removeEventListener('mouseenter', show)
    }
  }, [tick])

  // Don't render until client-side hydrated, and not on touch devices
  if (!isClient || isTouchDevice) return null

  return (
    <>
      {/* Center dot with blend mode */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 z-[9999] pointer-events-none rounded-full no-print will-change-transform"
        style={{
          width: 8,
          height: 8,
          background: 'hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))',
          opacity: 0,
          mixBlendMode: 'difference',
        }}
      />
      {/* Outer ring */}
      <div
        ref={ringRef}
        className="fixed top-0 left-0 z-[9998] pointer-events-none rounded-full no-print will-change-transform"
        style={{
          width: 40,
          height: 40,
          border: '1.5px solid hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))',
          opacity: 0,
          transition: 'width 0.2s ease-out, height 0.2s ease-out, background 0.2s ease-out',
          mixBlendMode: 'difference',
        }}
      />
    </>
  )
}
