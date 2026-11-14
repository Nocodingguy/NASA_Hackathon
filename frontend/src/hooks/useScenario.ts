import { useEffect, useRef, useState } from 'react'
import { simulate } from '../lib/api'
import type { SimResponse } from '../types'

/** Debounced, abortable call to POST /api/simulate while the slider is dragged. */
export function useScenario(lakeId: string, deltaC: number, years: number, debounceMs = 180) {
  const [data, setData] = useState<SimResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ctl = useRef<AbortController | null>(null)

  useEffect(() => {
    const id = setTimeout(async () => {
      ctl.current?.abort(); ctl.current = new AbortController()
      setLoading(true)
      try { setData(await simulate(lakeId, deltaC, years, ctl.current.signal)); setError(null) }
      catch (e) { if ((e as Error).name !== 'AbortError') setError('Backend unreachable: showing heuristic scaling') }
      finally { setLoading(false) }
    }, debounceMs)
    return () => clearTimeout(id)
  }, [lakeId, deltaC, years, debounceMs])

  return { data, loading, error }
}

/** Exponentially smooth a number toward `target` (for animated polygon scaling). */
export function useSmooth(target: number, rate = 7) {
  const [v, setV] = useState(target)
  const cur = useRef(target)
  useEffect(() => {
    let raf = 0, last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1); last = now
      cur.current += (target - cur.current) * (1 - Math.exp(-rate * dt))
      if (Math.abs(target - cur.current) < 1e-4) cur.current = target
      setV(cur.current)
      if (cur.current !== target) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, rate])
  return v
}
