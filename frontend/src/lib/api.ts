
import type {
  ExposureFeature,
  ExposureResponse,
  FloodFeature,
  LakeCollection,
  MetaResponse,
  Rating,
  SimResponse,
  TrendsResponse
} from '../types'

import {
  demoExposure,
  demoFloods,
  demoLakes
} from './demoData'

import { smoothPolygon } from './geo'

export const API =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// ---------------- GEOJSON HELPERS ----------------

async function tryJson<T>(
  url: string | undefined,
  fallback: () => T,
  pickData: (json: any) => T
): Promise<T> {
  if (!url) return fallback()

  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(String(response.status))
    }

    return pickData(await response.json())
  } catch (error) {
    console.warn(
      `[GLOF] ${url} unavailable, using demo data`,
      error
    )

    return fallback()
  }
}

const pick = (properties: any, keys: string[]) =>
  keys
    .map(key => properties?.[key])
    .find(value => value != null)

// ---------------- LAKES ----------------

function normalizeLakes(json: any): LakeCollection {
  const features = json.features ?? []

  const polygons = features.filter(
    (feature: any) =>
      feature.geometry?.type === 'Polygon'
  )

  if (polygons.length < features.length) {
    console.warn(
      '[GLOF] Non-polygon lake features skipped'
    )
  }

  return {
    type: 'FeatureCollection',

    features: polygons.map((feature: any) => ({
      ...feature,

      geometry: smoothPolygon(feature.geometry),

      properties: {
        ...feature.properties,

        year: Number(
          feature.properties.year ??
          feature.properties.epoch_year
        ),

        area_km2: Number(
          feature.properties.area_km2
        )
      }
    }))
  }
}

// ---------------- FLOOD ZONES ----------------

function tierOf(properties: any): string {
  const value = String(
    pick(properties, [
      'tier',
      'severity',
      'scenario',
      'zone',
      'level',
      'breach_scenario'
    ]) ?? ''
  ).toLowerCase()

  if (/sev|high|cata|collapse/.test(value)) {
    return 'Severe'
  }

  if (/mod|med|amber/.test(value)) {
    return 'Moderate'
  }

  if (/low|minor/.test(value)) {
    return 'Low'
  }

  return 'Unknown'
}

function normalizeFloods(json: any): FloodFeature[] {
  const output: FloodFeature[] = []

  for (const feature of json.features ?? []) {
    if (
      feature.properties?.feature_type &&
      feature.properties.feature_type !== 'inundation_zone'
    ) {
      continue
    }

    const geometry = feature.geometry

    const polygons =
      geometry?.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry?.type === 'MultiPolygon'
          ? geometry.coordinates
          : []

    if (!polygons.length || !feature.properties?.lake_id) {
      continue
    }

    for (const coordinates of polygons) {
      output.push({
        type: 'Feature',

        geometry: smoothPolygon({
          type: 'Polygon',
          coordinates
        }),

        properties: {
          lake_id: String(feature.properties.lake_id),
          tier: tierOf(feature.properties),
          origin: feature.properties.origin
        }
      })
    }
  }

  console.log(
    '[GLOF] Flood polygons:',
    output.length,
    'tiers:',
    [...new Set(output.map(f => f.properties.tier))]
  )

  return output
}

// ---------------- EXPOSURE ----------------

function normalizeExposure(json: any): ExposureFeature[] {
  const output: ExposureFeature[] = []

  for (const feature of json.features ?? []) {
    if (
      feature.geometry?.type !== 'Point' ||
      !feature.properties?.lake_id
    ) {
      continue
    }

    const properties = feature.properties

    const type = String(
      pick(properties, [
        'kind',
        'asset_type',
        'type',
        'category'
      ]) ?? ''
    ).toLowerCase()

    output.push({
      type: 'Feature',

      geometry: feature.geometry,

      properties: {
        lake_id: String(properties.lake_id),

        name: String(
          pick(properties, ['name', 'name_en']) ??
          'Unnamed'
        ),

        kind: /hydro|power/.test(type)
          ? 'hydropower'
          : type.includes('bridge')
            ? 'bridge'
            : 'village',

        population: pick(properties, [
          'population',
          'pop'
        ]),

        eta_minutes: properties.eta_minutes,
        criticality: properties.criticality
      }
    })
  }

  console.log('[GLOF] Exposed assets:', output.length)

  return output
}

// ---------------- DATA LOADING ----------------

export const loadLakes = () =>
  tryJson(
    import.meta.env.VITE_LAKES_URL ??
    '/data/lakes_master.geojson',
    demoLakes,
    normalizeLakes
  )

export const loadFloods = () =>
  tryJson(
    import.meta.env.VITE_FLOOD_URL ??
    '/data/flood_zones.geojson',
    demoFloods,
    normalizeFloods
  )

export const loadExposure = () =>
  tryJson(
    import.meta.env.VITE_EXPOSURE_URL ??
    '/data/flood_zones.geojson',
    demoExposure,
    normalizeExposure
  )

// ---------------- API REQUEST HELPER ----------------

async function getJson<T>(
  path: string,
  signal?: AbortSignal
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API}${path}`, {
      signal
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw error
    }

    throw new Error(
      `Could not reach the API at ${API}`
    )
  }

  if (!response.ok) {
    throw new Error(
      `${path} returned ${response.status}`
    )
  }

  return response.json()
}

// ---------------- DATA ENDPOINTS ----------------

export const getTrends = (
  lakeId: string,
  signal?: AbortSignal
) =>
  getJson<TrendsResponse>(
    `/api/lakes/${encodeURIComponent(lakeId)}/trends`,
    signal
  )

export const getExposure = (
  lakeId: string,
  signal?: AbortSignal
) =>
  getJson<ExposureResponse>(
    `/api/lakes/${encodeURIComponent(lakeId)}/exposure`,
    signal
  )

export const getMeta = () =>
  getJson<MetaResponse>('/api/meta')

// ---------------- SIMULATION ----------------

// This type assumes the backend returns the
// complete SimResponse structure.

async function post(
  lakeId: string,
  tempDeltaC: number,
  scenarioYears: number,
  signal?: AbortSignal
): Promise<SimResponse> {
  let response: Response

  try {
    response = await fetch(`${API}/api/simulate`, {
      method: 'POST',
      signal,

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        lake_id: lakeId,
        temp_delta_c: tempDeltaC,
        scenario_years: scenarioYears
      })
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw error
    }

    throw new Error(
      `Could not reach the simulation API at ${API}`
    )
  }

  if (!response.ok) {
    throw new Error(
      `Simulation returned ${response.status}`
    )
  }

  return response.json()
}


// ---------------- SIMULATION CACHE ----------------

const baseCache = new Map<
  string,
  Promise<number>
>()

export async function simulate(
  lakeId: string,
  tempDeltaC: number,
  scenarioYears: number,
  signal?: AbortSignal
): Promise<SimResponse> {
  return post(
    lakeId,
    tempDeltaC,
    scenarioYears,
    signal
  )
}

// Baseline discharge is calculated using zero
// temperature increase for the same lake and period.

export function baselinePeak(
  lakeId: string,
  years: number
): Promise<number> {
  const key = `${lakeId}:${years}`

  let promise = baseCache.get(key)

  if (!promise) {
    promise = post(
      lakeId,
      0,
      years
    ).then(
      response => response.risk_detail.breach.peak_discharge_m3s
    )

    promise.catch(() => {
      baseCache.delete(key)
    })

    baseCache.set(key, promise)
  }

  return promise
}
