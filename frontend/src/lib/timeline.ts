import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson'
import type { LakeFeature, LakeProps } from '../types'

type Op = LakeProps & { op: number }

/**
 * Cross-fade between the two bracketing yearly polygons so the lake appears to grow continuously
 * (vertex counts needn't match, so no polygon morphing is needed). Also returns an interpolated area
 * and "growth rings" (outline every 5 years up to the playhead).
 */
export function lakeAt(all: LakeFeature[], lakeId: string, t: number) {
  const fs = all.filter(f => f.properties.lake_id === lakeId).sort((a, b) => a.properties.year - b.properties.year)
  const now: Feature<Polygon, Op>[] = [], rings: Feature<LineString, LakeProps>[] = []
  const i = fs.findLastIndex(f => f.properties.year <= t)
  if (i < 0) return { now: fc(now), rings: fc(rings), areaKm2: 0 }
  const a = fs[i], b = fs[i + 1]
  const w = b ? (t - a.properties.year) / (b.properties.year - a.properties.year) : 0
  now.push({ ...a, properties: { ...a.properties, op: 0.7 } })
  if (b && w > 0) now.push({ ...b, properties: { ...b.properties, op: 0.7 * w } })
  const areaKm2 = b ? a.properties.area_km2 + (b.properties.area_km2 - a.properties.area_km2) * w : a.properties.area_km2

  for (const f of fs.slice(0, i)) if (f.properties.year % 5 === 0)
    rings.push({ type: 'Feature', properties: f.properties, geometry: { type: 'LineString', coordinates: f.geometry.coordinates[0] } })
  return { now: fc(now), rings: fc(rings), areaKm2 }
}

const fc = <G extends Polygon | LineString, P>(features: Feature<G, P>[]): FeatureCollection<G, P> => ({ type: 'FeatureCollection', features })
