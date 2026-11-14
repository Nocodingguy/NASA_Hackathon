import math
from . import config as C
from .breach import froehlich, breach_height_m
from .exposure import get_exposure, canon

def _clip(x): return max(0.0, min(1.0, x))

def _rating(s):
    for t, name in C.RATING_THRESHOLDS:
        if s < t: return name
    return "Very High"

def _exposure_score(exp):
    if exp["exposure_source"] == "placeholder": return 0.5
    s = sum(C.CRITICALITY_WEIGHT.get(a["criticality"], 0.5) * C.TIER_WEIGHT.get(a["threat_tier"], 0.5)
            for a in exp["assets"])
    sat = 1 - math.exp(-s / 3)
    eta = exp["summary"]["min_eta_minutes"]
    ef = 0.4 if eta is None else (1.0 if eta <= 60 else 0.7 if eta <= 180 else 0.4)
    return 0.7 * sat + 0.3 * ef

def _action(rating, exp):
    names = [a["name"] for a in exp["assets"][:3] if a["name"]]
    who = f" Downstream communities first reached: {', '.join(names)}." if names else ""
    base = {"Low": "Continue routine satellite and field monitoring; review as conditions change.",
            "Moderate": "Increase monitoring frequency and review early-warning and evacuation-route readiness.",
            "High": "Prioritise a field survey of dam stability and outlet; check early-warning systems and brief downstream wards.",
            "Very High": "Escalate to district disaster authorities; prioritise lake-level control assessment, "
                         "tested warning systems and evacuation drills for downstream settlements."}[rating]
    return base + who

def assess(lake_id: str, volume_mcm: float, area_km2: float, base_volume_mcm: float, exposure_path=None) -> dict:
    lid = canon(lake_id)
    v, a = volume_mcm * 1e6, area_km2 * 1e6
    hb, hb_src = breach_height_m(lid, v, a)
    br = froehlich(v, hb, C.BREACH_MODE.get(lid, "overtopping"))
    exp = get_exposure(lid, exposure_path) if exposure_path else get_exposure(lid)
    sw = C.HAZARD_SUBWEIGHTS
    hz = (sw["peak_discharge"] * _clip((math.log10(br["peak_discharge_m3s"]) - C.HAZARD_RANGES["log10_qp"][0]) / C.HAZARD_RANGES["log10_qp"][1])
          + sw["volume"] * _clip((math.log10(v) - C.HAZARD_RANGES["log10_vol_m3"][0]) / C.HAZARD_RANGES["log10_vol_m3"][1])
          + sw["growth"] * _clip((volume_mcm / base_volume_mcm - 1) / C.HAZARD_GROWTH_FULL_SCALE))
    ex = _exposure_score(exp)
    vu = C.VULNERABILITY.get(lid, 0.5)
    w = C.AHP_WEIGHTS
    score = w["hazard"] * hz + w["exposure"] * ex + w["vulnerability"] * vu
    rating = _rating(score)
    return {"rating": rating, "score": round(score, 3),
            "components": {"hazard": round(hz, 3), "exposure": round(ex, 3), "vulnerability": vu},
            "weights": w, "breach": {**br, "height_source": hb_src},
            "action": _action(rating, exp), "exposure_source": exp["exposure_source"],
            "eta_table": [{k: x[k] for k in ("name", "asset_type", "eta_minutes", "distance_km", "criticality")}
                          for x in exp["assets"]],
            "disclaimer": C.DISCLAIMER}
