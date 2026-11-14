#!/usr/bin/env python3
"""
Member 1: Glacial Lake Multi-Decadal Extraction Pipeline
Queries Microsoft Planetary Computer STAC API (Landsat C2 L2 + Sentinel-2 L2A),
computes MNDWI, applies Multi-Otsu thresholding, vectorizes water masks into
GeoJSON polygons, and calculates 40-year area/volume expansion metrics.
"""

import json
import os
import warnings
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import geopandas as gpd
import numpy as np
import odc.stac
import planetary_computer
import pystac_client
import rasterio.features
from scipy.ndimage import binary_closing, binary_fill_holes, binary_opening
from shapely.geometry import Point, shape
from skimage.filters import threshold_multiotsu

warnings.filterwarnings("ignore")

STAC_API_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
UTM_CRS = "EPSG:32645"   # UTM Zone 45N (accurate meter-based area for Nepal Himalayas)
WGS84_CRS = "EPSG:4326"  # Standard GeoJSON CRS for Mapbox GL JS

# Target Himalayan Glacial Lakes (Seed Coordinates + Bounding Box in [min_lon, min_lat, max_lon, max_lat])
TARGET_LAKES = [
    {
        "id": "tsho_rolpa",
        "name": "Tsho Rolpa",
        "region": "Rolwaling Valley, Dolakha",
        "seed_lon": 86.4769,
        "seed_lat": 27.8614,
        "elevation_m": 4580,
        "bbox": [86.450, 27.845, 86.505, 27.878],
    },
    {
        "id": "imja_tsho",
        "name": "Imja Tsho (Imja Lake)",
        "region": "Khumbu / Everest Region, Solukhumbu",
        "seed_lon": 86.9250,
        "seed_lat": 27.8986,
        "elevation_m": 5010,
        "bbox": [86.905, 27.885, 86.948, 27.912],
    },
    {
        "id": "thulagi_lake",
        "name": "Thulagi Lake (Dona Lake)",
        "region": "Manaslu Region, Marsyangdi Basin",
        "seed_lon": 84.4864,
        "seed_lat": 28.4883,
        "elevation_m": 4044,
        "bbox": [84.465, 28.475, 84.510, 28.502],
    },
]

# Post-monsoon (Oct-Nov) epochs to minimize cloud cover & seasonal snowpack
EPOCHS = [
    {"epoch_year": 1990, "date_range": "1988-10-01/1992-11-30", "collection": "landsat-c2-l2"},
    {"epoch_year": 2000, "date_range": "1999-10-01/2001-11-30", "collection": "landsat-c2-l2"},
    {"epoch_year": 2010, "date_range": "2009-10-01/2011-11-30", "collection": "landsat-c2-l2"},
    {"epoch_year": 2018, "date_range": "2017-10-01/2019-11-30", "collection": "sentinel-2-l2a"},
    {"epoch_year": 2025, "date_range": "2024-10-01/2025-11-30", "collection": "sentinel-2-l2a"},
]


def search_best_post_monsoon_item(
    catalog: pystac_client.Client,
    collection: str,
    bbox: List[float],
    date_range: str,
    max_cloud: float = 20.0,
):
    """
    Searches STAC for post-monsoon (October/November) scenes with minimal cloud cover
    and returns the single clearest scene covering the glacial lake bounding box.
    """
    start_year = int(date_range[:4])
    end_year = int(date_range.split("/")[1][:4])

    candidate_items = []
    for yr in range(start_year, end_year + 1):
        post_monsoon_window = f"{yr}-10-01/{yr}-11-30"
        search = catalog.search(
            collections=[collection],
            bbox=bbox,
            datetime=post_monsoon_window,
            query={"eo:cloud_cover": {"lt": max_cloud}},
        )
        items = list(search.items())
        candidate_items.extend(items)

    if not candidate_items:
        # Fallback: relax cloud filter to 35% if high-altitude cirrus flagged scene
        search = catalog.search(
            collections=[collection],
            bbox=bbox,
            datetime=date_range,
            query={"eo:cloud_cover": {"lt": 35.0}},
        )
        candidate_items = list(search.items())

    if not candidate_items:
        return None

    # Sort by lowest cloud cover
    best_item = sorted(
        candidate_items, key=lambda item: item.properties.get("eo:cloud_cover", 100.0)
    )[0]
    return planetary_computer.sign(best_item)


