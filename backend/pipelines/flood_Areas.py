import json
from pathlib import Path
from typing import Dict, List
import requests
import shapely.geometry
from shapely.geometry import LineString, Point, Polygon, mapping
from shapely.ops import transform
import pyproj

WGS84_CRS = "EPSG:4326"
UTM_CRS = "EPSG:32645"

project_to_utm = pyproj.Transformer.from_crs(WGS84_CRS, UTM_CRS, always_xy=True).transform
project_to_wgs84 = pyproj.Transformer.from_crs(UTM_CRS, WGS84_CRS, always_xy=True).transform

LAKE_DRAINAGE_CORRIDORS = {
    "tsho_rolpa": {
        "lake_name": "Tsho Rolpa",
        "river_name": "Rolwaling Khola & Tama Koshi",
        "path_coords": [
            [86.4769, 27.8614],
            [86.4420, 27.8630],
            [86.3750, 27.8550],
            [86.2900, 27.8420],
            [86.2100, 27.8380],
            [86.1950, 27.8250],
            [86.2080, 27.7950],
            [86.1550, 27.7620],
            [86.0950, 27.7200],
            [86.0200, 27.6500],
        ],
        "exposed_assets": [
            {
                "id": "na_village",
                "name": "Na Village",
                "type": "village",
                "lon": 86.3750,
                "lat": 27.8550,
                "elevation_m": 4180,
                "distance_km": 10.5,
                "details": "High-altitude pastoral settlement (~80 residents)",
                "criticality": "HIGH",
            },
            {
                "id": "beding_village",
                "name": "Beding Village",
                "type": "village",
                "lon": 86.2900,
                "lat": 27.8420,
                "elevation_m": 3690,
                "distance_km": 19.2,
                "details": "Primary Rolwaling Sherpa settlement (~350 residents)",
                "criticality": "CRITICAL",
            },
            {
                "id": "chetchet_bridge",
                "name": "Chetchet Suspension Bridge",
                "type": "bridge",
                "lon": 86.2100,
                "lat": 27.8380,
                "elevation_m": 2240,
                "distance_km": 28.4,
                "details": "Lifeline trail bridge connecting Rolwaling valley",
                "criticality": "HIGH",
            },
            {
                "id": "upper_tamakoshi_hep",
                "name": "Upper Tamakoshi Hydropower (456 MW)",
                "type": "hydropower",
                "lon": 86.2080,
                "lat": 27.7950,
                "elevation_m": 1980,
                "distance_km": 34.0,
                "details": "Nepal's largest operating national grid hydroelectric project; desanding basin & dam headworks at Gonggar",
                "criticality": "CRITICAL",
            },
            {
                "id": "singati_bazar",
                "name": "Singati Commercial Bazaar",
                "type": "village",
                "lon": 86.0950,
                "lat": 27.7200,
                "elevation_m": 1250,
                "distance_km": 49.5,
                "details": "Major regional economic hub and transport transit point",
                "criticality": "CRITICAL",
            },
        ],
    },
    "imja_tsho": {
        "lake_name": "Imja Tsho (Everest Region)",
        "river_name": "Imja Khola & Dudh Koshi",
        "path_coords": [
            [86.9250, 27.8986],
            [86.8850, 27.8990],
            [86.8320, 27.8930],
            [86.7850, 27.8820],
            [86.7640, 27.8630],
            [86.7200, 27.8050],
            [86.7120, 27.7400],
            [86.7200, 27.6900],
        ],
        "exposed_assets": [
            {
                "id": "dingboche_village",
                "name": "Dingboche Village",
                "type": "village",
                "lon": 86.8320,
                "lat": 27.8930,
                "elevation_m": 4410,
                "distance_km": 9.8,
                "details": "Key Everest acclimatization hub and lodges (~400 tourists/residents)",
                "criticality": "HIGH",
            },
            {
                "id": "pangboche_village",
                "name": "Pangboche Historic Village",
                "type": "village",
                "lon": 86.7850,
                "lat": 27.8820,
                "elevation_m": 3985,
                "distance_km": 15.2,
                "details": "Oldest monastery in Khumbu and residential village",
                "criticality": "HIGH",
            },
            {
                "id": "phunki_tenga_bridge",
                "name": "Phunki Tenga River Crossing",
                "type": "bridge",
                "lon": 86.7640,
                "lat": 27.8630,
                "elevation_m": 3250,
                "distance_km": 20.6,
                "details": "Major trekking bridge at Dudh Koshi-Imja Khola confluence",
                "criticality": "HIGH",
            },
            {
                "id": "larja_bridge",
                "name": "Hillary Suspension Bridge (Larja)",
                "type": "bridge",
                "lon": 86.7200,
                "lat": 27.8050,
                "elevation_m": 2830,
                "distance_km": 29.5,
                "details": "Twin suspension bridges below Namche Bazaar",
                "criticality": "CRITICAL",
            },
            {
                "id": "phakding_settlement",
                "name": "Phakding Riverfront Settlement",
                "type": "village",
                "lon": 86.7120,
                "lat": 27.7400,
                "elevation_m": 2610,
                "distance_km": 37.0,
                "details": "Direct riverbank lodges on Everest Base Camp trail",
                "criticality": "CRITICAL",
            },
        ],
    },
    "thulagi_lake": {
        "lake_name": "Thulagi Lake",
        "river_name": "Dona Khola & Marsyangdi River",
        "path_coords": [
            [84.4864, 28.4883],
            [84.4500, 28.4700],
            [84.4080, 28.4550],
            [84.4050, 28.4350],
            [84.3800, 28.3800],
            [84.3950, 28.3300],
            [84.4100, 28.2700],
        ],
        "exposed_assets": [
            {
                "id": "dharapani_village",
                "name": "Dharapani Village & Confluence",
                "type": "village",
                "lon": 84.4050,
                "lat": 28.4350,
                "elevation_m": 1860,
                "distance_km": 11.2,
                "details": "Annapurna Circuit checkpoint & police post",
                "criticality": "CRITICAL",
            },
            {
                "id": "tal_village",
                "name": "Tal Lakeside Settlement",
                "type": "village",
                "lon": 84.3800,
                "lat": 28.3800,
                "elevation_m": 1700,
                "distance_km": 19.5,
                "details": "Low-lying valley basin repeatedly flooded by historic monsoon surges",
                "criticality": "CRITICAL",
            },
            {
                "id": "upper_marsyangdi_hep",
                "name": "Upper Marsyangdi A Hydropower (50 MW)",
                "type": "hydropower",
                "lon": 84.4100,
                "lat": 28.2700,
                "elevation_m": 1300,
                "distance_km": 33.8,
                "details": "Run-of-the-river power station infrastructure",
                "criticality": "HIGH",
            },
        ],
    },
}

