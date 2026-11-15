import type { LakeInfo } from './lakeInfo'

export default function LakeFacts({ lake }: { lake: LakeInfo }) {
  const a = lake.epochs[0], b = lake.epochs[lake.epochs.length - 1]
  const change = a && b && a.area > 0 ? Math.round((b.area / a.area - 1) * 100) : null
  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-4">
        <Fact k="Region" v={lake.region || 'n/a'} />
        <Fact k="Elevation" v={lake.elevation ? `${lake.elevation.toLocaleString()} m` : 'n/a'} />
        <Fact k={`Surface ${a?.year} to ${b?.year}`} v={a && b ? `${a.area.toFixed(2)} to ${b.area.toFixed(2)} km²` : 'n/a'} sub={change != null ? `${change >= 0 ? '+' : ''}${change}%` : undefined} />
      </div>
      <p className="eyebrow mb-1">Satellite snapshots</p>
      <table className="num w-full text-sm">
        <tbody>
          {lake.epochs.map(e => (
            <tr key={e.year} className="border-b border-rule last:border-0">
              <td className="py-1 pr-4">{e.year}</td>
              <td className="py-1 text-right">{e.area.toFixed(2)} km²</td>
              <td className="w-1/2 py-1 pl-4">
                <div className="h-2 bg-glacier/70" style={{ width: `${Math.min(100, (e.area / Math.max(...lake.epochs.map(x => x.area))) * 100)}%` }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const Fact = ({ k, v, sub }: { k: string; v: string; sub?: string }) => (
  <div>
    <p className="eyebrow">{k}</p>
    <p className="text-sm font-medium leading-snug">{v}</p>
    {sub && <p className="num text-xs text-ink-2">{sub}</p>}
  </div>
)
