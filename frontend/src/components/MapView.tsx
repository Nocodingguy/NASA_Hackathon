import { forwardRef, useState } from 'react'
import Map, { Layer, Marker, Source, type MapRef } from 'react-map-gl/mapbox'
import type { ExpressionSpecification } from 'mapbox-gl'
import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { ExposureFeature, LakeProps } from '../types'


const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
const DEFAULT_STYLE = 'mapbox://styles/mapbox/outdoors-v12'

const YEAR_RAMP: ExpressionSpecification = ['interpolate', ['linear'], ['get', 'year'], 1986, '#facc15', 2006, '#34d399', 2026, '#22d3ee']
// Breach tiers: blue = low, amber = moderate, red = catastrophic. Severe drawn first (bottom), low last (top).
// Flood tier colors: lowercase values match api.ts
const TIER_COLOR: ExpressionSpecification = [
  'match',
  ['get', 'tier'],
  'low', '#3b82f6',
  'moderate', '#f59e0b',
  'severe', '#ef4444',
  '#9ca3af'
]

// Draw severe first, moderate second, low last
const TIER_ORDER: ExpressionSpecification = [
  'match',
  ['get', 'tier'],
  'severe', 0,
  'moderate', 1,
  'low', 2,
  3
]
// Approximate peak positions/heights - verify before presenting as fact.
const PEAKS = [
  { name: 'Everest', m: 8849, lon: 86.925, lat: 27.988 }, { name: 'Lhotse', m: 8516, lon: 86.933, lat: 27.962 },
  { name: 'Makalu', m: 8485, lon: 87.089, lat: 27.890 }, { name: 'Cho Oyu', m: 8188, lon: 86.661, lat: 28.094 },
  { name: 'Ama Dablam', m: 6812, lon: 86.861, lat: 27.862 }, { name: 'Pumori', m: 7161, lon: 86.828, lat: 28.014 },
  { name: 'Gaurishankar', m: 7134, lon: 86.331, lat: 27.960 },
]

const FOG = {
  color: 'rgb(186, 210, 235)', 'high-color': 'rgb(36, 92, 223)', 'horizon-blend': 0.03,
  'space-color': 'rgb(11, 11, 25)', 'star-intensity': 0.6
}

interface Props {
  lakeNow: FeatureCollection<Polygon, LakeProps & { op: number }>
  rings: FeatureCollection<LineString, LakeProps>
  scenarioLake: Feature<Polygon> | null
  flood: FeatureCollection<Polygon, { tier: string }> | null
  exposure: { feature: ExposureFeature; exposed: boolean }[]
  mapStyle?: string
  lakeLabel?: { name: string; lon: number; lat: number } | null
}

