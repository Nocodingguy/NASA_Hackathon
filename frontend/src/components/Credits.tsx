import Modal from './Modal'

const ROWS: [string, string, string][] = [
  ['NASA POWER', 'Daily air temperature (T2M) and precipitation (PRECTOTCORR), 1985 to 2025, at each lake. Drives the trend tests and the melt scenario.',
    'Data from the NASA Langley Research Center POWER Project, funded through the NASA Earth Science / Applied Science Program.'],
  ['Landsat Collection 2 Level-2', 'Lake outlines for 1990 to 2018 (NASA / USGS), read through the Microsoft Planetary Computer STAC API.', 'Courtesy of NASA / USGS.'],
  ['Sentinel-2 L2A', 'Lake outlines for 2016 onward (ESA).', 'Contains modified Copernicus Sentinel data.'],
  ['Copernicus DEM GLO-30', 'Terrain used to shape the downstream flood zones.', 'Produced using Copernicus WorldDEM-30, © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the EU and ESA.'],
  ['OpenStreetMap', 'Villages, bridges and hydropower sites in the flood path.', '© OpenStreetMap contributors, ODbL.'],
  ['Mapbox GL JS and terrain', '3D basemap and elevation.', '© Mapbox, © OpenStreetMap.'],
]

export default function Credits({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Data and credits" onClose={onClose}>
      <ul className="bullets mb-5 text-sm text-ink-2">
        <li>Everything on screen is built from open data.</li>
        <li>Peak flow uses Froehlich's dam-breach relations.</li>
        <li>The risk rating is a weighted hazard, exposure and vulnerability score (AHP).</li>
      </ul>
      <dl className="divide-y divide-rule border-y border-rule">
        {ROWS.map(([name, use, credit]) => (
          <div key={name} className="py-3">
            <dt className="font-semibold">{name}</dt>
            <dd className="mt-0.5 text-sm">{use}</dd>
            <dd className="mt-1 text-xs text-ink-2">{credit}</dd>
          </div>
        ))}
      </dl>
      <ul className="bullets mt-5 text-xs text-ink-2">
        <li>This is a susceptibility screening tool made during a 48-hour hackathon.</li>
        <li>
          Several model inputs (glacier area, debris fraction, dam condition) are placeholders and are listed in
          <code className="num mx-1 rounded bg-paper-2 px-1">backend/app/config.py</code>.
        </li>
        <li>It is not a forecast and not a substitute for field surveys.</li>
      </ul>
    </Modal>
  )
}
