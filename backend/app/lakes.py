import json
from collections import defaultdict
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "lakes_master.geojson"

def _centroid(geom):
    ring = geom["coordinates"][0]
    if geom["type"] == "MultiPolygon":
        ring = ring[0]
    return (sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))

def load_lakes():
    feats = json.load(open(DATA_PATH))["features"]
    groups = defaultdict(list)
    for ft in feats:
        groups[ft["properties"]["lake_id"]].append(ft)
    lakes = {}
    for lake_id, items in groups.items():
        items.sort(key=lambda x: x["properties"]["epoch_year"])
        p = items[-1]["properties"]
        lon, lat = _centroid(items[-1]["geometry"])
        lakes[lake_id] = {
            "id": lake_id, "name": p["lake_name"], "lon": lon, "lat": lat,
            "elevation_m": p["elevation_m"], "area_km2": p["area_km2"],
            "area_by_year": {str(i["properties"]["epoch_year"]): i["properties"]["area_km2"] for i in items},
            "risk": "unknown",
        }
    return lakes

LAKES = load_lakes()