from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from .lakes import LAKES
from .power import fetch_power
from .trends import analyze
from .exposure import canon
from .routes_extra import router as extra_router
from .simulate import simulate as run_simulation

app = FastAPI(title="GlacierWatch API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(extra_router)

def get_lake(lake_id):
    lid = canon(lake_id)               # accepts imja_tsho / thulagi_lake aliases
    if lid not in LAKES:
        raise HTTPException(404, "unknown lake")
    return lid, LAKES[lid]

@app.get("/api/health")
def health():
    return {"status": "ok", "lakes": len(LAKES)}

@app.get("/api/lakes")
def lakes():
    return list(LAKES.values())

@app.get("/api/lakes/{lake_id}/trends")
def trends(lake_id: str):
    lid, lk = get_lake(lake_id)
    d = fetch_power(lid, lk["lat"], lk["lon"])
    return {"lake_id": lid,
            "t2m": analyze(d["T2M"], "mean", "°C"),
            "precip": analyze(d["PRECTOTCORR"], "sum", "mm")}

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
    