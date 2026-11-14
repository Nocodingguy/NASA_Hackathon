from fastapi import APIRouter, HTTPException
from . import config as C
from .exposure import get_exposure, canon

router = APIRouter()

@router.get("/api/meta")
def meta():
    return {"disclaimer": C.DISCLAIMER, "data_sources": C.DATA_SOURCES,
            "assumptions": {"baseline_years": C.BASELINE_YEARS, "lapse_rate_c_per_km": C.LAPSE_RATE_C_PER_KM,
                "glacier_area_km2_PLACEHOLDER": C.GLACIER_AREA_KM2, "ddf_clean": C.DDF_CLEAN,
                "ddf_debris": C.DDF_DEBRIS, "debris_fraction": C.DEBRIS_FRACTION,
                "retain_fraction": C.RETAIN_FRACTION, "ahp_weights": C.AHP_WEIGHTS,
                "rating_thresholds": C.RATING_THRESHOLDS,
                "melt_pct_definition": "increase in annual melt vs baseline, not % of glacier"}}

@router.get("/api/lakes/{lake_id}/exposure")
def exposure(lake_id: str):
    e = get_exposure(lake_id)
    if e["exposure_source"] == "placeholder" and canon(lake_id) not in C.VULNERABILITY:
        raise HTTPException(404, "unknown lake_id")
    return e
