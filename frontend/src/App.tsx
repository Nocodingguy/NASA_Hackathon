import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MapRef } from 'react-map-gl/mapbox'
import type { Feature, FeatureCollection, Polygon, Position } from 'geojson'
import MapView from './components/MapView'
import Scrubber from './components/Scrubber'
import ActionCard from './components/ActionCard'
import Credits from './components/Credits'
import Detective from './detective/Detective'
import Scrollytelling from './story/Scrollytelling'
import { gsap, reducedMotion } from './lib/motion'
import { useTimeline } from './hooks/useTimeline'
import { useScenario, useSmooth } from './hooks/useScenario'
import { loadExposure, loadLakes, loadPaths } from './lib/api'
import { YEAR_MAX, YEAR_MIN } from './lib/demoData'
import { bufferLine, catmullRom, centroid, cumulativeKm, projectOnLine, scalePolygon, sliceLine } from './lib/geo'
import { lakeAt } from './lib/timeline'
import type { ExposureFeature, LakeFeature } from './types'

type View = 'story' | 'detective' | 'map'

const RATIO_MIN = 0.85
const RATIO_MAX = 3.2
const REACH_MIN_FRAC = 0.2
const RATIO_FULL = 2.6
const RATIO_START = 0.9
const BASE_HALF_WIDTH_M = 90
const WIDEN_M_PER_KM = 7
// Breach tiers, outermost first. `reach` follows Member 1's reach factors; `width` is a visual choice.
const TIERS = [
  { tier: 'severe', reach: 1.0, width: 1.0 },
  { tier: 'moderate', reach: 0.75, width: 0.6 },
  { tier: 'low', reach: 0.5, width: 0.35 },
] as const

const TIER_LEGEND = [
  ['#3b82f6', 'Tier 1 · Low breach'],
  ['#f59e0b', 'Tier 2 · Moderate breach'],
  ['#ef4444', 'Tier 3 · Catastrophic collapse'],
] as const

function reachFraction(ratio: number): number {
  const f = Math.min(1, Math.max(0, (ratio - RATIO_START) / (RATIO_FULL - RATIO_START)))
  return REACH_MIN_FRAC + (1 - REACH_MIN_FRAC) * f
}

