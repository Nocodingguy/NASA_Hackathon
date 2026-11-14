import json, re
from functools import lru_cache
from pathlib import Path
from . import config as C

PATH = Path(__file__).resolve().parent.parent / "data" / "flood_zones.geojson"

def canon(lake_id: str) -> str:
    return C.LAKE_ID_ALIASES.get(lake_id, lake_id)

@lru_cache(maxsize=4)
def _load(path: str):
    p = Path(path)
    if not p.exists(): return []
    return json.loads(p.read_text()).get("features", [])

def _residents(details):
    m = re.search(r"~?\s*([\d,]+)\s*(?:residents|people|inhabitants)", details or "", re.I)
    return int(m.group(1).replace(",", "")) if m else None

def get_exposure(lake_id: str, path=PATH) -> dict:
    lid, zones, assets = canon(lake_id), {}, []
    for f in _load(str(path)):
        p = f.get("properties", {})
        if canon(p.get("lake_id", "")) != lid: continue
        if p.get("feature_type") == "inundation_zone":
            zones[p.get("tier")] = f
        elif p.get("feature_type") == "exposed_infrastructure":
            assets.append({"asset_id": p.get("asset_id"), "name": p.get("name"),
                "asset_type": p.get("asset_type"), "distance_km": p.get("distance_from_lake_km"),
                "eta_minutes": p.get("eta_minutes"), "criticality": (p.get("criticality") or "").upper(),
                "threat_tier": p.get("threat_tier"), "elevation_m": p.get("elevation_m"),
                "residents": _residents(p.get("details")), "details": p.get("details"),
                "geometry": f.get("geometry")})
    assets.sort(key=lambda a: (a["eta_minutes"] is None, a["eta_minutes"] or 0))
    known = [a["residents"] for a in assets if a["residents"] is not None]
    return {"lake_id": lid, "exposure_source": "flood_zones.geojson" if (zones or assets) else "placeholder",
        "zones": {t: zones[t] for t in ("low", "moderate", "severe") if t in zones},
        "assets": assets,
        "summary": {"n_assets": len(assets), "min_eta_minutes": assets[0]["eta_minutes"] if assets else None,
            "residents_known": sum(known) if known else None,
            "population_note": "sum of residents stated in asset details only; not a full census"}}
