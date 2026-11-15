#!/usr/bin/env python3
"""
GlacierWatch: Near-Real-Time (NRT) Glacial Lake Satellite Monitor
Fetches the freshest satellite pass from the last 30 days,
computes current water area, and checks for GLOF / anomalous expansion alerts.
"""

from datetime import datetime, timedelta
import json
from pathlib import Path
import planetary_computer
import pystac_client
import odc.stac
import numpy as np

STAC_API_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
UTM_CRS = "EPSG:32645"

# Monitored Lakes with historical safe baselines (km²)
MONITORED_LAKES = {
    "tsho_rolpa": {
        "name": "Tsho Rolpa",
        "bbox": [86.450, 27.845, 86.505, 27.878],
        "baseline_area_km2": 1.54,
        "critical_threshold_km2": 1.70,
    },
    "imja_tsho": {
        "name": "Imja Tsho",
        "bbox": [86.905, 27.885, 86.948, 27.912],
        "baseline_area_km2": 1.45,
        "critical_threshold_km2": 1.62,
    },
}

def check_lake_nrt(catalog, lake_id: str, info: dict, lookback_days: int = 30):
    today = datetime.utcnow()
    start_date = (today - timedelta(days=lookback_days)).strftime("%Y-%m-%d")
    end_date = today.strftime("%Y-%m-%d")
    date_range = f"{start_date}/{end_date}"

    print(f"\n🔍 Scanning satellite orbits for {info['name']} between {start_date} and {end_date}...")

    # Search Sentinel-2 L2A (highest frequency 5-day revisit)
    search = catalog.search(
        collections=["sentinel-2-l2a"],
        bbox=info["bbox"],
        datetime=date_range,
        query={"eo:cloud_cover": {"lt": 25.0}},
    )
    items = list(search.items())

    if not items:
        # Fallback to Landsat if Sentinel had high cloud cover
        search = catalog.search(
            collections=["landsat-c2-l2"],
            bbox=info["bbox"],
            datetime=date_range,
            query={"eo:cloud_cover": {"lt": 30.0}},
        )
        items = list(search.items())

    if not items:
        return {
            "lake_id": lake_id,
            "status": "NO_CLEAR_PASS",
            "message": f"No cloud-free passes (<25%) in the last {lookback_days} days. Waiting for next orbital pass.",
            "last_checked": today.isoformat(),
        }

    # Sort to grab the absolute most recent scene
    latest_item = sorted(items, key=lambda it: it.datetime, reverse=True)[0]
    signed_item = planetary_computer.sign(latest_item)
    pass_date = latest_item.datetime.strftime("%Y-%m-%d %H:%M UTC")
    cloud_cover = round(latest_item.properties.get("eo:cloud_cover", 0.0), 1)

    print(f"  🛰️ Freshest Orbit Detected: {latest_item.id}")
    print(f"  📅 Acquisition Time: {pass_date} | Cloud: {cloud_cover}%")

    # Fast MNDWI calculation (10m resolution)
    is_s2 = "sentinel" in latest_item.collection_id
    bands = ["B03", "B11"] if is_s2 else ["green", "swir16"]

    ds = odc.stac.load(
        [signed_item],
        bands=bands,
        crs=UTM_CRS,
        resolution=10 if is_s2 else 30,
        bbox=info["bbox"],
    )

    green = ds[bands[0]].isel(time=0).astype("float32")
    swir = ds[bands[1]].isel(time=0).astype("float32")

    valid = (green > 0) & (swir > 0)
    denom = green + swir
    mndwi = np.where(valid & (denom != 0), (green - swir) / denom, -1.0)

    # Water pixels (MNDWI > 0.12)
    pixel_area_m2 = 100.0 if is_s2 else 900.0
    water_pixels = np.sum(mndwi > 0.12)
    current_area_km2 = round((water_pixels * pixel_area_m2) / 1e6, 3)

    baseline = info["baseline_area_km2"]
    delta_pct = round(((current_area_km2 - baseline) / baseline) * 100.0, 1)

    # Risk evaluation
    if current_area_km2 >= info["critical_threshold_km2"]:
        risk_level = "CRITICAL_SWELL"
        directive = "Initiate siphon pump discharge; put downstream Tamakoshi corridor on high alert."
    elif delta_pct <= -30.0:
        risk_level = "SUDDEN_DRAINAGE_WARNING"
        directive = "Possible moraine piping or sudden drainage event. Verify downstream river sensors!"
    else:
        risk_level = "NOMINAL_STABLE"
        directive = "Lake level within expected post-monsoon safety variance."

    return {
        "lake_id": lake_id,
        "lake_name": info["name"],
        "status": "ONLINE",
        "latest_satellite_pass": pass_date,
        "satellite": latest_item.collection_id,
        "cloud_cover_pct": cloud_cover,
        "current_area_km2": current_area_km2,
        "baseline_area_km2": baseline,
        "delta_from_baseline_pct": delta_pct,
        "risk_level": risk_level,
        "official_directive": directive,
        "last_checked": today.isoformat(),
    }

def main():
    catalog = pystac_client.Client.open(STAC_API_URL, modifier=planetary_computer.sign_inplace)
    live_reports = []

    for lake_id, info in MONITORED_LAKES.items():
        report = check_lake_nrt(catalog, lake_id, info)
        live_reports.append(report)
        print(f"  📊 Status: {report['risk_level']} (Area: {report.get('current_area_km2', 'N/A')} km²)")

    output_file = Path(__file__).resolve().parent.parent / "data" / "live_nrt_status.json"
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({"nrt_feed": live_reports, "generated_at": datetime.utcnow().isoformat()}, f, indent=2)

    print(f"\n✅ Live NRT Feed written to {output_file}")

if __name__ == "__main__":
    main()