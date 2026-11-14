import pandas as pd
from . import config as C

def vol_to_area_m2(v_m3): return (v_m3 / C.HUGGEL_A) ** (1 / C.HUGGEL_B)
def area_to_vol_m3(a_m2): return C.HUGGEL_A * a_m2 ** C.HUGGEL_B

def _annual_pdd(daily: pd.Series, dT: float) -> float:
    """Mean annual positive degree-days at glacier elevation (baseline years)."""
    y0, y1 = C.BASELINE_YEARS
    s = daily[(daily.index.year >= y0) & (daily.index.year <= y1)]
    shift = dT - C.LAPSE_RATE_C_PER_KM * (C.GLACIER_MEAN_ELEV_M - C.POWER_GRID_ELEV_M) / 1000
    return float((s + shift).clip(lower=0).sum()) / (y1 - y0 + 1)

def run_melt(daily: pd.Series, base_volume_mcm: float, temp_delta_c: float,
             scenario_years: int = 30, glacier_area_km2: float = None) -> dict:
    """daily: T2M degC Series with DatetimeIndex."""
    A = (glacier_area_km2 or C.GLACIER_AREA_KM2) * 1e6
    pdd0, pdd1 = _annual_pdd(daily, 0.0), _annual_pdd(daily, temp_delta_c)
    out = {}
    for k in ("low", "central", "high"):
        ddf = ((1 - C.DEBRIS_FRACTION) * C.DDF_CLEAN[k] + C.DEBRIS_FRACTION * C.DDF_DEBRIS[k]) / 1000  # m w.e.
        melt0, melt1 = ddf * pdd0 * A, ddf * pdd1 * A
        added = (melt1 - melt0) * scenario_years * C.RETAIN_FRACTION[k]
        v_new = base_volume_mcm * 1e6 + added
        out[k] = {"added_volume_m3": round(added, 1),
                  "melt_pct": round(100 * (melt1 / melt0 - 1), 2) if melt0 else 0.0,
                  "new_volume_mcm": round(v_new / 1e6, 3),
                  "new_area_km2": round(vol_to_area_m2(v_new) / 1e6, 4)}
    return {**out["central"], "details": {"assumptions": "see config.py (placeholders flagged)",
            "scenarios": out, "baseline_years": list(C.BASELINE_YEARS)}}