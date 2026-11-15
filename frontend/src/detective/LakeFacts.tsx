import type { LakeInfo } from './lakeInfo'

export default function LakeFacts({ lake }: { lake: LakeInfo }) {
  const a = lake.epochs[0], b = lake.epochs[lake.epochs.length - 1]
  const change = a && b && a.area > 0 ? Math.round((b.area / a.area - 1) * 100) : null
  return (
    <div>
      <div className="mb-6 grid grid-cols-3 gap-5">
        <Fact k="Region" v={lake.region || 'n/a'} />
        <Fact k="Elevation" v={lake.elevation ? `${lake.elevation.toLocaleString()} m` : 'n/a'} />
        <Fact k={`Surface ${a?.year} to ${b?.year}`} v={a && b ? `${a.area.toFixed(2)} to ${b.area.toFixed(2)} km²` : 'n/a'} sub={change != null ? `${change >= 0 ? '+' : ''}${change}%` : undefined} />
      </div>
      <p className="eyebrow mb-2">Satellite snapshots</p>
      <table className="num w-full text-sm">
        <tbody>
          {lake.epochs.map(e => (
            <tr key={e.year} className="border-b border-rule/60 last:border-0">
              <td className="py-2 pr-4 text-ink-2">{e.year}</td>
              <td className="py-2 text-right font-medium">{e.area.toFixed(2)} km²</td>
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
    <p className="mt-1 text-sm font-medium leading-snug">{v}</p>
    {sub && <p className="num text-xs text-glacier">{sub}</p>}
  </div>
)