export default function App() {
  const mapRef = useRef<MapRef>(null)
  const [lakeId, setLakeId] = useState('')
  const [lakes, setLakes] = useState<LakeFeature[]>([])
  const [paths, setPaths] = useState<Record<string, Position[]>>({})
  const [exposure, setExposure] = useState<ExposureFeature[]>([])
  const [deltaC, setDeltaC] = useState(1.5)
  const [years, setYears] = useState(30)
  const [view, setView] = useState<View>('story')
  const root = useRef<HTMLDivElement>(null)
  const curtain = useRef<HTMLDivElement>(null)
  const [creditsOpen, setCreditsOpen] = useState(false)

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

  const flyTo = (center: [number, number]) =>
    mapRef.current?.flyTo({ center, zoom: 12.5, bearing: 200, pitch: 62, duration: 3500, essential: true })

  const selectLake = (id: string) => {
    setLakeId(id)
    const l = lakeList.find(x => x.id === id)
    if (l) flyTo(l.center)
  }

  const go = (next: View, after?: () => void) => {
    const c = curtain.current
    if (!c || reducedMotion()) { setView(next); after?.(); return }
    gsap.timeline()
      .to(c, { autoAlpha: 1, duration: 0.4, ease: 'power2.in' })
      .add(() => { setView(next); after?.() })
      .to(c, { autoAlpha: 0, duration: 0.8, ease: 'power2.out', delay: 0.15 })
  }

  const goMap = () => go('map', () => {
    const l = lakeList.find(x => x.id === lakeId)
    if (l) flyTo(l.center)
  })

  const openOnMap = (id: string, delta?: number) => {
    selectLake(id)
    if (delta != null) setDeltaC(delta)
    go('map')
  }

  useLayoutEffect(() => {
    if (view !== 'map' || reducedMotion() || !root.current) return
    const ctx = gsap.context(() => {
      gsap.from('[data-dock="left"]', { xPercent: -14, autoAlpha: 0, duration: 1, ease: 'power3.out', delay: 0.5 })
      gsap.from('[data-dock="right"]', { xPercent: 10, autoAlpha: 0, duration: 1, ease: 'power3.out', delay: 0.65 })
      gsap.from('[data-dock="bottom"]', { yPercent: 40, autoAlpha: 0, duration: 1, ease: 'power3.out', delay: 0.8 })
    }, root)
    return () => ctx.revert()
  }, [view])

  const epochYears = useMemo(
    () => lakes.filter(f => f.properties.lake_id === lakeId).map(f => f.properties.year), [lakes, lakeId])
  const yMin = epochYears.length ? Math.min(...epochYears) : YEAR_MIN
  const yMax = epochYears.length ? Math.max(...epochYears) : YEAR_MAX
  const tl = useTimeline(yMin, yMax)
  useEffect(() => { tl.setT(yMax) }, [yMax, lakeId])

  useEffect(() => { loadLakes().then(c => setLakes(c.features)); loadPaths().then(setPaths); loadExposure().then(setExposure) }, [])
  useEffect(() => { if (!lakeId && lakeList.length) setLakeId(lakeList[0].id) }, [lakeList, lakeId])
  useEffect(() => { console.log('lakes in data:', lakeList.map(l => l.id)) }, [lakeList])

  const sim = useScenario(lakeId, deltaC, years)
  const { now, rings, areaKm2 } = useMemo(() => lakeAt(lakes, lakeId, tl.t), [lakes, lakeId, tl.t])

  const q0 = sim.baseQ, q1 = sim.data?.peak_discharge_m3s
  const rawRatio = q0 && q1 ? q1 / q0 : 1 + 0.18 * deltaC * Math.sqrt(years / 25)
  const ratio = useSmooth(Math.min(RATIO_MAX, Math.max(RATIO_MIN, rawRatio)))

  const river = useMemo(() => {
    const origin = lakeList.find(l => l.id === lakeId)?.center
    let raw = paths[lakeId]
    if (!raw || raw.length < 2) {
      const pts = exposure
        .filter(e => e.properties.lake_id === lakeId)
        .sort((x, y) => (x.properties.eta_minutes ?? x.properties.distance_km ?? 0) - (y.properties.eta_minutes ?? y.properties.distance_km ?? 0))
        .map(e => e.geometry.coordinates)
      raw = origin ? [origin, ...pts] : pts
    }
    if (raw.length < 2) return null
    const line = catmullRom(raw)
    const cum = cumulativeKm(line)
    return { line, cum, total: cum[cum.length - 1] }
  }, [paths, exposure, lakeId, lakeList])

  const reachKm = river ? river.total * reachFraction(ratio) : 0

  // Three nested breach bands along the river; all grow with the warming sliders.
  const flood = useMemo<FeatureCollection<Polygon, { tier: string }> | null>(() => {
    if (!river) return null
    const widthScale = Math.pow(ratio, 0.6)
    const features = TIERS.flatMap(t => {
      const { pts, km } = sliceLine(river.line, river.cum, reachKm * t.reach)
      if (pts.length < 2) return []
      const halfW = km.map(k => (BASE_HALF_WIDTH_M + WIDEN_M_PER_KM * k) * widthScale * t.width)
      return [{ type: 'Feature' as const, properties: { tier: t.tier }, geometry: bufferLine(pts, halfW) }]
    })
    return features.length ? { type: 'FeatureCollection' as const, features } : null
  }, [river, reachKm, ratio])

  const scenarioLake = useMemo<Feature<Polygon> | null>(() => {
    const latest = lakes.filter(f => f.properties.lake_id === lakeId).sort((a, b) => b.properties.year - a.properties.year)[0]
    if (!latest || !sim.data || deltaC === 0) return null
    const k = Math.sqrt(sim.data.new_area_km2 / latest.properties.area_km2)
    return { type: 'Feature', properties: {}, geometry: scalePolygon(latest.geometry, centroid(latest.geometry), k, k) }
  }, [lakes, lakeId, sim.data, deltaC])

  const exposureState = useMemo(() => {
    return exposure
      .filter(e => e.properties.lake_id === lakeId)
      .map(feature => {
        const exposed = !!river && projectOnLine(feature.geometry.coordinates, river.line, river.cum).along <= reachKm
        return { feature, exposed }
      })
  }, [exposure, lakeId, river, reachKm])

  const dynamicEtaRows = useMemo(() => {
    const rows = exposureState
      .filter(e => e.exposed)
      .map(({ feature: f }) => {
        const p = f.properties
        return {
          name: p.name,
          asset_type: p.kind,
          eta_minutes: p.eta_minutes ?? null,
          distance_km: p.distance_km ?? null,
          criticality: (p.criticality ?? 'MEDIUM').toUpperCase(),
        }
      })
      .sort((a, b) => (a.eta_minutes ?? 1e9) - (b.eta_minutes ?? 1e9))
    if (!rows.length && sim.data?.risk_detail?.eta_table?.length) {
      return sim.data.risk_detail.eta_table
    }
    return rows
  }, [exposureState, sim.data])

  const lakeName = lakeList.find(l => l.id === lakeId)?.label ?? ''
  const observedArea = useMemo(() => lakes.filter(f => f.properties.lake_id === lakeId).sort((x, y) => y.properties.year - x.properties.year)[0]?.properties.area_km2 ?? null, [lakes, lakeId])

  return (
    <div ref={root} className="relative h-full w-full">
      <MapView ref={mapRef} lakeNow={now} rings={rings} scenarioLake={scenarioLake} flood={flood} exposure={exposureState} />

      {view === 'map' && (
        <>
          <div data-dock="left" className="panel absolute left-4 top-4 w-56 p-4 max-sm:right-4 max-sm:w-auto">
            <h1 className="display text-3xl">GlacierWatch</h1>
            <p className="eyebrow mb-3 mt-2">Pick a lake</p>
            <ul className="mb-4 space-y-1 max-sm:flex max-sm:flex-wrap max-sm:gap-1 max-sm:space-y-0">
              {lakeList.map(l => (
                <li key={l.id}>
                  <button onClick={() => selectLake(l.id)} aria-current={l.id === lakeId}
                    className={`w-full rounded px-2.5 py-1.5 text-left text-sm transition-colors ${l.id === lakeId ? 'bg-glacier font-semibold text-abyss' : 'text-ink hover:bg-paper-2'}`}>{l.label}</button>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-1.5 border-t border-rule pt-3 max-sm:flex-row max-sm:flex-wrap">
              <button className="btn btn-quiet justify-center" onClick={() => go('story')}>Replay the story</button>
              <button className="btn btn-quiet justify-center" onClick={() => go('detective')}>Data Detective</button>
              <button className="px-1 text-left text-xs text-ink-2 underline decoration-rule underline-offset-2 hover:text-ink" onClick={() => setCreditsOpen(true)}>Data and credits</button>
            </div>
          </div>

          <ActionCard lakeName={lakeName} deltaC={deltaC} years={years} onDelta={setDeltaC} onYears={setYears} sim={sim.data} baseQ={sim.baseQ}
            observedAreaKm2={observedArea} loading={sim.loading} error={sim.error}
            exposedCount={exposureState.filter(e => e.exposed).length}
            etaRows={dynamicEtaRows} />
          <Scrubber t={tl.t} min={yMin} max={yMax} playing={tl.playing} areaKm2={areaKm2} onChange={tl.setT} onToggle={tl.toggle} />

          <div className="panel absolute bottom-4 left-4 p-3 text-xs max-sm:hidden">
            <div className="mb-1 font-semibold">Breach scenario</div>
            {TIER_LEGEND.map(([c, l]) => (
              <div key={l} className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: c }} />{l}</div>
            ))}
          </div>
        </>
      )}

      {view === 'story' && <Scrollytelling lakes={lakes} exposure={exposure} onDetective={() => go('detective')} onMap={goMap} />}
      {view === 'detective' && <Detective lakes={lakes} onOpenMap={openOnMap} onClose={goMap} />}
      {creditsOpen && <Credits onClose={() => setCreditsOpen(false)} />}

      <div ref={curtain} className="pointer-events-none invisible fixed inset-0 z-[80] bg-abyss opacity-0" />
    </div>
  )
}