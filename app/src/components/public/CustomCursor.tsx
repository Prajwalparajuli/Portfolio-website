import { useEffect, useRef, useCallback } from 'react'

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: -100, y: -100 })
  const dotPos = useRef({ x: -100, y: -100 })
  const ringPos = useRef({ x: -100, y: -100 })
  const hoveringRef = useRef(false)
  const visibleRef = useRef(false)
  const rafRef = useRef(0)

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  const tick = useCallback(() => {
    dotPos.current.x = lerp(dotPos.current.x, pos.current.x, 0.35)
    dotPos.current.y = lerp(dotPos.current.y, pos.current.y, 0.35)
    ringPos.current.x = lerp(ringPos.current.x, pos.current.x, 0.15)
    ringPos.current.y = lerp(ringPos.current.y, pos.current.y, 0.15)

    if (dotRef.current) {
      dotRef.current.style.transform = `translate3d(${dotPos.current.x - 3}px, ${dotPos.current.y - 3}px, 0)`
      dotRef.current.style.opacity = visibleRef.current ? '1' : '0'
    }
    if (ringRef.current) {
      const size = hoveringRef.current ? 48 : 36
      const half = size / 2
      ringRef.current.style.transform = `translate3d(${ringPos.current.x - half}px, ${ringPos.current.y - half}px, 0)`
      ringRef.current.style.width = `${size}px`
      ringRef.current.style.height = `${size}px`
      ringRef.current.style.opacity = visibleRef.current ? '0.6' : '0'
      ringRef.current.style.background = hoveringRef.current
        ? 'hsla(var(--accent-hue), var(--accent-saturation), var(--accent-lightness), 0.08)'
        : 'transparent'
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return

    const move = (e: MouseEvent) => {
      pos.current = { x: e.clientX, y: e.clientY }
      visibleRef.current = true
    }

    const enter = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest?.('a, button, [role="button"], input, textarea, select, label[for]')) {
        hoveringRef.current = true
      }
    }

    const leave = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest?.('a, button, [role="button"], input, textarea, select, label[for]')) {
        hoveringRef.current = false
      }
    }

    const hide = () => { visibleRef.current = false }
    const show = () => { visibleRef.current = true }

    window.addEventListener('mousemove', move, { passive: true })
    document.addEventListener('mouseover', enter, { passive: true })
    document.addEventListener('mouseout', leave, { passive: true })
    document.addEventListener('mouseleave', hide)
    document.addEventListener('mouseenter', show)

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('mousemove', move)
      document.removeEventListener('mouseover', enter)
      document.removeEventListener('mouseout', leave)
      document.removeEventListener('mouseleave', hide)
      document.removeEventListener('mouseenter', show)
    }
  }, [tick])

  if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return null

  return (
    <>
      <div
        ref={dotRef}
        className="fixed top-0 left-0 z-[9999] pointer-events-none rounded-full no-print will-change-transform"
        style={{
          width: 6,
          height: 6,
          background: 'hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))',
          opacity: 0,
        }}
      />
      <div
        ref={ringRef}
        className="fixed top-0 left-0 z-[9999] pointer-events-none rounded-full no-print will-change-transform"
        style={{
          width: 36,
          height: 36,
          border: '1.5px solid hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))',
          opacity: 0,
          transition: 'width 0.2s, height 0.2s, background 0.2s',
        }}
      />
    </>
  )
}