const MapView = forwardRef<MapRef, Props>(
  ({ lakeNow, rings, scenarioLake, flood, exposure, mapStyle = DEFAULT_STYLE, lakeLabel }, ref) => {
    const [zoom, setZoom] = useState(12.5)

    if (!TOKEN) return (
      <div className="flex h-full items-center justify-center bg-slate-900 p-8 text-center text-slate-200">
        Set <code className="mx-1 rounded bg-slate-700 px-1">VITE_MAPBOX_TOKEN</code> in <code className="mx-1 rounded bg-slate-700 px-1">.env</code> and restart.
      </div>
    )

    // Layer slots exist only in the Standard styles; elsewhere `slot` can hide the layer.
    const slot = mapStyle.includes('/standard') ? ({ slot: 'middle' } as const) : {}

    return (
      <Map ref={ref} mapboxAccessToken={TOKEN} mapStyle={mapStyle} projection="globe" fog={FOG}
        minZoom={1} maxZoom={16} maxPitch={70} maxTileCacheSize={512}
        initialViewState={{ longitude: 86.48, latitude: 27.86, zoom: 12.5, pitch: 62, bearing: 200 }}
        terrain={{ source: 'mapbox-dem', exaggeration: 1.3 }}
        onZoomEnd={e => setZoom(e.viewState.zoom)}
        style={{ width: '100%', height: '100%' }}>
        <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14} />

        {flood && (
          <Source id="flood" type="geojson" data={flood}>
            <Layer id="flood-fill" type="fill" {...slot} layout={{ 'fill-sort-key': TIER_ORDER } as never}
              paint={{ 'fill-color': TIER_COLOR, 'fill-opacity': 0.4, 'fill-emissive-strength': 1 } as never} />
            <Layer id="flood-line" type="line" {...slot} layout={{ 'line-join': 'round', 'line-sort-key': TIER_ORDER } as never}
              paint={{ 'line-color': TIER_COLOR, 'line-width': 2, 'line-opacity': 0.95, 'line-emissive-strength': 1 } as never} />
          </Source>
        )}

        <Source id="rings" type="geojson" data={rings}>
          <Layer id="rings-line" type="line" {...slot}
            paint={{ 'line-color': YEAR_RAMP, 'line-width': 1, 'line-opacity': 0.55, 'line-emissive-strength': 1 } as never} />
        </Source>

        <Source id="lake-now" type="geojson" data={lakeNow}>
          <Layer id="lake-glow" type="line" {...slot} layout={{ 'line-join': 'round' }}
            paint={{ 'line-color': '#22d3ee', 'line-width': 10, 'line-blur': 8, 'line-opacity': ['*', ['get', 'op'], 0.8], 'line-emissive-strength': 1 } as never} />
          <Layer id="lake-fill" type="fill" {...slot}
            paint={{ 'fill-color': YEAR_RAMP, 'fill-opacity': ['get', 'op'], 'fill-emissive-strength': 1 } as never} />
          <Layer id="lake-line" type="line" {...slot}
            paint={{ 'line-color': '#ffffff', 'line-width': 1.5, 'line-opacity': ['get', 'op'], 'line-emissive-strength': 1 } as never} />
        </Source>

        {scenarioLake && (
          <Source id="lake-scenario" type="geojson" data={scenarioLake}>
            <Layer id="scenario-line" type="line" {...slot}
              paint={{ 'line-color': '#f97316', 'line-width': 2.5, 'line-dasharray': [2, 1.5], 'line-emissive-strength': 1 } as never} />
          </Source>
        )}

        {zoom >= 9 && PEAKS.map(p => (
          <Marker key={p.name} longitude={p.lon} latitude={p.lat} anchor="bottom">
            <div className="pointer-events-none flex flex-col items-center drop-shadow">
              <span className="whitespace-nowrap rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">{p.name} · {p.m.toLocaleString()} m</span>
              <span className="h-0 w-0 border-x-[5px] border-b-[9px] border-x-transparent border-b-white" />
            </div>
          </Marker>
        ))}

        {lakeLabel && (
          <Marker longitude={lakeLabel.lon} latitude={lakeLabel.lat} anchor="bottom" offset={[0, -14]}>
            <div className="pointer-events-none whitespace-nowrap rounded-full bg-cyan-500 px-3 py-1 text-xs font-bold text-slate-900 shadow-lg">{lakeLabel.name}</div>
          </Marker>
        )}

        {exposure.map(({ feature: f, exposed }) => {
          const [lon, lat] = f.geometry.coordinates
          const { kind, name, population, eta_minutes } = f.properties
          const square = kind !== 'village'
          const hot = kind === 'hydropower' ? 'bg-amber-500' : kind === 'bridge' ? 'bg-orange-600' : 'bg-red-600'
          return (
            <Marker key={`${f.properties.lake_id}-${name}`} longitude={lon} latitude={lat} anchor="center">
              <div className="relative flex h-5 w-5 items-center justify-center"
                title={`${name}${population ? ` · ~${population} people` : ''}${eta_minutes ? ` · flood ETA ~${eta_minutes} min` : ''}${exposed ? ' · IN FLOOD PATH' : ''}`}>
                {exposed && <span className={`absolute inline-flex h-full w-full animate-ping opacity-75 ${square ? 'rounded-sm' : 'rounded-full'} ${hot}`} />}
                <span className={`relative inline-flex h-3.5 w-3.5 border-2 border-white ${square ? 'rounded-sm' : 'rounded-full'} ${exposed ? hot : 'bg-emerald-500'}`} />
              </div>
            </Marker>
          )
        })}
      </Map>
    )
  })
export default MapView
