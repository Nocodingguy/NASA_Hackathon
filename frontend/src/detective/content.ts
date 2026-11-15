import type { TrendStat } from '../types'
import { fmtP, span } from '../lib/stats'

export type VarKey = 't2m' | 'precip'

export interface Variable {
  key: VarKey
  code: string
  name: string
  unit: string
  perYearUnit: string
  how: string
  plain: string
  why: string
  read: string
}

export const VARIABLES: Record<VarKey, Variable> = {
  t2m: {
    key: 't2m', code: 'T2M', name: 'Air temperature', unit: '°C', perYearUnit: '°C',
    how: 'Yearly average of the daily temperature 2 m above the ground',
    plain: 'How warm the air is at head height.',
    why: 'Warm air melts glacier ice. That meltwater is what feeds these lakes, so a steady rise is the first thing to check.',
    read: 'A rising line means more melt days every summer.',
  },
  precip: {
    key: 'precip', code: 'PRECTOTCORR', name: 'Precipitation', unit: 'mm', perYearUnit: 'mm',
    how: 'Yearly total of daily rain and snow, adjusted against ground observations',
    plain: 'How much rain and snow falls in a year.',
    why: 'Heavy monsoon rain can add water to a lake quickly, and snowfall decides how much ice the glacier keeps.',
    read: 'Rainfall swings a lot from year to year, so a trend here is harder to prove than a temperature one.',
  },
}

export const GLOSSARY: { term: string; plain: string }[] = [
  { term: 'Trend test (Mann-Kendall)', plain: 'Asks one question: across the years, do the values tend to climb or fall more than luck would explain? It only looks at order, so a few odd years cannot fake a result.' },
  { term: 'Hamed-Rao correction', plain: 'Weather has memory (a warm year is often followed by another). That makes ordinary tests overconfident, so we use a version that adjusts for it.' },
  { term: 'Theil-Sen slope', plain: 'The typical rate of change, taken as the median of all year-to-year slopes. One freak year barely moves it.' },
  { term: 'p-value', plain: 'The chance of seeing a trend this strong if the climate were not really changing. Below 0.05 (5%) we call it statistically significant.' },
  { term: 'Positive degree-days', plain: 'Add up how many degrees above freezing each day is. More of them means more ice melt. This is how the scenario slider turns warming into meltwater.' },
  { term: 'Peak discharge', plain: 'The highest rate at which water would leave the lake if the dam failed, in cubic metres per second.' },
  { term: 'Susceptibility rating', plain: 'A ranking built from hazard, who is exposed downstream and how vulnerable they are. It says which lakes deserve attention first. It is not a forecast of when one will burst.' },
]

export function plainVerdict(v: Variable, t: TrendStat, lakeName: string): { headline: string; body: string } {
  const { from, to } = span(t)
  const perDecade = t.slope_per_yr * 10
  const dec = `${Math.abs(perDecade).toFixed(v.key === 't2m' ? 2 : 1)} ${v.unit}`
  const word = v.key === 't2m' ? (t.slope_per_yr > 0 ? 'warmer' : 'cooler') : (t.slope_per_yr > 0 ? 'wetter' : 'drier')
  if (t.significant) {
    return {
      headline: `${lakeName} has been getting ${word}.`,
      body: `Between ${from} and ${to} the ${v.name.toLowerCase()} moved about ${dec} per decade. A pattern this steady would almost never come from random year-to-year swings (${fmtP(t.p_value)}).`,
    }
  }
  return {
    headline: `No clear ${v.name.toLowerCase()} trend at ${lakeName}.`,
    body: `The ${from}-${to} record goes up and down, but not in a steady direction we can separate from normal variability (${fmtP(t.p_value)}). That is still a result: it tells us this variable is not what is driving change here.`,
  }
}

export interface Story {
  id: string
  title: string
  kicker: string
  lakeId: string
  variables: VarKey[]
  intro: string
  scenarioDelta: number
}

export const STORIES: Story[] = [
  {
    id: 'rolpa', title: 'Tsho Rolpa and Upper Tamakoshi', kicker: 'Case study 1',
    lakeId: 'tsho_rolpa', variables: ['t2m'],
    intro: 'Nepal\'s best-known glacial lake sits above the valley that feeds its largest hydropower plant. Is the air around it really warming, and what is in the way if it let go?',
    scenarioDelta: 2,
  },
  {
    id: 'imja', title: 'Imja Tsho: heat or rain?', kicker: 'Case study 2',
    lakeId: 'imja_tsho', variables: ['t2m', 'precip'],
    intro: 'Imja Tsho sits above the Everest trail. Two things could be filling it: warmer air melting more ice, or more rain and snow. We test both and let the data pick.',
    scenarioDelta: 2.5,
  },
]
