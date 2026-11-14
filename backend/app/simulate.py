from functools import lru_cache
import pandas as pd
from . import config as C
from .power import fetch_power
from .melt import run_melt, area_to_vol_m3
from .risk import assess

@lru_cache(maxsize=8)
def daily_t2m(lake_id, lat, lon):
    d = fetch_power(lake_id, lat, lon)["T2M"]
    s = pd.Series(d)
    s.index = pd.to_datetime(s.index.astype(str), format="%Y%m%d")
    return s.where(s > -900).dropna().astype(float)

def simulate(lk, lake_id, dT, years):
    base_vol = area_to_vol_m3(lk["area_km2"] * 1e6) / 1e6          # mcm, Huggel (matches M1 estimates)
    m = run_melt(daily_t2m(lake_id, lk["lat"], lk["lon"]), base_vol, dT, years)
    a = assess(lake_id, m["new_volume_mcm"], m["new_area_km2"], base_vol)
    return {"lake_id": lake_id, "melt_pct": m["melt_pct"], "new_area_km2": m["new_area_km2"],
            "added_volume_m3": m["added_volume_m3"], "peak_discharge_m3s": a["breach"]["peak_discharge_m3s"],
            "risk": a["rating"], "action": a["action"], "disclaimer": C.DISCLAIMER,
            # additive keys below (M3/M4 may ignore)
            "new_volume_mcm": m["new_volume_mcm"], "details": m["details"], "risk_detail": a}