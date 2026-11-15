import { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TrendStat } from '../types'
import type { Variable } from './content'
import { trendRows } from '../lib/stats'

export default function TrendChart({ stat, v, height = 320 }: { stat: TrendStat; v: Variable; height?: number }) {
  const rows = useMemo(() => trendRows(stat), [stat])
  const lo = Math.min(...rows.map(r => Math.min(r.value, r.band[0])))
  const hi = Math.max(...rows.map(r => Math.max(r.value, r.band[1])))
  const pad = (hi - lo) * 0.12 || 1
  const digits = v.key === 't2m' ? 1 : 0

  return (
    <div role="img" aria-label={`${v.name} by year with fitted trend line`}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--color-rule)" strokeOpacity={0.55} vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--color-ink-2)' }} tickLine={false} axisLine={{ stroke: 'var(--color-rule)' }} minTickGap={24} />
          <YAxis domain={[lo - pad, hi + pad]} tickFormatter={(x: number) => x.toFixed(digits)} width={44}
            tick={{ fontSize: 11, fill: 'var(--color-ink-2)' }} tickLine={false} axisLine={false} />
          <Tooltip content={<Tip v={v} digits={digits} />} cursor={{ stroke: 'var(--color-ink-2)', strokeDasharray: '2 3' }} />
          <Area dataKey="band" stroke="none" fill="var(--color-moraine)" fillOpacity={0.14} isAnimationActive={false} activeDot={false} />
          <Line dataKey="value" stroke="var(--color-glacier)" strokeWidth={2} dot={{ r: 2, fill: 'var(--color-glacier)', strokeWidth: 0 }} activeDot={{ r: 4.5, strokeWidth: 0 }} isAnimationActive animationDuration={1600} animationEasing="ease-out" />
          <Line dataKey="trend" stroke="var(--color-moraine)" strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} isAnimationActive animationBegin={900} animationDuration={1200} animationEasing="ease-out" />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
        <Key swatch={<span className="inline-block h-0.5 w-5 bg-glacier" />}>{v.name} ({v.unit}), one point per year</Key>
        <Key swatch={<span className="inline-block w-5 border-t-2 border-dashed border-moraine" />}>Typical trend (Theil-Sen)</Key>
        <Key swatch={<span className="inline-block h-2.5 w-5 bg-moraine/15" />}>95% range of the trend's steepness</Key>
      </div>
    </div>
  )
}

const Key = ({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2">{swatch}{children}</span>
)

function Tip({ active, payload, v, digits }: { active?: boolean; payload?: { payload: { year: number; value: number; trend: number } }[]; v: Variable; digits: number }) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload
  return (
    <div className="panel px-3 py-2 text-xs">
      <div className="num font-medium">{r.year}</div>
      <div>{v.name}: <b className="num">{r.value.toFixed(digits + 1)} {v.unit}</b></div>
      <div className="text-ink-2">Trend line: <span className="num">{r.trend.toFixed(digits + 1)}</span></div>
    </div>
  )
}
