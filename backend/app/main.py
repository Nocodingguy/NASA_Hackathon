from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .lakes import LAKES
from .power import fetch_power
from .trends import analyze

app = FastAPI(title="GlacierWatch API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def get_lake(lake_id):
    if lake_id not in LAKES:
        raise HTTPException(404, "unknown lake")
    return LAKES[lake_id]

@app.get("/api/health")
def health():
    return {"status": "ok", "lakes": len(LAKES)}

@app.get("/api/lakes")
def lakes():
    return list(LAKES.values())

@app.get("/api/lakes/{lake_id}/trends")
def trends(lake_id: str):
    lk = get_lake(lake_id)
    d = fetch_power(lake_id, lk["lat"], lk["lon"])
    return {"lake_id": lake_id,
            "t2m": analyze(d["T2M"], "mean", "°C"),
            "precip": analyze(d["PRECTOTCORR"], "sum", "mm")}

class SimRequest(BaseModel):
    lake_id: str
    temp_delta_c: float
    scenario_years: int = 30

@app.post("/api/simulate")          # PLACEHOLDER: real melt model comes next
def simulate(req: SimRequest):
    lk = get_lake(req.lake_id)
    melt_pct = round(req.temp_delta_c * 8.5, 1)
    risk = ("Low" if req.temp_delta_c < 1 else "Moderate" if req.temp_delta_c < 2
            else "High" if req.temp_delta_c < 3 else "Very High")
    return {"lake_id": req.lake_id, "melt_pct": melt_pct,
            "new_area_km2": round(lk["area_km2"] * (1 + melt_pct / 100), 3),
            "added_volume_m3": 0, "peak_discharge_m3s": 0, "risk": risk,
            "action": "PLACEHOLDER", "disclaimer": "Susceptibility ranking, not a prediction of when a lake will burst."}