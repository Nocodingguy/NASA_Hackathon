# GlacierWatch

GlacierWatch is a susceptibility screening tool for glacial lake outburst floods (GLOFs) in the Nepal Himalaya. It reads satellite imagery and NASA climate data to show how three glacial lakes are changing, then lets you test a warmer climate and watch the flood path, the risk rating and the list of downstream sites respond.

It was built in 48 hours for a NASA hackathon. It is a screening tool, not a forecast.

## Why it matters

- A GLOF happens when the loose rock-and-ice wall holding back a glacial lake fails and the water runs down the valley.
- Warmer air melts more glacier ice, so the lakes grow and the wall carries more water.
- The number of people likely to be affected by the loss of resources from GLOFs is about 96,767 for Imja Lake, 141,911 for Tsho Rolpa Lake and 165,068 for Thulagi Lake (ICIMOD 2011).

## What you can do in the app

- Scroll through an animated story that follows the water from melting glacier to flooded village.
- Use the Data Detective to test whether a lake's temperature or rainfall is really trending, with a plain-language verdict.
- Open the 3D map and play the lake's growth from 1990 to the latest satellite pass.
- Move the temperature and duration sliders to see the flood band lengthen and widen, and the list of sites in its path update.
- Read the risk rating and the bulleted actions for officials at that risk level.

## Quick start