FLOOD_TIERS = [
    {
        "tier": "low",
        "label": "Tier 1: Minor Breach / Piping Flow",
        "buffer_m": 75,
        "peak_discharge_m3s": 2400,
        "color_hex": "#3b82f6",
        "reach_factor": 0.50,
        "description": "Controlled spillway overtopping or minor piping; damages riverside paths and small pedestrian footbridges."
    },
    {
        "tier": "moderate",
        "label": "Tier 2: Partial Moraine Dam Failure",
        "buffer_m": 160,
        "peak_discharge_m3s": 6800,
        "color_hex": "#f59e0b",
        "reach_factor": 0.75,
        "description": "50% moraine crest breach; severe bank scour, threatens low-lying bridges and headworks."
    },
    {
        "tier": "severe",
        "label": "Tier 3: Catastrophic Moraine Collapse",
        "buffer_m": 320,
        "peak_discharge_m3s": 14500,
        "color_hex": "#ef4444",
        "reach_factor": 1.00,
        "description": "Total moraine dam collapse; high-velocity debris wave, severe inundation of downstream villages and hydropower assets."
    },
]

def calculate_flood_arrival_minutes(distance_km: float) -> int:
    velocity_mps = 5.5
    distance_m = distance_km * 1000.0
    seconds = distance_m / velocity_mps
    return max(5, int(round(seconds / 60.0)))

