import { forwardRef } from 'react'
import Map, { Layer, Marker, Source, type MapRef } from 'react-map-gl/mapbox'
import type { ExpressionSpecification } from 'mapbox-gl'
import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { LakeProps } from '../types'
import type { ExposureFeature } from '../types'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

// Colour lakes by year: yellow (1986) -> cyan (2026)
const YEAR_RAMP: ExpressionSpecification = ['interpolate', ['linear'], ['get', 'year'], 1986, '#facc15', 2006, '#34d399', 2026, '#22d3ee']

const PEAKS = [
  { name: 'Everest', m: 8849, lon: 86.925, lat: 27.988 },
  { name: 'Lhotse', m: 8516, lon: 86.933, lat: 27.962 },
  { name: 'Makalu', m: 8485, lon: 87.089, lat: 27.890 },
  { name: 'Cho Oyu', m: 8188, lon: 86.661, lat: 28.094 },
  { name: 'Ama Dablam', m: 6812, lon: 86.861, lat: 27.862 },
  { name: 'Pumori', m: 7161, lon: 86.828, lat: 28.014 },
  { name: 'Gaurishankar', m: 7134, lon: 86.331, lat: 27.960 },
]

interface Props {
  lakeNow: FeatureCollection<Polygon, LakeProps & { op: number }>
  rings: FeatureCollection<LineString, LakeProps>
  scenarioLake: Feature<Polygon> | null
  flood: Feature<Polygon> | null
  exposure: { feature: ExposureFeature; exposed: boolean }[]
}

const MapView = forwardRef<MapRef, Props>(({ lakeNow, rings, scenarioLake, flood, exposure }, ref) => {
  if (!TOKEN) return (
    <div className="flex h-full items-center justify-center bg-slate-900 p-8 text-center text-slate-200">
      Set <code className="mx-1 rounded bg-slate-700 px-1">VITE_MAPBOX_TOKEN</code> in <code className="mx-1 rounded bg-slate-700 px-1">.env</code> and restart.
    </div>
  )
  return (
    <Map
      ref={ref}
      mapboxAccessToken={TOKEN}
      // Standard-Satellite supports layer slots ('bottom' | 'middle' | 'top'); 'middle' sits UNDER labels.
      mapStyle="mapbox://styles/mapbox/standard-satellite"
      projection="globe"
      minZoom={1}
      maxZoom={16}
      maxTileCacheSize={512}
      initialViewState={{ longitude: 86.48, latitude: 27.86, zoom: 12.5, pitch: 72, bearing: 200 }}
      maxPitch={70}
      terrain={{ source: 'mapbox-dem', exaggeration: 1.3 }}
      onLoad={e => e.target.setConfigProperty('basemap', 'showPointOfInterestLabels', false)}
      style={{ width: '100%', height: '100%' }}
    >
      <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14} />

      {/* Flood path: below labels, above terrain/imagery */}
      {flood && (
        <Source id="flood" type="geojson" data={flood}>
          <Layer id="flood-glow" type="line" slot="middle" layout={{ 'line-join': 'round' }}
            paint={{ 'line-color': '#ef4444', 'line-width': 14, 'line-blur': 10, 'line-opacity': 0.35, 'line-emissive-strength': 1 } as never} />
          <Layer id="flood-fill" type="fill" slot="middle"
            paint={{ 'fill-color': '#f87171', 'fill-opacity': 0.28, 'fill-emissive-strength': 1 } as never} />
          <Layer id="flood-line" type="line" slot="middle" layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': '#fecaca', 'line-width': 1.5, 'line-opacity': 0.9, 'line-emissive-strength': 1 } as never} />
        </Source>
      )}

      {/* Historical growth rings */}
      <Source id="rings" type="geojson" data={rings}>
        <Layer id="rings-line" type="line" slot="middle"
          paint={{ 'line-color': YEAR_RAMP, 'line-width': 1, 'line-opacity': 0.55, 'line-emissive-strength': 1 } as never} />
      </Source>

      {/* Lake at the playhead (cross-faded between years) */}
      <Source id="lake-now" type="geojson" data={lakeNow}>
        <Layer id="lake-fill" type="fill" slot="middle"
          paint={{ 'fill-color': YEAR_RAMP, 'fill-opacity': ['get', 'op'], 'fill-emissive-strength': 1 } as never} />
        <Layer id="lake-line" type="line" slot="middle"
          paint={{ 'line-color': '#ffffff', 'line-width': 1.5, 'line-opacity': ['get', 'op'], 'line-emissive-strength': 1 } as never} />
      </Source>

      {/* Projected lake under the temperature scenario */}
      {scenarioLake && (
        <Source id="lake-scenario" type="geojson" data={scenarioLake}>
          <Layer id="scenario-line" type="line" slot="middle"
            paint={{ 'line-color': '#f97316', 'line-width': 2.5, 'line-dasharray': [2, 1.5], 'line-emissive-strength': 1 } as never} />
        </Source>
      )}

      {/* Pulsing exposure markers (DOM, always above labels) */}
      {exposure.map(({ feature: f, exposed }) => {
        const [lon, lat] = f.geometry.coordinates
        const hydro = f.properties.kind === 'hydropower'
        return (
          <Marker key={f.properties.name} longitude={lon} latitude={lat} anchor="center">
            <div className="relative flex h-5 w-5 items-center justify-center"
              title={`${f.properties.name}${f.properties.population ? ` · ~${f.properties.population} people` : ''}${exposed ? ' · IN FLOOD PATH' : ''}`}>
              {exposed && <span className={`absolute inline-flex h-full w-full animate-ping opacity-75 ${hydro ? 'rounded-sm bg-amber-400' : 'rounded-full bg-red-500'}`} />}
              <span className={`relative inline-flex h-3.5 w-3.5 border-2 border-white ${hydro ? 'rounded-sm' : 'rounded-full'} ${exposed ? (hydro ? 'bg-amber-500' : 'bg-red-600') : 'bg-emerald-500'}`} />
            </div>
          </Marker>
        )
      })}
    </Map>
  )
})
export default MapView
