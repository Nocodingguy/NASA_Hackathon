from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import json
from pathlib import Path

from .lakes import LAKES
from .power import fetch_power
from .trends import analyze
from .exposure import canon
from .routes_extra import router as extra_router
from .simulate import simulate as run_simulation
from .nrt import load_nrt_data, get_lake_live_assessment, FLOOD_ZONES_FILE

app = FastAPI(title="GlacierWatch API", version="2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(extra_router)


def get_lake(lake_id: str):
    lid = canon(lake_id)
    if lid not in LAKES:
        raise HTTPException(404, "unknown lake")
    return lid, LAKES[lid]


@app.get("/api/health")
def health():
    return {"status": "ok", "lakes": len(LAKES)}


@app.get("/api/lakes")
def lakes():
    """Returns all lakes enriched with their current live risk rating and metrics."""
    out = []
    for lid, lk in LAKES.items():
        item = dict(lk)
        live = get_lake_live_assessment(lid)
        if live:
            item["risk"] = live["live_risk"]["rating"]
            item["current_area_km2"] = live["observed_metrics"]["surface_area_km2"]
            item["current_volume_mcm"] = live["observed_metrics"]["estimated_volume_mcm"]
            item["peak_discharge_m3s"] = live["live_risk"]["peak_discharge_m3s"]
        out.append(item)
    return out


@app.get("/api/lakes/live")
def all_lakes_live():
    """Serves Near-Real-Time satellite monitoring feed across all lakes."""
    return load_nrt_data()


@app.get("/api/lakes/{lake_id}/live")
def single_lake_live(lake_id: str):
    """Combines latest satellite pass telemetry with real-time Froehlich breach discharge and AHP risk rating."""
    live = get_lake_live_assessment(lake_id)
    if not live:
        raise HTTPException(404, "unknown lake_id")
    return live


@app.get("/api/flood-zones")
def flood_zones():
    """Serves downstream flood tiers and exposed infrastructure directly to frontend maps."""
    if not FLOOD_ZONES_FILE.exists():
        raise HTTPException(404, "flood_zones.geojson not found")
    with open(FLOOD_ZONES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/lakes/{lake_id}/trends")
def trends(lake_id: str):
    lid, lk = get_lake(lake_id)
    d = fetch_power(lid, lk["lat"], lk["lon"])
    return {
        "lake_id": lid,
        "t2m": analyze(d["T2M"], "mean", "°C"),
        "precip": analyze(d["PRECTOTCORR"], "sum", "mm"),
    }


class SimRequest(BaseModel):
    lake_id: str
    temp_delta_c: float = Field(ge=0, le=6)
    scenario_years: int = Field(default=30, ge=1, le=100)


@app.post("/api/simulate")
def simulate(req: SimRequest):
    lid, lk = get_lake(req.lake_id)
    try:
        return run_simulation(lk, lid, req.temp_delta_c, req.scenario_years)
    except Exception as e:
        raise HTTPException(503, f"simulation failed: {type(e).__name__}: {e}")