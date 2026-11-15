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
        <tr className="border-b border-rule text-ink-2">
          <th className="py-2 pr-2 text-[11px] font-medium uppercase tracking-wider">Reached first</th>
          <th className="whitespace-nowrap py-2 pr-2 text-right text-[11px] font-medium uppercase tracking-wider">Arrives</th>
          {!compact && <th className="py-2 pr-2 text-right text-[11px] font-medium uppercase tracking-wider">Distance</th>}
          <th className="py-2 text-right text-[11px] font-medium uppercase tracking-wider">Priority</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.name} data-row className="border-b border-rule/50 last:border-0">
            <td className="py-2.5 pr-2">{r.name}</td>
            <td className="num whitespace-nowrap py-2.5 pr-2 text-right font-semibold">{fmtEta(r.eta_minutes)}</td>
            {!compact && <td className="num py-2.5 pr-2 text-right">{r.distance_km != null ? `${r.distance_km} km` : 'n/a'}</td>}
            <td className={`py-2.5 pl-2 text-right text-xs font-semibold capitalize ${CRIT[r.criticality] ?? ''}`}>
              {r.criticality.toLowerCase()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
