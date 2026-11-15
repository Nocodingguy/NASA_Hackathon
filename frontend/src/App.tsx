
import { useEffect, useMemo, useRef, useState } from 'react'

import type { MapRef } from 'react-map-gl/mapbox'
import type { Feature, Polygon } from 'geojson'

import MapView from './components/MapView'
import Scrubber from './components/Scrubber'
import ActionCard from './components/ActionCard'
import Credits from './components/Credits'
import Detective from './detective/Detective'

import { useTimeline } from './hooks/useTimeline'
import { useScenario, useSmooth } from './hooks/useScenario'

import {
  loadExposure,
  loadFloods,
  loadLakes
} from './lib/api'

import { YEAR_MAX, YEAR_MIN } from './lib/demoData'

import {
  centroid,
  inPolygon,
  mainAxis,
  scalePolygon
} from './lib/geo'

import { lakeAt } from './lib/timeline'

import type {
  ExposureFeature,
  FloodFeature,
  LakeFeature
} from './types'

const K_ACROSS = 0.4
const K_ALONG = 0.15

const TIER_LEGEND: [string, string][] = [
  ['#3b82f6', 'Tier 1 · Low breach'],
  ['#f59e0b', 'Tier 2 · Moderate breach'],
  ['#ef4444', 'Tier 3 · Catastrophic collapse']
]

