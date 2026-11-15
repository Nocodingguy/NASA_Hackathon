import type { TrendStat } from '../types'

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export interface ChartRow { year: number; value: number; trend: number; band: [number, number] }

export function trendRows(t: TrendStat): ChartRow[] {
  const xs = t.series.map(p => p.year), ys = t.series.map(p => p.value)
  const b = median(ys.map((y, i) => y - t.slope_per_yr * xs[i]))
  const xm = median(xs), ym = t.slope_per_yr * xm + b
  const [lo, hi] = t.slope_ci
  return t.series.map(p => {
    const l = ym + lo * (p.year - xm), h = ym + hi * (p.year - xm)
    return { year: p.year, value: p.value, trend: t.slope_per_yr * p.year + b, band: [Math.min(l, h), Math.max(l, h)] }
  })
}

export const fmtP = (p: number) => (p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`)

export const span = (t: TrendStat) => {
  const ys = t.series.map(p => p.year)
  return { from: Math.min(...ys), to: Math.max(...ys), n: ys.length }
}
