import type { EtaRow } from '../types'

export const fmtEta = (m: number | null) => {
  if (m == null) return 'n/a'
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

const CRIT: Record<string, string> = { CRITICAL: 'text-r-vhigh', HIGH: 'text-r-high', MEDIUM: 'text-r-mod', LOW: 'text-ink-2' }

export default function EtaTable({ rows, compact = false }: { rows: EtaRow[]; compact?: boolean }) {
  if (!rows.length) return <p className="text-sm text-ink-2">No downstream assets are listed for this lake yet.</p>
  return (
    <table className={`w-full text-left ${compact ? 'text-xs' : 'text-sm'}`}>
      <thead>
        <tr className="border-b border-ink text-ink-2">
          <th className="py-1.5 pr-2 font-medium">Reached first</th>
          <th className="whitespace-nowrap py-1.5 pr-2 text-right font-medium">Flood arrives</th>
          {!compact && <th className="py-1.5 pr-2 text-right font-medium">Distance</th>}
          <th className="py-1.5 text-right font-medium">Priority</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.name} className="border-b border-rule last:border-0">
            <td className="py-1.5 pr-2">{r.name}</td>
            <td className="num whitespace-nowrap py-1.5 pr-2 text-right">{fmtEta(r.eta_minutes)}</td>
            {!compact && <td className="num py-1.5 pr-2 text-right">{r.distance_km != null ? `${r.distance_km} km` : 'n/a'}</td>}
            <td className={`py-1.5 pl-2 text-right text-[11px] font-semibold uppercase tracking-wide ${CRIT[r.criticality] ?? ''}`}>{r.criticality.toLowerCase()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
