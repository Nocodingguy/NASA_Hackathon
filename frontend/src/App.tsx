import { useEffect, useMemo, useRef, useState } from 'react'
import type { MapRef } from 'react-map-gl/mapbox'
import type { Feature, Polygon } from 'geojson'
import MapView from './components/MapView'
import Scrubber from './components/Scrubber'
import ScenarioPanel from './components/ScenarioPanel'
import { useTimeline } from './hooks/useTimeline'
import { useScenario, useSmooth } from './hooks/useScenario'
import { loadExposure, loadFloods, loadLakes } from './lib/api'
import { YEAR_MAX, YEAR_MIN } from './lib/demoData'
import { centroid, inPolygon, mainAxis, scalePolygon } from './lib/geo'
import { lakeAt } from './lib/timeline'
import type { ExposureFeature, FloodFeature, LakeFeature } from './types'

// Visual heuristics (NOT hydraulics): how inundation footprint responds to a discharge ratio Q1/Q0.
const K_ACROSS = 0.4, K_ALONG = 0.15
const TIER_LEGEND: [string, string][] = [
  ['#3b82f6', 'Tier 1 · Low breach'], ['#f59e0b', 'Tier 2 · Moderate breach'], ['#ef4444', 'Tier 3 · Catastrophic collapse'],
]

export default function App() {
  const mapRef = useRef<MapRef>(null)
  const [lakeId, setLakeId] = useState('')
  const [lakes, setLakes] = useState<LakeFeature[]>([])
  const [floods, setFloods] = useState<FloodFeature[]>([])
  const [exposure, setExposure] = useState<ExposureFeature[]>([])
  const [deltaC, setDeltaC] = useState(0)
  const [years, setYears] = useState(20)

  const lakeList = useMemo(() => {
    const byId = new Map<string, LakeFeature>()
    for (const f of lakes) {
      const cur = byId.get(f.properties.lake_id)
      if (!cur || f.properties.year > cur.properties.year) byId.set(f.properties.lake_id, f)
    }
    return [...byId.entries()].map(([id, f]) => ({
      id, label: f.properties.lake_name ?? id, center: centroid(f.geometry) as [number, number]
    }))
  }, [lakes])

  const selectLake = (id: string) => {
    setLakeId(id)
    const l = lakeList.find(x => x.id === id)
    if (l) mapRef.current?.flyTo({ center: l.center, zoom: 12.5, bearing: 200, pitch: 62, duration: 3500, essential: true })
  }

  const epochYears = useMemo(
    () => lakes.filter(f => f.properties.lake_id === lakeId).map(f => f.properties.year), [lakes, lakeId])
  const yMin = epochYears.length ? Math.min(...epochYears) : YEAR_MIN
  const yMax = epochYears.length ? Math.max(...epochYears) : YEAR_MAX
  const tl = useTimeline(yMin, yMax)
  useEffect(() => { tl.setT(yMax) }, [yMax, lakeId])

  useEffect(() => { loadLakes().then(c => setLakes(c.features)); loadFloods().then(setFloods); loadExposure().then(setExposure) }, [])
  useEffect(() => { if (!lakeId && lakeList.length) setLakeId(lakeList[0].id) }, [lakeList, lakeId])

  const sim = useScenario(lakeId, deltaC, years)
  const { now, rings, areaKm2 } = useMemo(() => lakeAt(lakes, lakeId, tl.t), [lakes, lakeId, tl.t])

  const q0 = sim.data?.risk_baseline.breach?.q_peak_m3s, q1 = sim.data?.risk_scenario.breach.q_peak_m3s
  const ratio = useSmooth(q0 && q1 ? q1 / q0 : 1 + 0.12 * deltaC)

  const floodTiers = useMemo(() => {
    const center = lakeList.find(l => l.id === lakeId)?.center
    return floods.filter(f => f.properties.lake_id === lakeId).flatMap(f => {
      const o = f.properties.origin ?? center
      if (!o) return []
      const geometry = scalePolygon(f.geometry, o, Math.pow(ratio, K_ALONG), Math.pow(ratio, K_ACROSS), mainAxis(f.geometry, o))
      return [{ type: 'Feature' as const, properties: { tier: f.properties.tier ?? 'Unknown' }, geometry }]
    })
  }, [floods, lakeId, ratio, lakeList])
  const floodFC = useMemo(
    () => (floodTiers.length ? { type: 'FeatureCollection' as const, features: floodTiers } : null), [floodTiers])

  const scenarioLake = useMemo<Feature<Polygon> | null>(() => {
    const latest = lakes.filter(f => f.properties.lake_id === lakeId).sort((a, b) => b.properties.year - a.properties.year)[0]
    if (!latest || !sim.data || deltaC === 0) return null
    const k = Math.sqrt(sim.data.melt.new_area_km2 / latest.properties.area_km2)
    return { type: 'Feature', properties: {}, geometry: scalePolygon(latest.geometry, centroid(latest.geometry), k, k) }
  }, [lakes, lakeId, sim.data, deltaC])

  const exposureState = useMemo(() => exposure.filter(e => e.properties.lake_id === lakeId)
    .map(feature => ({ feature, exposed: floodTiers.some(t => inPolygon(feature.geometry.coordinates, t.geometry)) })),
    [exposure, lakeId, floodTiers])

  const current = lakeList.find(l => l.id === lakeId)
  const lakeLabel = current ? { name: current.label, lon: current.center[0], lat: current.center[1] } : null

  return (
    <div className="relative h-full w-full">
      <MapView ref={mapRef} lakeNow={now} rings={rings} scenarioLake={scenarioLake} flood={floodFC}
        exposure={exposureState} lakeLabel={lakeLabel} />
      <div className="absolute left-4 top-4 rounded-xl bg-slate-900/85 p-3 text-slate-100 shadow-xl backdrop-blur">
        <h1 className="mb-2 text-sm font-bold tracking-wide">GLOF ATLAS · HIMALAYA</h1>
        <div className="flex flex-col gap-1">
          {lakeList.map(l => (
            <button key={l.id} onClick={() => selectLake(l.id)}
              className={`rounded px-2 py-1 text-left text-xs ${l.id === lakeId ? 'bg-cyan-500 font-semibold text-slate-900' : 'bg-slate-700 hover:bg-slate-600'}`}>{l.label}</button>
          ))}
        </div>
      </div>
      <ScenarioPanel deltaC={deltaC} years={years} onDelta={setDeltaC} onYears={setYears} sim={sim.data}
        loading={sim.loading} error={sim.error} exposedCount={exposureState.filter(e => e.exposed).length} />
      <Scrubber t={tl.t} min={yMin} max={yMax} playing={tl.playing} areaKm2={areaKm2} onChange={tl.setT} onToggle={tl.toggle} />
      <div className="absolute bottom-4 left-4 rounded-xl bg-slate-900/85 p-3 text-xs text-slate-100 shadow-xl backdrop-blur">
        <div className="mb-1 font-semibold">Breach scenario</div>
        {TIER_LEGEND.map(([c, l]) => (
          <div key={l} className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: c }} />{l}</div>
        ))}
      </div>
    </div>
  )
}
