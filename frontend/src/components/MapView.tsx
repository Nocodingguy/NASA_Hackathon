import { forwardRef, useState } from 'react'
import Map, { Layer, Marker, Source, type MapRef } from 'react-map-gl/mapbox'
import type { ExpressionSpecification } from 'mapbox-gl'
import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { LakeProps } from '../types'
import type { ExposureFeature } from '../types'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

const DEFAULT_STYLE = 'mapbox://styles/mapbox/outdoors-v12'

const YEAR_RAMP: ExpressionSpecification = ['interpolate', ['linear'], ['get', 'year'], 1986, '#ffd166', 2006, '#7ee0c3', 2026, '#6fd0e6']

const PEAKS = [
  { name: 'Everest', m: 8849, lon: 86.925, lat: 27.988 },
  { name: 'Lhotse', m: 8516, lon: 86.933, lat: 27.962 },
  { name: 'Makalu', m: 8485, lon: 87.089, lat: 27.890 },
  { name: 'Cho Oyu', m: 8188, lon: 86.661, lat: 28.094 },
  { name: 'Ama Dablam', m: 6812, lon: 86.861, lat: 27.862 },
  { name: 'Pumori', m: 7161, lon: 86.828, lat: 28.014 },
  { name: 'Gaurishankar', m: 7134, lon: 86.331, lat: 27.960 },
]

const FOG = {
  color: 'rgb(226, 236, 243)',
  'high-color': 'rgb(132, 178, 224)',
  'horizon-blend': 0.05,
  'space-color': 'rgb(196, 216, 232)',
  'star-intensity': 0,
}

interface Props {
  lakeNow: FeatureCollection<Polygon, LakeProps & { op: number }>
  rings: FeatureCollection<LineString, LakeProps>
  scenarioLake: Feature<Polygon> | null
  flood: Feature<Polygon> | null
  exposure: { feature: ExposureFeature; exposed: boolean }[]
  mapStyle?: string
  lakeLabel?: { name: string; lon: number; lat: number } | null
}

