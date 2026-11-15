import type { LakeFeature } from '../types'

export interface LakeInfo {
  id: string
  name: string
  region: string
  elevation: number | null
  epochs: { year: number; area: number }[]
}

export function lakeInfos(features: LakeFeature[]): LakeInfo[] {
  const m = new Map<string, LakeInfo>()
  for (const f of [...features].sort((a, b) => a.properties.year - b.properties.year)) {
    const p = f.properties
    const cur = m.get(p.lake_id) ?? { id: p.lake_id, name: p.lake_name ?? p.lake_id, region: p.region ?? '', elevation: p.elevation_m ?? null, epochs: [] }
    cur.epochs.push({ year: p.year, area: p.area_km2 })
    m.set(p.lake_id, cur)
  }
  return [...m.values()]
}
