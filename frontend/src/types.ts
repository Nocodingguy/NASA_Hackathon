import type { Feature, FeatureCollection, Polygon, Point } from 'geojson'

export interface LakeProps { lake_id: string; lake_name?: string; region?: string; elevation_m?: number; year: number; area_km2: number }
export type LakeFeature = Feature<Polygon, LakeProps>

export interface FloodProps { lake_id: string; origin: [number, number]; tier?: string }
export type FloodFeature = Feature<Polygon, FloodProps>

export interface ExposureProps { name: string; kind: 'village' | 'hydropower' | 'bridge'; population?: number; lake_id: string }
export type ExposureFeature = Feature<Point, ExposureProps>

export type LakeCollection = FeatureCollection<Polygon, LakeProps>

export type Rating = 'Low' | 'Moderate' | 'High' | 'Very High'

export interface EtaRow {
  name: string; asset_type: string; eta_minutes: number | null; distance_km: number | null; criticality: string
}

type AreaVol = { new_area_km2: number; new_volume_mcm: number; added_volume_m3: number }

export interface SimResponse {
  lake_id: string
  melt_pct: number
  new_area_km2: number
  new_volume_mcm: number
  added_volume_m3: number
  peak_discharge_m3s: number
  risk: Rating
  action: string
  disclaimer: string
  details: { scenarios: Record<'low' | 'central' | 'high', AreaVol> }
  risk_detail: {
    rating: Rating
    score: number
    components: { hazard: number; exposure: number; vulnerability: number }
    breach: { peak_discharge_m3s: number; breach_time_h: number; avg_breach_width_m: number; breach_height_m: number; mode: string; height_source: string }
    eta_table: EtaRow[]
  }
}

export interface TrendStat {
  trend: 'increasing' | 'decreasing' | 'no trend'
  p_value: number
  z: number
  slope_per_yr: number
  slope_ci: [number, number]
  significant: boolean
  verdict: string
  series: { year: number; value: number }[]
}
export interface TrendsResponse { lake_id: string; t2m: TrendStat; precip: TrendStat }

export interface ExposureResponse {
  lake_id: string
  assets: (EtaRow & { asset_id: string; threat_tier: string; residents: number | null; details: string })[]
  summary: { n_assets: number; min_eta_minutes: number | null; residents_known: number | null; population_note: string }
}

export interface MetaResponse {
  disclaimer: string
  data_sources: string[]
  assumptions: { rating_thresholds: [number, string][] } & Record<string, unknown>
}