def compute_mndwi_from_item(item, collection: str, bbox: List[float]) -> Tuple[np.ndarray, object]:
    """
    Streams only the clipped lake bounding box from the signed COG asset
    and computes the Modified Normalized Difference Water Index (MNDWI).
    """
    if collection == "sentinel-2-l2a":
        bands = ["B03", "B11"]  # Green (10m) and SWIR1 (20m)
        resolution = 10
    else:
        # landsat-c2-l2 uses common STAC band aliases across Landsat 5/7/8/9
        bands = ["green", "swir16"]
        resolution = 30

    ds = odc.stac.load(
        [item],
        bands=bands,
        crs=UTM_CRS,
        resolution=resolution,
        bbox=bbox,
        resampling="bilinear",
    )

    if collection == "sentinel-2-l2a":
        green = ds["B03"].isel(time=0).astype("float32")
        swir = ds["B11"].isel(time=0).astype("float32")
    else:
        green = ds["green"].isel(time=0).astype("float32")
        swir = ds["swir16"].isel(time=0).astype("float32")

    # Mask zero/nodata pixels
    valid_mask = (green > 0) & (swir > 0)
    denom = green + swir
    mndwi = np.where(valid_mask & (denom != 0), (green - swir) / denom, np.nan)

    # Clip to theoretical [-1.0, 1.0] range
    mndwi = np.clip(mndwi, -1.0, 1.0)
    return mndwi, ds.odc.geobox


def segment_lake_multiotsu(
    mndwi: np.ndarray,
    geobox,
    seed_lon: float,
    seed_lat: float,
) -> Optional[Tuple[gpd.GeoDataFrame, float]]:
    """
    Applies 3-class Multi-Otsu thresholding on the MNDWI array to separate:
      Class 0: Background rock / moraine debris
      Class 1: Glacial ice / snow / mountain shadow
      Class 2: Liquid open water (glacial lake)
    Vectorizes the water mask and isolates the contiguous lake body nearest the seed point.
    """
    valid_pixels = mndwi[np.isfinite(mndwi)]
    if valid_pixels.size < 100:
        return None

    # Compute 3-class Multi-Otsu thresholds
    thresholds = threshold_multiotsu(valid_pixels, classes=3)
    water_threshold = max(float(thresholds[-1]), 0.05)  # Enforce physical water lower bound

    water_mask = np.isfinite(mndwi) & (mndwi >= water_threshold)

    # Morphological cleanup: close narrow ice-front fractures & fill floating icebergs
    water_mask = binary_closing(water_mask, structure=np.ones((3, 3)))
    water_mask = binary_fill_holes(water_mask)
    water_mask = binary_opening(water_mask, structure=np.ones((2, 2)))

    transform = geobox.transform
    shapes_gen = rasterio.features.shapes(
        water_mask.astype(np.uint8),
        mask=water_mask,
        transform=transform,
    )

    polygons = [shape(geom) for geom, val in shapes_gen if val == 1]
    if not polygons:
        return None

    gdf_utm = gpd.GeoDataFrame(geometry=polygons, crs=UTM_CRS)
    gdf_utm["area_km2"] = gdf_utm.geometry.area / 1e6

    # Filter out tiny supraglacial melt ponds (< 0.03 km²)
    gdf_utm = gdf_utm[gdf_utm["area_km2"] >= 0.03].copy()
    if gdf_utm.empty:
        return None

    # Project seed point to UTM and pick the polygon containing or closest to the lake center
    seed_pt_utm = (
        gpd.GeoSeries([Point(seed_lon, seed_lat)], crs=WGS84_CRS)
        .to_crs(UTM_CRS)
        .iloc[0]
    )
    gdf_utm["dist_to_seed_m"] = gdf_utm.geometry.distance(seed_pt_utm)
    gdf_utm = gdf_utm.sort_values(by=["dist_to_seed_m", "area_km2"], ascending=[True, False])

    lake_row = gdf_utm.iloc[[0]].copy()
    area_km2 = float(round(lake_row["area_km2"].iloc[0], 3))

    # Smooth raster stair-stepping slightly for clean 3D Mapbox rendering
    lake_row["geometry"] = lake_row.geometry.simplify(tolerance=8.0, preserve_topology=True)

    # Reproject to WGS84 (EPSG:4326) for GeoJSON export
    lake_wgs84 = lake_row.to_crs(WGS84_CRS)
    return lake_wgs84, area_km2


