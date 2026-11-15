import { useEffect, useRef } from 'react'
import { gsap, reducedMotion } from '../lib/motion'

interface Props { value: number; format?: (n: number) => string; duration?: number; className?: string }

const plain = (n: number) => String(Math.round(n))

export default function Num({ value, format = plain, duration = 0.8, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const state = useRef<{ v: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!state.current || reducedMotion()) {
      state.current = { v: value }
      el.textContent = format(value)
      return
    }
    const s = state.current
    const tween = gsap.to(s, { v: value, duration, ease: 'power2.out', onUpdate: () => { el.textContent = format(s.v) } })
    return () => { tween.kill() }
  }, [value])

  return <span ref={ref} className={className} />
}
