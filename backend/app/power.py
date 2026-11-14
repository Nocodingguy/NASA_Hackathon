import json
import requests
from pathlib import Path

CACHE = Path(__file__).resolve().parent.parent / "data" / "cache"
CACHE.mkdir(parents=True, exist_ok=True)

def fetch_power(lake_id, lat, lon, start=1985, end=2025):
    f = CACHE / f"power_{lake_id}.json"
    if f.exists():
        return json.loads(f.read_text())
    r = requests.get(
        "https://power.larc.nasa.gov/api/temporal/daily/point",
        params={"parameters": "T2M,PRECTOTCORR", "community": "RE",
                "longitude": lon, "latitude": lat,
                "start": f"{start}0101", "end": f"{end}1231", "format": "JSON"},
        timeout=180)
    r.raise_for_status()
    data = r.json()["properties"]["parameter"]
    f.write_text(json.dumps(data))
    return data