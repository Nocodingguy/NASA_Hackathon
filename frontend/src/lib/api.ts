import type { ExposureFeature, FloodFeature, LakeCollection, Rating, SimResponse } from '../types'
import { demoExposure, demoFloods, demoLakes } from './demoData'
import { smoothPolygon } from './geo'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function tryJson<T>(url: string | undefined, fallback: () => T, pick: (j: any) => T): Promise<T> {
  if (!url) return fallback()
  try { const r = await fetch(url); if (!r.ok) throw new Error(String(r.status)); return pick(await r.json()) }
  catch (e) { console.warn(`[GLOF] ${url} unavailable, using demo data`, e); return fallback() }
}

const pick = (p: any, keys: string[]) => keys.map(k => p?.[k]).find(v => v != null)

function normalizeLakes(j: any): LakeCollection {
  const polys = j.features.filter((f: any) => f.geometry?.type === 'Polygon')
  if (polys.length < j.features.length) console.warn(`[GLOF] ${j.features.length - polys.length} non-Polygon features skipped`)
  return {
    type: 'FeatureCollection',
    features: polys.map((f: any) => ({
      ...f, geometry: smoothPolygon(f.geometry),
      properties: { ...f.properties, year: Number(f.properties.year ?? f.properties.epoch_year), area_km2: Number(f.properties.area_km2) },
    })),
  }
}

function tierOf(p: any): string {
  const v = String(pick(p, ['tier', 'severity', 'scenario', 'zone', 'level', 'breach_scenario']) ?? '').toLowerCase()
  if (/sev|high|cata|collapse/.test(v)) return 'Severe'
  if (/mod|med|amber/.test(v)) return 'Moderate'
  if (/low|minor/.test(v)) return 'Low'
  return 'Unknown'
}

function normalizeFloods(j: any): FloodFeature[] {
  const out: FloodFeature[] = []
  for (const f of j.features ?? []) {
    if (f.properties?.feature_type && f.properties.feature_type !== 'inundation_zone') continue
    const polys = f.geometry?.type === 'Polygon' ? [f.geometry.coordinates]
      : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : []
    if (!polys.length || !f.properties?.lake_id) continue
    for (const coords of polys)
      out.push({
        type: 'Feature', geometry: smoothPolygon({ type: 'Polygon', coordinates: coords }),
        properties: { lake_id: String(f.properties.lake_id), tier: tierOf(f.properties), origin: f.properties.origin }
      })
  }
  console.log('[GLOF] flood polygons:', out.length, 'tiers:', [...new Set(out.map(f => f.properties.tier))])
  return out
}

function normalizeExposure(j: any): ExposureFeature[] {
  const out: ExposureFeature[] = []
  for (const f of j.features ?? []) {
    if (f.geometry?.type !== 'Point' || !f.properties?.lake_id) continue
    const t = String(pick(f.properties, ['kind', 'asset_type', 'type', 'category']) ?? '').toLowerCase()
    out.push({
      type: 'Feature', geometry: f.geometry, properties: {
        lake_id: String(f.properties.lake_id),
        name: String(pick(f.properties, ['name', 'name_en']) ?? 'Unnamed'),
        kind: /hydro|power/.test(t) ? 'hydropower' : t.includes('bridge') ? 'bridge' : 'village',
        population: pick(f.properties, ['population', 'pop']),
        eta_minutes: f.properties.eta_minutes, criticality: f.properties.criticality
      }
    })
  }
  console.log('[GLOF] exposed assets:', out.length)
  return out
}

export const loadLakes = (): Promise<LakeCollection> => tryJson(import.meta.env.VITE_LAKES_URL, demoLakes, normalizeLakes)
export const loadFloods = (): Promise<FloodFeature[]> => tryJson(import.meta.env.VITE_FLOOD_URL, demoFloods, normalizeFloods)
export const loadExposure = (): Promise<ExposureFeature[]> => tryJson(import.meta.env.VITE_EXPOSURE_URL, demoExposure, normalizeExposure)

// ---- Simulation: adapt the backend's flat response to the shape the UI reads ----
interface RawSim {
  new_area_km2: number; added_volume_m3: number; new_volume_mcm: number; action: string
  risk_detail: {
    rating: Rating; score: number
    breach: { peak_discharge_m3s: number; breach_time_h: number; avg_breach_width_m: number }
  }
}

async function post(lake_id: string, temp_delta_c: number, scenario_years: number, signal?: AbortSignal): Promise<RawSim> {
  const r = await fetch(`${API}/api/simulate`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lake_id, temp_delta_c, scenario_years }),
  })
  if (!r.ok) throw new Error(`simulate ${r.status}`)
  return r.json()
}

// The backend has no "baseline" field, so one dT=0 call per lake supplies it (cached).
const baselines = new Map<string, Promise<RawSim>>()

export async function simulate(lake_id: string, temp_delta_c: number, scenario_years: number, signal?: AbortSignal): Promise<SimResponse> {
  const s = await post(lake_id, temp_delta_c, scenario_years, signal)   // first: also warms the NASA cache
  let bp = baselines.get(lake_id)
  if (!bp) { bp = post(lake_id, 0, scenario_years); baselines.set(lake_id, bp); bp.catch(() => baselines.delete(lake_id)) }
  const b = await bp
  const sd = s.risk_detail, bd = b.risk_detail
  return {
    melt: {
      new_area_km2: s.new_area_km2, new_volume_m3: s.new_volume_mcm * 1e6, added_volume_total_m3: s.added_volume_m3,
      area_change_pct: b.new_area_km2 ? (s.new_area_km2 / b.new_area_km2 - 1) * 100 : 0
    },
    risk_baseline: { rating: bd.rating, risk_score: bd.score, breach: { q_peak_m3s: bd.breach.peak_discharge_m3s } },
    risk_scenario: {
      rating: sd.rating, risk_score: sd.score,
      directives: s.action.split(/(?<=\.)\s+/).filter(Boolean),
      breach: { q_peak_m3s: sd.breach.peak_discharge_m3s, breach_time_h: sd.breach.breach_time_h, avg_breach_width_m: sd.breach.avg_breach_width_m }
    },
  }
}
