import { useEffect, useRef, useState } from 'react'

/** Fractional-year playhead; `toggle()` advances it at `yearsPerSec` using rAF for smooth animation. */
export function useTimeline(min: number, max: number, yearsPerSec = 2.5) {
  const [t, setT] = useState(max)
  const [playing, setPlaying] = useState(false)
  const raf = useRef(0)

  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now
      setT(prev => {
        const next = prev + dt * yearsPerSec
        if (next >= max) { setPlaying(false); return max }
        return next
      })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, max, yearsPerSec])

  const toggle = () => { if (!playing && t >= max) setT(min); setPlaying(p => !p) }
  return { t, setT: (v: number) => { setPlaying(false); setT(v) }, playing, toggle }
}
