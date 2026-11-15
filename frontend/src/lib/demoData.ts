/**
 * DEMO DATA - used only when Member 1's files are not reachable.
 * Coordinates/populations are rough and illustrative, not survey data.
 */
import type { ExposureFeature, FloodFeature, LakeCollection, LakeFeature } from '../types'
import { bufferLine, ellipse } from './geo'

export const YEAR_MIN = 1986, YEAR_MAX = 2026
const IMJA_DAM: [number, number] = [86.9175, 27.8985]

export function demoLakes(): LakeCollection {
  const features: LakeFeature[] = []
  for (let y = YEAR_MIN; y <= YEAR_MAX; y++) {
    const area = 0.03 + 1.32 * Math.pow((y - YEAR_MIN) / (YEAR_MAX - YEAR_MIN), 1.6)
    const b = Math.sqrt(area / (Math.PI * 3)), a = 3 * b                      // km semi-axes, 3:1 ellipse
    const center: [number, number] = [IMJA_DAM[0] + (a * 1000) / (111_320 * Math.cos((IMJA_DAM[1] * Math.PI) / 180)), IMJA_DAM[1]]
    features.push({ type: 'Feature', geometry: ellipse(center, a, b), properties: { lake_id: 'imja', year: y, area_km2: +area.toFixed(3) } })
  }
  return { type: 'FeatureCollection', features }
}

const IMJA_PATH: [number, number][] = [[86.918, 27.8985], [86.88, 27.895], [86.835, 27.892], [86.80, 27.868], [86.79, 27.855],
  [86.75, 27.83], [86.714, 27.805], [86.71, 27.775], [86.712, 27.745], [86.731, 27.687]]

export function demoFloods(): FloodFeature[] {
  const halfW = [120, 120, 150, 200, 220, 280, 330, 380, 420, 480]
  return [{ type: 'Feature', geometry: bufferLine(IMJA_PATH, halfW), properties: { lake_id: 'imja', origin: IMJA_DAM } }]
}

export function demoExposure(): ExposureFeature[] {
  const p = (name: string, kind: 'village' | 'hydropower', lon: number, lat: number, population?: number): ExposureFeature =>
    ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { name, kind, population, lake_id: 'imja' } })
  return [
    p('Dingboche', 'village', 86.832, 27.8925, 300),
    p('Pangboche', 'village', 86.795, 27.857, 400),
    p('Namche Bazaar', 'village', 86.718, 27.805, 1700),
    p('Phakding', 'village', 86.716, 27.746, 500),
    p('Lukla', 'village', 86.735, 27.688, 1400),
    p('Hydropower plant (demo)', 'hydropower', 86.7145, 27.762),
  ]
}