export default function App() {
  const mapRef = useRef<MapRef>(null)

  const [lakeId, setLakeId] = useState('')
  const [lakes, setLakes] = useState<LakeFeature[]>([])
  const [floods, setFloods] = useState<FloodFeature[]>([])
  const [exposure, setExposure] = useState<ExposureFeature[]>([])

  const [deltaC, setDeltaC] = useState(1.5)
  const [years, setYears] = useState(30)

  const [detectiveOpen, setDetectiveOpen] = useState(true)
  const [creditsOpen, setCreditsOpen] = useState(false)

  // ---------------- LAKE LIST ----------------

  const lakeList = useMemo(() => {
    const byId = new Map<string, LakeFeature>()

    for (const feature of lakes) {
      const id = feature.properties.lake_id
      const current = byId.get(id)

      if (
        !current ||
        feature.properties.year > current.properties.year
      ) {
        byId.set(id, feature)
      }
    }

    return [...byId.entries()].map(([id, feature]) => ({
      id,
      label: feature.properties.lake_name ?? id,
      center: centroid(feature.geometry) as [number, number]
    }))
  }, [lakes])

  // ---------------- LAKE SELECTION ----------------

  const selectLake = (id: string) => {
    setLakeId(id)

    const lake = lakeList.find(item => item.id === id)

    if (lake) {
      mapRef.current?.flyTo({
        center: lake.center,
        zoom: 12.5,
        bearing: 200,
        pitch: 62,
        duration: 3500,
        essential: true
      })
    }
  }

  // Data Detective can open a selected lake
  // and optionally set its temperature scenario.

  const openOnMap = (id: string, delta?: number) => {
    selectLake(id)

    if (delta != null) {
      setDeltaC(delta)
    }

    setDetectiveOpen(false)
  }

  // ---------------- TIMELINE ----------------

  const epochYears = useMemo(
    () =>
      lakes
        .filter(feature =>
          feature.properties.lake_id === lakeId
        )
        .map(feature => feature.properties.year),

    [lakes, lakeId]
  )

  const yMin = epochYears.length
    ? Math.min(...epochYears)
    : YEAR_MIN

  const yMax = epochYears.length
    ? Math.max(...epochYears)
    : YEAR_MAX

  const timeline = useTimeline(yMin, yMax)

  useEffect(() => {
    timeline.setT(yMax)
  }, [yMax, lakeId])

  // ---------------- LOAD GEOJSON DATA ----------------

  useEffect(() => {
    let active = true

    async function loadData() {
      try {
        const [lakeData, floodData, exposureData] =
          await Promise.all([
            loadLakes(),
            loadFloods(),
            loadExposure()
          ])

        if (!active) return

        setLakes(lakeData.features)
        setFloods(floodData)
        setExposure(exposureData)
      } catch (error) {
        console.error('[GLOF] Data loading failed:', error)
      }
    }

    loadData()

    return () => {
      active = false
    }
  }, [])

  // Select the first available lake automatically.

  useEffect(() => {
    if (!lakeId && lakeList.length > 0) {
      setLakeId(lakeList[0].id)
    }
  }, [lakeList, lakeId])

  // ---------------- SIMULATION ----------------

  const sim = useScenario(
    lakeId,
    deltaC,
    years
  )

  const {
    now,
    rings,
    areaKm2
  } = useMemo(
    () => lakeAt(lakes, lakeId, timeline.t),
    [lakes, lakeId, timeline.t]
  )

  // Smoothly animate the flood scaling.

  const q0 = sim.baseQ
  const q1 = sim.data?.risk_detail.breach.peak_discharge_m3s

  const ratio = useSmooth(
    q0 && q1
      ? q1 / q0
      : 1 + 0.12 * deltaC
  )

  // ---------------- FLOOD VISUALIZATION ----------------

  const floodTiers = useMemo(() => {
    const center = lakeList.find(
      lake => lake.id === lakeId
    )?.center

    return floods
      .filter(feature =>
        feature.properties.lake_id === lakeId
      )
      .flatMap(feature => {
        const origin = feature.properties.origin ?? center

        if (!origin) return []

        const geometry = scalePolygon(
          feature.geometry,
          origin,
          Math.pow(ratio, K_ALONG),
          Math.pow(ratio, K_ACROSS),
          mainAxis(feature.geometry, origin)
        )

        return [{
          type: 'Feature' as const,

          properties: {
            tier: feature.properties.tier ?? 'Unknown'
          },

          geometry
        }]
      })
  }, [floods, lakeId, ratio, lakeList])

  const floodFC = useMemo(
    () =>
      floodTiers.length
        ? {
          type: 'FeatureCollection' as const,
          features: floodTiers
        }
        : null,

    [floodTiers]
  )

  // ---------------- FUTURE LAKE SCENARIO ----------------

  const scenarioLake = useMemo<
    Feature<Polygon> | null
  >(() => {
    const latest = lakes
      .filter(feature =>
        feature.properties.lake_id === lakeId
      )
      .sort(
        (a, b) =>
          b.properties.year - a.properties.year
      )[0]

    if (!latest || !sim.data || deltaC === 0) {
      return null
    }

    const newArea = sim.data.new_area_km2

    if (
      !Number.isFinite(newArea) ||
      latest.properties.area_km2 <= 0
    ) {
      return null
    }

    const scale = Math.sqrt(
      newArea / latest.properties.area_km2
    )

    return {
      type: 'Feature',
      properties: {},

      geometry: scalePolygon(
        latest.geometry,
        centroid(latest.geometry),
        scale,
        scale
      )
    }
  }, [lakes, lakeId, sim.data, deltaC])

  // ---------------- EXPOSED INFRASTRUCTURE ----------------

  const exposureState = useMemo(
    () =>
      exposure
        .filter(feature =>
          feature.properties.lake_id === lakeId
        )
        .map(feature => ({
          feature,

          exposed: floodTiers.some(tier =>
            inPolygon(
              feature.geometry.coordinates,
              tier.geometry
            )
          )
        })),

    [exposure, lakeId, floodTiers]
  )

  // ---------------- CURRENT LAKE ----------------

  const current = lakeList.find(
    lake => lake.id === lakeId
  )

  const lakeName = current?.label ?? ''

  const lakeLabel = current
    ? {
      name: current.label,
      lon: current.center[0],
      lat: current.center[1]
    }
    : null

  const observedArea =
    lakes
      .filter(feature =>
        feature.properties.lake_id === lakeId
      )
      .sort(
        (a, b) =>
          b.properties.year - a.properties.year
      )[0]?.properties.area_km2 ?? null

  // ---------------- RENDER ----------------

  return (
    <div className="relative h-full w-full">

      {/* 3D MAP */}

      <MapView
        ref={mapRef}
        lakeNow={now}
        rings={rings}
        scenarioLake={scenarioLake}
        flood={floodFC}
        exposure={exposureState}
        lakeLabel={lakeLabel}
      />

      {/* LAKE SELECTOR */}

      <div className="absolute left-4 top-4 rounded-xl bg-slate-900/85 p-3 text-slate-100 shadow-xl backdrop-blur">

        <h1 className="mb-2 text-sm font-bold tracking-wide">
          GLOF ATLAS · HIMALAYA
        </h1>

        <div className="flex flex-col gap-1">

          {lakeList.map(lake => (
            <button
              key={lake.id}
              onClick={() => selectLake(lake.id)}
              aria-current={
                lake.id === lakeId ? 'true' : undefined
              }
              className={`rounded px-2 py-1.5 text-left text-sm ${lake.id === lakeId
                ? 'bg-white/20 font-semibold'
                : 'hover:bg-white/10'
                }`}
            >
              {lake.label}
            </button>
          ))}

        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-white/20 pt-3">

          <button
            className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
            onClick={() => setDetectiveOpen(true)}
          >
            Data Detective
          </button>

          <button
            className="px-1 text-left text-xs text-slate-300 underline hover:text-white"
            onClick={() => setCreditsOpen(true)}
          >
            Data and credits
          </button>

        </div>
      </div>

      {/* CLIMATE SIMULATION AND RISK ASSESSMENT */}

      <ActionCard
        lakeName={lakeName}
        deltaC={deltaC}
        years={years}
        onDelta={setDeltaC}
        onYears={setYears}
        sim={sim.data}
        baseQ={sim.baseQ}
        observedAreaKm2={observedArea}
        loading={sim.loading}
        error={sim.error}
        exposedCount={
          exposureState.filter(item => item.exposed).length
        }
      />

      {/* HISTORICAL TIMELINE */}

      <Scrubber
        t={timeline.t}
        min={yMin}
        max={yMax}
        playing={timeline.playing}
        areaKm2={areaKm2}
        onChange={timeline.setT}
        onToggle={timeline.toggle}
      />

      {/* BREACH TIER LEGEND */}

      <div className="absolute bottom-4 left-4 rounded-xl bg-slate-900/85 p-3 text-xs text-slate-100 shadow-xl backdrop-blur">

        <div className="mb-1 font-semibold">
          Breach scenario
        </div>

        {TIER_LEGEND.map(([color, label]) => (
          <div
            key={label}
            className="flex items-center gap-2"
          >
            <span
              className="h-3 w-3 rounded-sm"
              style={{ background: color }}
            />

            {label}
          </div>
        ))}

      </div>

      {/* DATA DETECTIVE */}

      {detectiveOpen && (
        <Detective
          lakes={lakes}
          onOpenMap={openOnMap}
          onClose={() => setDetectiveOpen(false)}
        />
      )}

      {/* DATA CREDITS */}

      {creditsOpen && (
        <Credits
          onClose={() => setCreditsOpen(false)}
        />
      )}

    </div>
  )
}