You need Python 3.11 or newer, Node.js 20 or newer, and a free [Mapbox access token](https://account.mapbox.com/).

### 1. Backend

Open PowerShell and run:

```powershell
cd C:\Users\Hp\Desktop\NASA_Hackathon\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

On macOS or Linux, activate with `source venv/bin/activate` instead.

Keep this window open. You should see `Uvicorn running on http://127.0.0.1:8000` and `Application startup complete`.

Optional: download the NASA POWER climate record for every lake once, so the demo does not depend on the live API.

```powershell
python -m scripts.warm_cache
```

### 2. Frontend

Open a second PowerShell window and run:

```powershell
cd C:\Users\Hp\Desktop\NASA_Hackathon\frontend
npm install
```

Create `frontend\.env` (copy `.env.example`) with your own values:

```
VITE_API_URL=http://localhost:8000
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

Then start the dev server:

```powershell
npm run dev
```

Open the address Vite prints, usually `http://localhost:5173`.

### Using a different backend port

If port 8000 is taken, start the backend on another port and point the frontend at it.

```powershell
uvicorn app.main:app --reload --port 8001
```

Set `VITE_API_URL=http://localhost:8001` in `frontend\.env`, then restart `npm run dev`.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `VITE_MAPBOX_TOKEN` | Yes | Public Mapbox token for the 3D map. Without it the map shows a setup message. |
| `VITE_API_URL` | No | Backend address. Defaults to `http://localhost:8000`. |
| `VITE_LAKES_URL` | No | Override the lake outlines file. Defaults to `/data/lakes_master.geojson`. |
| `VITE_FLOOD_URL` | No | Override the flood zones file. Defaults to `/data/flood_zones.geojson`. |

Restart `npm run dev` after changing `.env`.

## Project structure

```
NASA_Hackathon/
├── backend/
│   ├── app/                FastAPI server: melt, breach, risk, exposure, trends
│   ├── data/               lakes_master.geojson, flood_zones.geojson, live_nrt_status.json
│   ├── pipelines/          satellite and flood-zone data pipelines
│   ├── scripts/            warm_cache.py
│   └── requirements.txt
└── frontend/
    ├── public/data/        copies of the lake and flood files the browser loads
    └── src/
        ├── story/          scroll-driven opening story (GSAP)
        ├── detective/      Data Detective: trend tests and verdicts
        ├── components/     map, action card, gauge, scrubber
        ├── hooks/          scenario, timeline and fetch hooks
        └── lib/            API client, geometry, motion helpers
```

## Backend API

| Method and path | Returns |
|---|---|
| `GET /api/health` | Server status |
| `GET /api/meta` | Disclaimer, data sources and model assumptions |
| `GET /api/lakes` | Lakes with area history |
| `GET /api/lakes/live` | Near-real-time status for every lake |
| `GET /api/lakes/{lake_id}/live` | Near-real-time status for one lake |
| `GET /api/lakes/{lake_id}/trends` | Mann-Kendall trend tests on temperature and precipitation |
| `GET /api/lakes/{lake_id}/exposure` | Downstream sites with flood arrival times |
| `GET /api/flood-zones` | Flood zone polygons |
| `POST /api/simulate` | Warming scenario: new lake area, peak flow, risk rating and actions |

Interactive docs are at `http://localhost:8000/docs` while the backend runs.

## Data pipelines

The repository already includes processed data, so you do not need to run these to use the app. Run them from the `backend` folder with the virtual environment active.

```powershell
python pipelines/extract_lakes.py
python pipelines/flood_Areas.py
python pipelines/nrt_monitor.py
```

- `extract_lakes.py` finds each lake's outline from Landsat and Sentinel-2 scenes through the Microsoft Planetary Computer and writes `backend/data/lakes_master.geojson`.
- `flood_Areas.py` builds the flood zones, the river path and the downstream sites and writes `flood_zones.geojson`.
- `nrt_monitor.py` checks the freshest satellite passes for sudden lake changes and writes `live_nrt_status.json`.

After a pipeline changes a data file, copy `lakes_master.geojson` and `flood_zones.geojson` into `frontend/public/data/` and restart the backend. The backend reads these files once at startup, and `--reload` only watches `.py` files.

### Why lake extraction is adaptive

- Glacial lakes in the Himalaya do not follow a one-size-fits-all calendar.
- Imja Tsho sits at 5,010 m under the Lhotse face and Thulagi at 4,044 m, so freezing dates and mountain shadow angles differ by weeks.
- The pipeline tries candidate scenes across several satellite passes and keeps the first one that gives a plausible liquid water surface for that lake, before seasonal freeze-over.

## How the numbers are made

- **Climate trends:** modified Mann-Kendall test (Hamed-Rao) and Theil-Sen slope on yearly NASA POWER temperature and precipitation, 1985 to 2025.
- **Melt scenario:** positive degree-days turn a temperature rise into meltwater, which becomes a new lake volume and area.
- **Peak flow:** Froehlich dam-breach relations.
- **Risk rating:** a weighted hazard, exposure and vulnerability score (AHP), shown as Low, Moderate, High or Very High.
- **Flood band:** drawn along the real river path. It grows longer and wider as peak flow rises, and a site counts as in the flood path only if the band reaches it.

## Data sources

| Source | Used for |
|---|---|
| NASA POWER | Daily air temperature and precipitation |
| Landsat Collection 2 Level-2 (NASA and USGS) | Lake outlines, 1990 to 2018 |
| Sentinel-2 L2A (ESA) | Lake outlines, 2016 onward |
| Copernicus DEM GLO-30 | Terrain for the flood zones |
| OpenStreetMap | Villages, bridges and hydropower sites |
| ICIMOD | Glacial lake inventory and exposure figures |
| Mapbox GL JS | 3D basemap and terrain |

## Troubleshooting

- **`WinError 10013` when starting the backend:** another copy is already using the port. Stop it, or start on another port as described above. To find it:
  ```powershell
  netstat -ano | findstr :8000
  taskkill /PID <number from the last column> /F
  ```
- **The map shows a setup message:** `VITE_MAPBOX_TOKEN` is missing from `frontend\.env`. Add it and restart `npm run dev`.
- **"Backend unreachable" in the app:** the backend is not running, or `VITE_API_URL` points at the wrong port.
- **The first request for a lake is slow:** the backend is downloading its NASA POWER record. Run `python -m scripts.warm_cache` once to avoid this.
- **Lake sizes or flood band look wrong:** make sure both copies of `lakes_master.geojson` and `flood_zones.geojson` match (`backend/data` and `frontend/public/data`), restart the backend, then hard-refresh the browser.

## Limitations

- This is a susceptibility ranking, not a prediction of when a lake will burst.
- Several model inputs (glacier area, debris fraction, dam height and condition) are placeholders. They are marked `PLACEHOLDER` in `backend/app/config.py`.
- Flood arrival times come from a fixed wave-travel model. Only which sites are in the flood path changes with the sliders.
- It is not a substitute for field surveys.

## Credits

- Data from the NASA Langley Research Center POWER Project, funded through the NASA Earth Science / Applied Science Program.
- Landsat data courtesy of NASA and USGS. Contains modified Copernicus Sentinel data.
- Produced using Copernicus WorldDEM-30, provided under COPERNICUS by the EU and ESA.
- Map data from OpenStreetMap contributors (ODbL) and Mapbox.
