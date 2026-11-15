import { useEffect, useState } from 'react'

type State<T> = { data: T | null; loading: boolean; error: string | null }

export function useRemote<T>(load: ((signal: AbortSignal) => Promise<T>) | null, deps: unknown[]): State<T> {
  const [s, setS] = useState<State<T>>({ data: null, loading: !!load, error: null })
  useEffect(() => {
    if (!load) { setS({ data: null, loading: false, error: null }); return }
    const ctl = new AbortController()
    setS(p => ({ data: p.data, loading: true, error: null }))
    load(ctl.signal)
      .then(data => setS({ data, loading: false, error: null }))
      .catch(e => { if (e.name !== 'AbortError') setS({ data: null, loading: false, error: e.message }) })
    return () => ctl.abort()
  }, deps)
  return s
}
