import type { Feature, FeatureCollection, Polygon, Point } from 'geojson'

/** Member 1 contract: one polygon Feature per lake per year. */
export interface LakeProps { lake_id: string; lake_name?: string; year: number; area_km2: number }
export type LakeFeature = Feature<Polygon, LakeProps>

/** One downstream flood-path polygon per lake (baseline discharge). */
export interface FloodProps { lake_id: string; origin: [number, number]; tier?: string }
export type FloodFeature = Feature<Polygon, FloodProps>

export interface ExposureProps { name: string; kind: 'village' | 'hydropower' | 'bridge'; population?: number; lake_id: string }
export type ExposureFeature = Feature<Point, ExposureProps>

export type LakeCollection = FeatureCollection<Polygon, LakeProps>



/** Subset of the Python /api/simulate response used by the UI. */
export interface SimResponse {
  melt: { new_area_km2: number; new_volume_m3: number; area_change_pct: number; added_volume_total_m3: number }
  risk_baseline: { rating: Rating; risk_score: number; breach?: { q_peak_m3s: number } }
  risk_scenario: {
    rating: Rating; risk_score: number; directives: string[]
    breach: { q_peak_m3s: number; breach_time_h: number; avg_breach_width_m: number }
  }
}
export type Rating = 'Low' | 'Moderate' | 'High' | 'Very High'
