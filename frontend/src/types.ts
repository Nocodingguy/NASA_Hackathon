import type { Feature, FeatureCollection, Polygon, Point } from 'geojson'

export interface LakeProps { lake_id: string; lake_name?: string; year: number; area_km2: number }
export type LakeFeature = Feature<Polygon, LakeProps>
export type LakeCollection = FeatureCollection<Polygon, LakeProps>

export interface FloodProps { lake_id: string; origin?: [number, number]; tier?: string }
export type FloodFeature = Feature<Polygon, FloodProps>

export interface ExposureProps {
  name: string; kind: 'village' | 'hydropower' | 'bridge'; lake_id: string
  population?: number; eta_minutes?: number; criticality?: string
}
export type ExposureFeature = Feature<Point, ExposureProps>

export type Rating = 'Low' | 'Moderate' | 'High' | 'Very High'

/** Shape the UI consumes (built by the adapter in lib/api.ts from the backend's flat response). */
export interface SimResponse {
  melt: { new_area_km2: number; new_volume_m3: number; area_change_pct: number; added_volume_total_m3: number }
  risk_baseline: { rating: Rating; risk_score: number; breach?: { q_peak_m3s: number } }
  risk_scenario: {
    rating: Rating; risk_score: number; directives: string[]
    breach: { q_peak_m3s: number; breach_time_h: number; avg_breach_width_m: number }
  }
}
