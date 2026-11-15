"""Download the NASA POWER record for every lake once, so the demo does not depend on the live API.

Run from the backend folder:  python -m scripts.warm_cache
"""
from app.lakes import LAKES
from app.power import fetch_power

for lake_id, lk in LAKES.items():
    print(f"{lake_id}: fetching...", end=" ", flush=True)
    d = fetch_power(lake_id, lk["lat"], lk["lon"])
    print(f"{len(d['T2M'])} days")