const MapView = forwardRef<MapRef, Props>(
  ({ lakeNow, rings, scenarioLake, flood, exposure, mapStyle = DEFAULT_STYLE, lakeLabel }, ref) => {
    const [zoom, setZoom] = useState(12.5)

    if (!TOKEN) return (
      <div className="flex h-full items-center justify-center bg-[#e9f1f4] p-8 text-center text-[#51697a]">
        Set <code className="num mx-1.5 rounded bg-white px-1.5 py-0.5 text-[#0b2230]">VITE_MAPBOX_TOKEN</code> in <code className="num mx-1.5 rounded bg-white px-1.5 py-0.5 text-[#0b2230]">.env</code> and restart.
      </div>
    )

    const slot = mapStyle.includes('/standard') ? ({ slot: 'middle' } as const) : {}

    return (
      <Map
        ref={ref}
        mapboxAccessToken={TOKEN}
        mapStyle={mapStyle}
        projection="globe"
        fog={FOG}
        minZoom={1}
        maxZoom={16}
        maxPitch={70}
        maxTileCacheSize={512}
        initialViewState={{ longitude: 86.48, latitude: 27.86, zoom: 12.5, pitch: 62, bearing: 200 }}
        terrain={{ source: 'mapbox-dem', exaggeration: 1.3 }}
        onZoomEnd={e => setZoom(e.viewState.zoom)}
        style={{ width: '100%', height: '100%' }}
      >
        <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14} />

        {flood && (
          <Source id="flood" type="geojson" data={flood}>
            <Layer id="flood-glow" type="line" {...slot} layout={{ 'line-join': 'round' }}
              paint={{ 'line-color': '#ff5a3c', 'line-width': 16, 'line-blur': 12, 'line-opacity': 0.4, 'line-emissive-strength': 1 } as never} />
            <Layer id="flood-fill" type="fill" {...slot}
              paint={{ 'fill-color': '#ff6a45', 'fill-opacity': 0.3, 'fill-emissive-strength': 1 } as never} />
            <Layer id="flood-line" type="line" {...slot} layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{ 'line-color': '#ffd0c2', 'line-width': 1.25, 'line-opacity': 0.85, 'line-emissive-strength': 1 } as never} />
          </Source>
        )}

        <Source id="rings" type="geojson" data={rings}>
          <Layer id="rings-line" type="line" {...slot}
            paint={{ 'line-color': YEAR_RAMP, 'line-width': 1, 'line-opacity': 0.6, 'line-emissive-strength': 1 } as never} />
        </Source>

        <Source id="lake-now" type="geojson" data={lakeNow}>
          <Layer id="lake-glow" type="line" {...slot} layout={{ 'line-join': 'round' }}
            paint={{ 'line-color': '#6fd0e6', 'line-width': 10, 'line-blur': 8, 'line-opacity': ['*', ['get', 'op'], 0.7], 'line-emissive-strength': 1 } as never} />
          <Layer id="lake-fill" type="fill" {...slot}
            paint={{ 'fill-color': YEAR_RAMP, 'fill-opacity': ['*', ['get', 'op'], 0.85], 'fill-emissive-strength': 1 } as never} />
          <Layer id="lake-line" type="line" {...slot}
            paint={{ 'line-color': '#083344', 'line-width': 1.5, 'line-opacity': ['get', 'op'], 'line-emissive-strength': 1 } as never} />
        </Source>

        {scenarioLake && (
          <Source id="lake-scenario" type="geojson" data={scenarioLake}>
            <Layer id="scenario-line" type="line" {...slot}
              paint={{ 'line-color': '#ff9a3c', 'line-width': 2.25, 'line-dasharray': [2, 1.5], 'line-emissive-strength': 1 } as never} />
          </Source>
        )}

        {zoom >= 9 && PEAKS.map(p => (
          <Marker key={p.name} longitude={p.lon} latitude={p.lat} anchor="bottom">
            <div className="pointer-events-none flex flex-col items-center">
              <span className="whitespace-nowrap rounded-full border border-black/10 bg-white/85 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#0b2230] shadow-sm backdrop-blur-md">
                {p.name} <span className="num text-[#51697a]">{p.m.toLocaleString()} m</span>
              </span>
              <span className="h-2 w-px bg-[#0b2230]/50" />
            </div>
          </Marker>
        ))}

        {lakeLabel && (
          <Marker longitude={lakeLabel.lon} latitude={lakeLabel.lat} anchor="bottom" offset={[0, -14]}>
            <div className="pointer-events-none whitespace-nowrap rounded-full bg-glacier px-3.5 py-1 text-xs font-bold text-abyss shadow-lg">
              {lakeLabel.name}
            </div>
          </Marker>
        )}

        {exposure.map(({ feature: f, exposed }) => {
          const [lon, lat] = f.geometry.coordinates
          const hydro = f.properties.kind === 'hydropower'
          return (
            <Marker key={f.properties.name} longitude={lon} latitude={lat} anchor="center">
              <div className="relative flex h-5 w-5 items-center justify-center"
                title={`${f.properties.name}${f.properties.population ? ` · ~${f.properties.population} people` : ''}${exposed ? ' · IN FLOOD PATH' : ''}`}>
                {exposed && <span className={`absolute inline-flex h-full w-full animate-ping opacity-60 ${hydro ? 'rounded-sm bg-r-high' : 'rounded-full bg-r-vhigh'}`} />}
                <span className={`relative inline-flex h-3 w-3 border-[1.5px] border-white shadow-md ${hydro ? 'rounded-sm' : 'rounded-full'} ${exposed ? (hydro ? 'bg-r-high' : 'bg-r-vhigh') : 'bg-r-low'}`} />
              </div>
            </Marker>
          )
        })}
      </Map>
    )
  })
export default MapView
