import type { ExposureFeature, FloodFeature, LakeCollection, SimResponse } from '../types'
import { demoExposure, demoFloods, demoLakes } from './demoData'
import { smoothPolygon } from './geo'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function tryJson<T>(url: string | undefined, fallback: () => T, pick: (j: any) => T): Promise<T> {
  if (!url) return fallback()
  try { const r = await fetch(url); if (!r.ok) throw new Error(String(r.status)); return pick(await r.json()) }
  catch (e) { console.warn(`[GLOF] ${url} unavailable, using demo data`, e); return fallback() }
}

function normalizeLakes(j: any): LakeCollection {
  const polys = j.features.filter((f: any) => f.geometry?.type === 'Polygon')
  if (polys.length < j.features.length)
    console.warn(`[GLOF] ${j.features.length - polys.length} non-Polygon features skipped`)
  return {
    type: 'FeatureCollection',
    features: polys.map((f: any) => ({
      ...f, geometry: smoothPolygon(f.geometry),
      properties: {
        ...f.properties,
        year: Number(f.properties.year ?? f.properties.epoch_year),
        area_km2: Number(f.properties.area_km2)
      },
    })),
  }
}

const pick = (p: any, keys: string[]) => keys.map(k => p?.[k]).find(v => v != null)

function tierOf(p: any): string {
  const v = String(pick(p, ['tier', 'severity', 'scenario', 'zone', 'level', 'breach_scenario']) ?? '').toLowerCase()
  return v.includes('sev') || v.includes('high') ? 'Severe' : v.includes('mod') || v.includes('med') ? 'Moderate' : v.includes('low') ? 'Low' : 'Unknown'
}

function normalizeFloods(j: any): FloodFeature[] {
  const out: FloodFeature[] = []
  for (const f of j.features ?? []) {
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
    const t = String(pick(f.properties, ['kind', 'type', 'asset_type', 'category', 'infrastructure']) ?? '').toLowerCase()
    out.push({
      type: 'Feature', geometry: f.geometry, properties: {
        lake_id: String(f.properties.lake_id),
        name: String(pick(f.properties, ['name', 'name_en', 'title']) ?? 'Unnamed'),
        kind: t.includes('hydro') || t.includes('power') ? 'hydropower' : t.includes('bridge') ? 'bridge' : 'village',
        population: pick(f.properties, ['population', 'pop'])
      }
    })
  }
  console.log('[GLOF] exposed assets:', out.length)
  return out
}

export const loadLakes = (): Promise<LakeCollection> => tryJson(import.meta.env.VITE_LAKES_URL, demoLakes, normalizeLakes)
export const loadFloods = (): Promise<FloodFeature[]> => tryJson(import.meta.env.VITE_FLOOD_URL, demoFloods, normalizeFloods)
export const loadExposure = (): Promise<ExposureFeature[]> => tryJson(import.meta.env.VITE_EXPOSURE_URL, demoExposure, normalizeExposure)

export async function simulate(lake_id: string, temp_delta_c: number, scenario_years: number, signal?: AbortSignal): Promise<SimResponse> {
  const r = await fetch(`${API}/api/simulate`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lake_id, temp_delta_c, scenario_years }),
  })
  if (!r.ok) throw new Error(`simulate ${r.status}`)
  return r.json()
}

