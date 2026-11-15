import { useMemo, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { EtaRow, Rating, SimResponse } from '../types'
import { getMeta } from '../lib/api'
import { useRemote } from '../hooks/useRemote'
import { useStagger } from '../lib/motion'
import RiskGauge, { DEFAULT_BANDS } from './RiskGauge'
import EtaTable from './EtaTable'
import Num from './Num'

interface Props {
  lakeName: string
  deltaC: number
  years: number
  onDelta: (v: number) => void
  onYears: (v: number) => void
  sim: SimResponse | null
  baseQ: number | null
  observedAreaKm2: number | null
  loading: boolean
  error: string | null
  exposedCount: number
  etaRows?: EtaRow[]
}

const MARKS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]

const fill = (v: number, min: number, max: number): CSSProperties =>
  ({ '--p': `${((v - min) / (max - min)) * 100}%` }) as CSSProperties

export function actionPoints(action: string): string[] {
  const out: string[] = []
  for (const sentence of action.split(/\.\s+/)) {
    const s = sentence.trim().replace(/\.$/, '')
    if (!s) continue
    const named = s.match(/^Downstream communities first reached:\s*(.+)$/)
    if (named) { out.push(`Warn these communities first: ${named[1]}`); continue }
    for (const part of s.split(';')) {
      const t = part.trim()
      if (t) out.push(t.charAt(0).toUpperCase() + t.slice(1))
    }
  }
  return out
}

export default function ActionCard({ lakeName, deltaC, years, onDelta, onYears, sim, baseQ, observedAreaKm2, loading, error, exposedCount, etaRows }: Props) {
  const meta = useRemote(() => getMeta(), [])
  const body = useRef<HTMLDivElement>(null)
  const bands = useMemo<[number, Rating][]>(() => {
    const t = meta.data?.assumptions.rating_thresholds
    return t ? [...t.map(([v, n]) => [v, n] as [number, Rating]), [1, 'Very High']] : DEFAULT_BANDS
  }, [meta.data])

  const d = sim?.risk_detail
  const q = d?.breach.peak_discharge_m3s
  const vsToday = q && baseQ ? Math.round((q / baseQ - 1) * 100) : null
  const sc = sim?.details.scenarios
  const areaPct = sim && observedAreaKm2 ? Math.round((sim.new_area_km2 / observedAreaKm2 - 1) * 100) : null
  const rows = (etaRows && etaRows.length ? etaRows : d?.eta_table ?? []).slice(0, 6)
  const points = useMemo(() => (sim ? actionPoints(sim.action) : []), [sim?.action])

  useStagger(body, '[data-point]', [sim?.action], { y: 12, stagger: 0.09 })

  return (
    <aside className="panel flex max-h-[calc(100vh-9.5rem)] w-[388px] max-w-[calc(100vw-2rem)] flex-col overflow-y-auto p-6 max-sm:max-h-[52vh] max-sm:w-auto">
      <p className="eyebrow">What if it gets warmer?</p>
      <h2 className="display mb-6 mt-1 pr-8 text-4xl">{lakeName.replace(/\s*\(.*\)/, '')}</h2>

      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor="dt" className="text-sm font-medium">Air temperature rise</label>
        <span className="num text-xl font-semibold">+{deltaC.toFixed(1)} °C</span>
      </div>
      <input id="dt" className="track" style={fill(deltaC, 0.5, 4)} type="range" min={0.5} max={4} step={0.1} value={deltaC} onChange={e => onDelta(parseFloat(e.target.value))} />
      <div className="num mb-3 flex justify-between px-2 text-[10px] text-ink-2">{MARKS.map(m => <span key={m}>{m}</span>)}</div>

      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor="yrs" className="text-sm font-medium">Held for</label>
        <span className="num text-sm font-semibold">{years} years</span>
      </div>
      <input id="yrs" className="track mb-4" style={fill(years, 5, 50)} type="range" min={5} max={50} step={5} value={years} onChange={e => onYears(parseInt(e.target.value))} />

      {!sim && loading && <p className="animate-pulse border-t border-ink/10 py-6 text-center text-sm text-ink-2">Running the scenario</p>}
      {error && <p className="mb-2 rounded border border-r-high/40 bg-paper-2 p-2 text-xs">{error}</p>}

      {sim && d && (
        <div ref={body} className={`border-t border-ink/10 pt-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <RiskGauge score={d.score} rating={d.rating} bands={bands} />

          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5">
            <Fig k="Peak flood flow" sub={vsToday != null ? `${vsToday >= 0 ? '+' : ''}${vsToday}% vs today` : undefined}>
              <Num value={q!} format={n => Math.round(n).toLocaleString()} /> <small className="text-xs font-medium text-ink-2">m³/s</small>
            </Fig>
            <Fig k="Dam gives way in" sub={`breach ${Math.round(d.breach.avg_breach_width_m)} m wide`}>
              <Num value={d.breach.breach_time_h} format={n => n.toFixed(1)} /> <small className="text-xs font-medium text-ink-2">h</small>
            </Fig>
            <Fig k="Lake grows to"
              sub={sc ? `range ${sc.low.new_area_km2.toFixed(1)} to ${sc.high.new_area_km2.toFixed(1)}${areaPct != null ? `, ${areaPct >= 0 ? '+' : ''}${areaPct}%` : ''}` : undefined}>
              <Num value={sim.new_area_km2} format={n => n.toFixed(2)} /> <small className="text-xs font-medium text-ink-2">km²</small>
            </Fig>
            <Fig k="Sites in flood path" sub="updates with the sliders">
              <Num value={exposedCount} />
            </Fig>
          </dl>

          <p className="eyebrow mb-2 mt-7">Downstream, first to last</p>
          <EtaTable rows={rows} compact />
          <ul className="bullets mt-3 text-xs text-ink-2">
            <li>Sites listed are the ones the red flood band on the map reaches.</li>
            <li>The band grows longer and wider as temperature and years rise.</li>
            <li>Bar length shows warning time. Arrival times come from the wave-travel model and stay fixed for each site.</li>
          </ul>

          <div className="mt-6 rounded-xl border border-moraine/30 bg-gradient-to-b from-moraine/15 to-moraine/5 p-5">
            <p className="eyebrow text-moraine">What officials should do</p>
            <ul className="bullets bullets-flood mt-3 text-sm">
              {points.map(p => <li key={p} data-point>{p}</li>)}
            </ul>
          </div>
          <p className="mt-4 text-[11px] italic leading-snug text-ink-2">{sim.disclaimer}</p>
        </div>
      )}
    </aside>
  )
}

const Fig = ({ k, sub, children }: { k: string; sub?: string; children: ReactNode }) => (
  <div>
    <dt className="text-xs text-ink-2">{k}</dt>
    <dd className="num text-2xl font-semibold leading-tight">{children}</dd>
    {sub && <dd className="text-[11px] text-ink-2">{sub}</dd>}
  </div>
)
