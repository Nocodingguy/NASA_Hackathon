import { useEffect, useRef } from 'react'
import type { Rating } from '../types'
import { gsap, reducedMotion } from '../lib/motion'

export const DEFAULT_BANDS: [number, Rating][] = [[0.3, 'Low'], [0.5, 'Moderate'], [0.65, 'High'], [1, 'Very High']]
export const RATING_COLOR: Record<Rating, string> = {
  Low: 'var(--color-r-low)', Moderate: 'var(--color-r-mod)', High: 'var(--color-r-high)', 'Very High': 'var(--color-r-vhigh)',
}

const CX = 100, CY = 100, R = 78
const pt = (s: number, r = R) => {
  const a = Math.PI * (1 - s)
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)]
}
const arc = (s0: number, s1: number) => {
  const [x0, y0] = pt(s0), [x1, y1] = pt(s1)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

export default function RiskGauge({ score, rating, bands = DEFAULT_BANDS }: { score: number; rating: Rating; bands?: [number, Rating][] }) {
  const s = Math.max(0, Math.min(1, score))
  const needle = useRef<SVGLineElement>(null)
  const start = useRef(pt(s, R - 10))
  const [nx, ny] = pt(s, R - 10)

  useEffect(() => {
    const el = needle.current
    if (!el) return
    if (reducedMotion()) { el.setAttribute('x2', String(nx)); el.setAttribute('y2', String(ny)); return }
    const tween = gsap.to(el, { attr: { x2: nx, y2: ny }, duration: 0.9, ease: 'elastic.out(1, 0.55)' })
    return () => { tween.kill() }
  }, [nx, ny])

  let from = 0
  return (
    <figure className="m-0 text-center" aria-label={`Risk rating ${rating}, score ${score.toFixed(2)} of 1`}>
      <svg viewBox="0 0 200 118" className="mx-auto w-full max-w-[250px]">
        {bands.map(([to, name]) => {
          const d = arc(from + 0.004, to - 0.004); from = to
          return <path key={name} d={d} fill="none" stroke={RATING_COLOR[name]} strokeWidth={13} opacity={name === rating ? 1 : 0.28} style={{ transition: 'opacity .4s' }} />
        })}
        <line ref={needle} x1={CX} y1={CY} x2={start.current[0]} y2={start.current[1]} stroke="var(--color-ink)" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={5} fill="var(--color-ink)" />
        <text x={CX - R} y={116} textAnchor="middle" fontSize="8" fill="var(--color-ink-2)">Low</text>
        <text x={CX + R} y={116} textAnchor="middle" fontSize="8" fill="var(--color-ink-2)">Very high</text>
      </svg>
      <figcaption className="-mt-1">
        <span className="display text-4xl" style={{ color: RATING_COLOR[rating] }}>{rating}</span>
        <span className="num ml-2 text-xs text-ink-2">score {score.toFixed(2)}</span>
      </figcaption>
    </figure>
  )
}
