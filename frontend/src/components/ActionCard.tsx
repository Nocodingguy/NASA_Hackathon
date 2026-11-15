import { useMemo } from 'react'
import type { EtaRow, SimResponse } from '../types'
import { getMeta } from '../lib/api'
import { useRemote } from '../hooks/useRemote'
import RiskGauge, { DEFAULT_BANDS } from './RiskGauge'
import EtaTable from './EtaTable'
import type { Rating } from '../types'

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

export default function ActionCard({ lakeName, deltaC, years, onDelta, onYears, sim, baseQ, observedAreaKm2, loading, error, exposedCount, etaRows }: Props) {
  const meta = useRemote(() => getMeta(), [])
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

  return (
    <aside className="panel absolute right-4 top-4 flex max-h-[calc(100vh-9.5rem)] w-[372px] max-w-[calc(100vw-2rem)] flex-col overflow-y-auto p-5">
      <p className="eyebrow">What if it gets warmer?</p>
      <h2 className="mb-4 font-serif text-2xl leading-tight">{lakeName}</h2>

      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor="dt" className="text-sm">Air temperature rise</label>
        <span className="num text-lg font-medium">+{deltaC.toFixed(1)} °C</span>
      </div>
      <input id="dt" className="track" type="range" min={0.5} max={4} step={0.1} value={deltaC} onChange={e => onDelta(parseFloat(e.target.value))} />
      <div className="num mb-3 flex justify-between px-2 text-[10px] text-ink-2">{MARKS.map(m => <span key={m}>{m}</span>)}</div>

      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor="yrs" className="text-sm">Held for</label>
        <span className="num text-sm">{years} years</span>
      </div>
      <input id="yrs" className="track mb-4" type="range" min={5} max={50} step={5} value={years} onChange={e => onYears(parseInt(e.target.value))} />

      {!sim && loading && <p className="border-t border-rule py-6 text-center text-sm text-ink-2">Running the scenario…</p>}
      {error && <p className="mb-2 rounded border border-r-high/40 bg-paper-2 p-2 text-xs">{error}</p>}

      {sim && d && (
        <div className={`border-t border-rule pt-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <RiskGauge score={d.score} rating={d.rating} bands={bands} />

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Fig k="Peak flood flow" v={`${Math.round(q!).toLocaleString()} m³/s`} sub={vsToday != null ? `${vsToday >= 0 ? '+' : ''}${vsToday}% vs today` : undefined} />
            <Fig k="Dam gives way in" v={`${d.breach.breach_time_h.toFixed(1)} h`} sub={`breach ${Math.round(d.breach.avg_breach_width_m)} m wide`} />
            <Fig k="Lake grows to" v={`${sim.new_area_km2.toFixed(2)} km²`}
              sub={sc ? `range ${sc.low.new_area_km2.toFixed(1)} to ${sc.high.new_area_km2.toFixed(1)}${areaPct != null ? ` · ${areaPct >= 0 ? '+' : ''}${areaPct}%` : ''}` : undefined} />
            <Fig k="Sites in flood path" v={String(exposedCount)} sub="updates with the slider" />
          </dl>

          <h3 className="eyebrow mb-1 mt-5">Downstream, first to last</h3>
          <EtaTable rows={rows} compact />
          <p className="mt-1 text-[11px] text-ink-2">
            Sites listed here are the ones the red flood band on the map reaches. The band grows longer and wider as temperature and years rise.
            Arrival times are from the static wave-travel model and stay fixed for each site.
          </p>

          <div className="mt-4 rounded border-l-4 border-moraine bg-paper-2 p-3">
            <h3 className="eyebrow mb-1 text-moraine">What officials should do</h3>
            <p className="text-sm leading-snug">{sim.action}</p>
          </div>
          <p className="mt-3 text-[11px] italic leading-snug text-ink-2">{sim.disclaimer}</p>
        </div>
      )}
    </aside>
  )
}

const Fig = ({ k, v, sub }: { k: string; v: string; sub?: string }) => (
  <div>
    <dt className="text-xs text-ink-2">{k}</dt>
    <dd className="num text-base font-medium">{v}</dd>
    {sub && <dd className="text-[11px] text-ink-2">{sub}</dd>}
  </div>
)
