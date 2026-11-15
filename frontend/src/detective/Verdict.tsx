import { CheckCircle2, MinusCircle } from 'lucide-react'
import type { TrendStat } from '../types'
import { plainVerdict, type Variable } from './content'
import { fmtP, span } from '../lib/stats'
import TrendChart from './TrendChart'

export function Badge({ stat }: { stat: TrendStat }) {
  const sig = stat.significant
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-sm font-semibold ${sig ? 'border-moraine bg-moraine text-abyss' : 'border-ink-2 text-ink-2'}`}>
      {sig ? <CheckCircle2 size={15} /> : <MinusCircle size={15} />}
      {sig ? 'Statistically significant (p < 0.05)' : 'Not significant (p ≥ 0.05)'}
    </span>
  )
}

export default function Verdict({ v, stat, lakeName, chartHeight }: { v: Variable; stat: TrendStat; lakeName: string; chartHeight?: number }) {
  const { headline, body } = plainVerdict(v, stat, lakeName)
  const { from, to, n } = span(stat)
  const dp = v.key === 't2m' ? 2 : 1
  const [lo, hi] = stat.slope_ci.map(x => x * 10)
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_17rem]">
      <div>
        <div className="mb-3"><Badge stat={stat} /></div>
        <h2 className="display text-4xl sm:text-5xl">{headline}</h2>
        <p className="mb-6 mt-3 max-w-2xl text-base leading-relaxed text-ink-2">{body}</p>
        <TrendChart stat={stat} v={v} height={chartHeight} />
      </div>
      <aside className="space-y-5 lg:border-l lg:border-rule lg:pl-6">
        <Stat k="Rate of change" v={`${stat.slope_per_yr * 10 >= 0 ? '+' : '−'}${Math.abs(stat.slope_per_yr * 10).toFixed(dp)} ${v.unit} per decade`}
          sub={`95% range ${lo.toFixed(dp)} to ${hi.toFixed(dp)}`} />
        <Stat k="Chance it is just noise" v={fmtP(stat.p_value)} sub="below 0.05 counts as significant" />
        <Stat k="Record" v={`${from} to ${to}`} sub={`${n} full years used`} />
        <div>
          <p className="eyebrow mb-2">What you are looking at</p>
          <ul className="bullets text-sm text-ink-2">
            <li>{v.code}: {v.how.toLowerCase()}.</li>
            <li>{v.read}</li>
          </ul>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">How the test works</summary>
          <ul className="bullets mt-2 text-ink-2">
            <li>Modified Mann-Kendall (Hamed-Rao), which corrects for years that echo each other.</li>
            <li>The dashed line is the Theil-Sen slope.</li>
            <li>Years with more than about 65 missing days are dropped.</li>
            <li>z = <span className="num">{stat.z.toFixed(2)}</span></li>
          </ul>
        </details>
      </aside>
    </div>
  )
}

const Stat = ({ k, v, sub }: { k: string; v: string; sub: string }) => (
  <div>
    <p className="eyebrow">{k}</p>
    <p className="num text-lg font-medium">{v}</p>
    <p className="text-xs text-ink-2">{sub}</p>
  </div>
)
