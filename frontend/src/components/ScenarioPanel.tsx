import type { Rating, SimResponse } from '../types'

const BADGE: Record<Rating, string> = {
  Low: 'bg-emerald-500', Moderate: 'bg-yellow-400 text-slate-900', High: 'bg-orange-500', 'Very High': 'bg-red-600',
}
interface Props { deltaC: number; years: number; onDelta: (v: number) => void; onYears: (v: number) => void
  sim: SimResponse | null; loading: boolean; error: string | null; exposedCount: number }

export default function ScenarioPanel({ deltaC, years, onDelta, onYears, sim, loading, error, exposedCount }: Props) {
  const r = sim?.risk_scenario
  return (
    <div className="absolute right-4 top-4 w-80 rounded-xl bg-slate-900/85 p-4 text-sm text-slate-100 shadow-xl backdrop-blur">
      <div className="mb-1 flex items-center justify-between font-semibold">
        <span>Warming scenario</span>
        {loading && <span className="text-xs text-cyan-300">updating…</span>}
      </div>
      <label className="block text-xs text-slate-300">Temperature rise: <b className="text-white">+{deltaC.toFixed(1)} °C</b></label>
      <input type="range" min={0} max={6} step={0.1} value={deltaC} onChange={e => onDelta(parseFloat(e.target.value))} className="mb-2 w-full accent-orange-400" />
      <label className="block text-xs text-slate-300">Sustained for: <b className="text-white">{years} years</b></label>
      <input type="range" min={1} max={50} step={1} value={years} onChange={e => onYears(parseInt(e.target.value))} className="mb-3 w-full accent-orange-400" />

      {r && sim && (
        <div className="space-y-1 border-t border-slate-700 pt-3">
          <div className="flex items-center justify-between">
            <span>Risk rating</span>
            <span className={`rounded px-2 py-0.5 text-xs font-bold ${BADGE[r.rating]}`}>{r.rating}</span>
          </div>
          <Row k="Projected lake area" v={`${sim.melt.new_area_km2.toFixed(2)} km² (${sim.melt.area_change_pct >= 0 ? '+' : ''}${sim.melt.area_change_pct.toFixed(0)}%)`} />
          <Row k="Peak breach flow" v={`${Math.round(r.breach.q_peak_m3s).toLocaleString()} m³/s`} />
          <Row k="Breach forms in" v={`${r.breach.breach_time_h.toFixed(1)} h`} />
          <Row k="Exposed sites in flood path" v={String(exposedCount)} />
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-slate-300">
            {r.directives.slice(0, 3).map(d => <li key={d}>{d}</li>)}
          </ul>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
    </div>
  )
}
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between text-xs"><span className="text-slate-300">{k}</span><b className="tabular-nums">{v}</b></div>
)