def build_flood_zones_geojson() -> Dict:
    features = []

    for lake_id, data in LAKE_DRAINAGE_CORRIDORS.items():
        coords = data["path_coords"]
        full_line = LineString(coords)
        full_line_utm = transform(project_to_utm, full_line)
        total_length_m = full_line_utm.length

        for tier_info in FLOOD_TIERS:

            sub_length_m = total_length_m * tier_info["reach_factor"]

            reach_points = []
            num_samples = max(10, int(len(coords) * tier_info["reach_factor"]) + 4)
            for frac in [i / num_samples for i in range(num_samples + 1)]:
                pt = full_line_utm.interpolate(frac * sub_length_m)
                reach_points.append(pt)

            reach_line_utm = LineString(reach_points)

            poly_utm = reach_line_utm.buffer(tier_info["buffer_m"], cap_style=2, join_style=2)

            poly_wgs84 = transform(project_to_wgs84, poly_utm)

            feature = {
                "type": "Feature",
                "geometry": mapping(poly_wgs84),
                "properties": {
                    "feature_type": "inundation_zone",
                    "lake_id": lake_id,
                    "lake_name": data["lake_name"],
                    "river_basin": data["river_name"],
                    "tier": tier_info["tier"],
                    "tier_label": tier_info["label"],
                    "buffer_width_m": tier_info["buffer_m"] * 2,
                    "peak_discharge_m3s": tier_info["peak_discharge_m3s"],
                    "color_hex": tier_info["color_hex"],
                    "description": tier_info["description"],
                },
            }
            features.append(feature)

        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {
                "feature_type": "drainage_path",
                "lake_id": lake_id,
                "lake_name": data["lake_name"],
                "river_basin": data["river_name"],
            },
        })

        for asset in data["exposed_assets"]:
            eta_mins = calculate_flood_arrival_minutes(asset["distance_km"])
            pt_geom = Point(asset["lon"], asset["lat"])

            if asset["distance_km"] < 15.0:
                threat_tier = "severe"
            elif asset["distance_km"] < 30.0:
                threat_tier = "moderate"
            else:
                threat_tier = "low"

            feature = {
                "type": "Feature",
                "geometry": mapping(pt_geom),
                "properties": {
                    "feature_type": "exposed_infrastructure",
                    "lake_id": lake_id,
                    "lake_name": data["lake_name"],
                    "asset_id": asset["id"],
                    "name": asset["name"],
                    "asset_type": asset["type"],
                    "elevation_m": asset["elevation_m"],
                    "distance_from_lake_km": asset["distance_km"],
                    "eta_minutes": eta_mins,
                    "criticality": asset["criticality"],
                    "threat_tier": threat_tier,
                    "details": asset["details"],
                },
            }
            features.append(feature)

    output = {
        "type": "FeatureCollection",
        "metadata": {
            "generator": "GlacierWatch Downstream Hydrodynamic Inundation & Exposure Model",
            "crs": WGS84_CRS,
            "total_features": len(features),
        },
        "features": features,
    }
    return output

def main():
    output_path = Path(__file__).resolve().parent.parent / "data" / "flood_zones.geojson"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print("Generating downstream flood tiers and mapping exposed infrastructure...")
    fc = build_flood_zones_geojson()

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(fc, f, indent=2)

    inundation_count = sum(1 for f in fc["features"] if f["properties"].get("feature_type") == "inundation_zone")
    asset_count = sum(1 for f in fc["features"] if f["properties"].get("feature_type") == "exposed_infrastructure")

    print(f"\n[+] Success! Written to: {output_path}")
    print(f"    - Inundation Tiers Created: {inundation_count} polygons")
    print(f"    - Exposed Infrastructure Identified: {asset_count} critical points (villages, dams, bridges)")

if __name__ == "__main__":
    main()