def estimate_volume_mcm(area_km2: float) -> float:
    """
    Huggel et al. (2002) / ICIMOD empirical area-volume scaling for Himalayan moraine-dammed lakes:
    V (m³) = 0.104 * A(m²)^1.42  -> converted to Million Cubic Meters (MCM).
    """
    area_m2 = area_km2 * 1_000_000.0
    volume_m3 = 0.104 * (area_m2 ** 1.42)
    return round(volume_m3 / 1_000_000.0, 2)


def run_extraction_pipeline(output_path: str = "../data/lakes_master.geojson"):
    print("Connecting to Microsoft Planetary Computer STAC API...")
    catalog = pystac_client.Client.open(
        STAC_API_URL,
        modifier=planetary_computer.sign_inplace,
    )

    geojson_features = []

    for lake in TARGET_LAKES:
        print(f"\n=== Processing {lake['name']} ({lake['region']}) ===")
        epoch_areas = {}

        for ep in EPOCHS:
            year = ep["epoch_year"]
            collection = ep["collection"]
            print(f"  -> Searching {collection} for epoch {year} ({ep['date_range']})...")

            item = search_best_post_monsoon_item(
                catalog=catalog,
                collection=collection,
                bbox=lake["bbox"],
                date_range=ep["date_range"],
            )

            if item is None:
                print(f"     [!] No cloud-free scene found for {year}, skipping epoch.")
                continue

            scene_date = item.datetime.strftime("%Y-%m-%d")
            cloud_pct = round(item.properties.get("eo:cloud_cover", 0.0), 1)

            try:
                mndwi, geobox = compute_mndwi_from_item(item, collection, lake["bbox"])
                seg_result = segment_lake_multiotsu(
                    mndwi=mndwi,
                    geobox=geobox,
                    seed_lon=lake["seed_lon"],
                    seed_lat=lake["seed_lat"],
                )
                if seg_result is None:
                    print(f"     [!] Water segmentation returned empty mask for {year}.")
                    continue

                lake_gdf, area_km2 = seg_result
                vol_mcm = estimate_volume_mcm(area_km2)
                epoch_areas[year] = area_km2

                geom_json = json.loads(lake_gdf.to_json())["features"][0]["geometry"]

                feature = {
                    "type": "Feature",
                    "properties": {
                        "lake_id": lake["id"],
                        "lake_name": lake["name"],
                        "region": lake["region"],
                        "elevation_m": lake["elevation_m"],
                        "epoch_year": year,
                        "acquisition_date": scene_date,
                        "satellite_collection": collection,
                        "scene_id": item.id,
                        "cloud_cover_pct": cloud_pct,
                        "area_km2": area_km2,
                        "estimated_volume_mcm": vol_mcm,
                    },
                    "geometry": geom_json,
                }
                geojson_features.append(feature)
                print(
                    f"     [+] Extracted {year} ({scene_date}): "
                    f"Area = {area_km2:.3f} km² | Vol = {vol_mcm:.1f} MCM | Cloud = {cloud_pct}%"
                )

            except Exception as exc:
                print(f"     [!] Error processing {lake['id']} ({year}): {exc}")

        # Calculate multi-decadal percentage expansion across extracted epochs
        if len(epoch_areas) >= 2:
            sorted_yrs = sorted(epoch_areas.keys())
            first_area = epoch_areas[sorted_yrs[0]]
            last_area = epoch_areas[sorted_yrs[-1]]
            growth_pct = round(((last_area - first_area) / first_area) * 100.0, 1)
            for feat in geojson_features:
                if feat["properties"]["lake_id"] == lake["id"]:
                    feat["properties"]["area_growth_pct_total"] = growth_pct

    output_file = Path(__file__).resolve().parent / output_path
    output_file.parent.mkdir(parents=True, exist_ok=True)

    feature_collection = {
        "type": "FeatureCollection",
        "metadata": {
            "generator": "GlacierWatch STAC + MNDWI Multi-Otsu Pipeline",
            "crs": WGS84_CRS,
            "area_projection": UTM_CRS,
        },
        "features": geojson_features,
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(feature_collection, f, indent=2)

    print(f"\nSaved {len(geojson_features)} multi-decadal lake polygons to: {output_file}")


if __name__ == "__main__":
    run_extraction_pipeline()