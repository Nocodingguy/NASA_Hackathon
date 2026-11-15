```markdown
# GlacierWatch

A susceptibility screening tool for glacial lake outburst floods (GLOFs) in the Nepal Himalaya.

Built in 48 hours for a NASA hackathon. This is a **screening tool**, not a forecast.

---

## What it does

- Shows how three glacial lakes (Imja, Tsho Rolpa, Thulagi) have grown from 1990 to the present using satellite imagery
- Tests climate trends with a plain-language “Data Detective”
- Lets you raise temperature and watch the flood path, risk rating, and downstream sites update live
- Displays recommended actions for officials based on the current risk level

---

## Quick Start

**Requirements:** Python 3.11+, Node.js 20+, [Mapbox access token](https://account.mapbox.com/)

### 1. Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1          # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```powershell
cd frontend
npm install
```

Create `frontend/.env`:

```
VITE_API_URL=http://localhost:8000
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

```powershell
npm run dev
```

Open http://localhost:5173

---

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `VITE_MAPBOX_TOKEN` | Yes | — | Mapbox token for the 3D map |
| `VITE_API_URL` | No | `http://localhost:8000` | Backend URL |

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Server status |
| `GET /api/lakes` | Lake list + area history |
| `GET /api/lakes/{id}/trends` | Temperature & precipitation trends |
| `GET /api/lakes/{id}/exposure` | Downstream sites |
| `POST /api/simulate` | Run a warming scenario |

Full interactive docs: http://localhost:8000/docs

---

## Project Structure

```
NASA_Hackathon/
├── backend/
│   ├── app/           FastAPI routes & models
│   ├── data/          Processed GeoJSON + live status
│   ├── pipelines/     Satellite & flood-zone pipelines
│   └── scripts/       Cache warmer
└── frontend/
    ├── public/data/   Static lake & flood files
    └── src/
        ├── story/     Scroll-driven intro
        ├── detective/ Data Detective panel
        ├── components/
        └── lib/       API client & helpers
```

---

## How the numbers work

- **Trends** — Modified Mann-Kendall + Theil-Sen on NASA POWER data (1985–2025)
- **Melt** — Positive degree-day model converts temperature rise → new lake volume
- **Peak flow** — Froehlich dam-breach equations
- **Risk rating** — AHP-weighted score of hazard + exposure + vulnerability (Low → Very High)

---

## Data Sources

| Source | Used for |
|--------|----------|
| NASA POWER | Temperature & precipitation |
| Landsat + Sentinel-2 | Lake outlines (1990–present) |
| Copernicus DEM | Terrain for flood zones |
| OpenStreetMap | Villages, bridges, hydropower |
| ICIMOD | Lake inventory & exposure figures |
| Mapbox | 3D basemap |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `WinError 10013` | Port in use → try `--port 8001` and update `VITE_API_URL` |
| Map shows setup message | Add `VITE_MAPBOX_TOKEN` to `.env` and restart |
| “Backend unreachable” | Start the backend, or check `VITE_API_URL` |
| First request is slow | Run `python -m scripts.warm_cache` once |

---

## Limitations

- Screening tool only — does not predict *when* a lake will burst
- Some inputs (glacier area, dam height, debris fraction) are placeholders
- Flood arrival times use a fixed wave-travel model
- Not a substitute for field surveys

---

## Credits

Data from NASA POWER, Landsat (NASA/USGS), Sentinel-2 (ESA), Copernicus DEM, OpenStreetMap, and ICIMOD.
```
