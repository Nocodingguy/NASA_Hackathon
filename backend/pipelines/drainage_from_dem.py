from __future__ import annotations

import argparse
import heapq
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pyproj
from shapely.geometry import LineString, Point, shape
from shapely.ops import transform as shp_transform

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CACHE_DIR = DATA_DIR / "cache"
LAKES_MASTER = DATA_DIR / "lakes_master.geojson"
OUT_PATH = DATA_DIR / "drainage_paths.geojson"

WGS84_CRS = "EPSG:4326"
UTM_CRS = "EPSG:32645"
_to_utm = pyproj.Transformer.from_crs(WGS84_CRS, UTM_CRS, always_xy=True).transform
_to_wgs = pyproj.Transformer.from_crs(UTM_CRS, WGS84_CRS, always_xy=True).transform

LAKE_CONFIG = {
    "tsho_rolpa": {"bbox": (86.00, 27.62, 86.55, 27.92), "max_km": 55.0},
    "imja_tsho": {"bbox": (86.62, 27.62, 86.98, 27.95), "max_km": 45.0},
    "thulagi_lake": {"bbox": (84.25, 28.20, 84.55, 28.55), "max_km": 40.0},
}

STEP_M = 100.0
SMOOTH_WINDOW = 5
SIMPLIFY_TOL_M = 15.0
LAKE_EDGE_BUFFER_M = 45.0

_NEIGHBOURS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def fetch_dem(lake_id: str, bbox, force: bool = False) -> Path:
    import planetary_computer
    import pystac_client
    import rasterio
    from rasterio.merge import merge

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    out = CACHE_DIR / f"dem_{lake_id}.tif"
    if out.exists() and not force:
        print(f"    using cached DEM {out}")
        return out

    print("    searching Planetary Computer for cop-dem-glo-30 tiles ...")
    catalog = pystac_client.Client.open(
        "https://planetarycomputer.microsoft.com/api/stac/v1",
        modifier=planetary_computer.sign_inplace,
    )
    items = list(catalog.search(collections=["cop-dem-glo-30"], bbox=list(bbox)).items())
    if not items:
        raise RuntimeError(f"No DEM tiles found for {lake_id} bbox={bbox}")

    srcs = [rasterio.open(it.assets["data"].href) for it in items]
    try:
        mosaic, transform = merge(srcs, bounds=tuple(bbox))
        profile = {
            "driver": "GTiff", "height": mosaic.shape[1], "width": mosaic.shape[2],
            "count": 1, "dtype": "float32", "crs": WGS84_CRS, "transform": transform,
            "compress": "deflate",
        }
        with rasterio.open(out, "w", **profile) as dst:
            dst.write(mosaic[0].astype("float32"), 1)
    finally:
        for s in srcs:
            s.close()
    print(f"    cached DEM -> {out}")
    return out


def read_dem(path: Path):
    import rasterio

    with rasterio.open(path) as src:
        dem = src.read(1).astype("float64")
        if src.nodata is not None:
            dem[dem == src.nodata] = np.nan
        transform = src.transform
        crs = src.crs
    if crs is None or crs.to_epsg() != 4326:
        raise ValueError("DEM must be in EPSG:4326 (lon/lat). Reproject it first.")
    if np.isnan(dem).any():
        dem[np.isnan(dem)] = np.nanmin(dem) - 1.0
    return dem, transform


def priority_flood(dem: np.ndarray) -> np.ndarray:
    rows, cols = dem.shape
    n = rows * cols
    z = dem.ravel().tolist()
    flow_to = np.full(n, -2, dtype=np.int64)
    closed = bytearray(n)
    heap: list[tuple[float, int]] = []

    def seed(r: int, c: int):
        i = r * cols + c
        if not closed[i]:
            closed[i] = 1
            flow_to[i] = -1
            heapq.heappush(heap, (z[i], i))

    for c in range(cols):
        seed(0, c)
        seed(rows - 1, c)
    for r in range(rows):
        seed(r, 0)
        seed(r, cols - 1)

    nextafter = math.nextafter
    while heap:
        zc, i = heapq.heappop(heap)
        r, c = divmod(i, cols)
        for dr, dc in _NEIGHBOURS:
            nr, nc = r + dr, c + dc
            if nr < 0 or nr >= rows or nc < 0 or nc >= cols:
                continue
            j = nr * cols + nc
            if closed[j]:
                continue
            closed[j] = 1
            flow_to[j] = i
            if z[j] <= zc:
                z[j] = nextafter(zc, math.inf)
            heapq.heappush(heap, (z[j], j))
    return flow_to


def follow_flow(flow_to: np.ndarray, start_idx: int, cols: int, max_steps: int = 5_000_000):
    out, i, steps = [], int(start_idx), 0
    while i >= 0 and steps < max_steps:
        out.append(divmod(i, cols))
        i = int(flow_to[i])
        steps += 1
    return out


def load_lake_polygon(lake_id: str):
    data = json.loads(LAKES_MASTER.read_text(encoding="utf-8"))
    cand = [f for f in data["features"] if f["properties"].get("lake_id") == lake_id]
    if not cand:
        raise KeyError(f"{lake_id} not found in {LAKES_MASTER.name}")
    cand.sort(key=lambda f: f["properties"].get("epoch_year", 0))
    return shape(cand[-1]["geometry"])


def resample_and_smooth(xy: np.ndarray, step=STEP_M, window=SMOOTH_WINDOW, tol=SIMPLIFY_TOL_M):
    line = LineString(xy)
    n = max(int(line.length // step), 2)
    pts = np.array([line.interpolate(d).coords[0] for d in np.linspace(0, line.length, n + 1)])
    if window > 1 and len(pts) > window:
        k = window // 2
        padded = np.vstack([np.repeat(pts[:1], k, axis=0), pts, np.repeat(pts[-1:], k, axis=0)])
        kernel = np.ones(window) / window
        sm = np.column_stack([np.convolve(padded[:, a], kernel, mode="valid") for a in (0, 1)])
        sm[0], sm[-1] = pts[0], pts[-1]
        pts = sm
    return np.array(LineString(pts).simplify(tol, preserve_topology=False).coords)


def trace_drainage(dem, transform, lake_poly_wgs, max_km, verbose=True):
    import rasterio.transform as rt

    rows, cols = dem.shape
    flow_to = priority_flood(dem)

    start = lake_poly_wgs.representative_point()
    r0, c0 = rt.rowcol(transform, start.x, start.y)
    if not (0 <= r0 < rows and 0 <= c0 < cols):
        raise ValueError("Lake lies outside the DEM window - check LAKE_CONFIG bbox.")

    cells = follow_flow(flow_to, r0 * cols + c0, cols)
    rr = np.array([p[0] for p in cells])
    cc = np.array([p[1] for p in cells])
    xs, ys = rt.xy(transform, rr, cc, offset="center")
    ux, uy = _to_utm(np.asarray(xs), np.asarray(ys))
    utm = np.column_stack([ux, uy])

    lake_utm = shp_transform(_to_utm, lake_poly_wgs).buffer(LAKE_EDGE_BUFFER_M)
    inside = np.array([lake_utm.contains(Point(p)) for p in utm])
    if inside.all():
        raise RuntimeError("Flow line never leaves the lake - DEM window too small?")
    last_inside = int(np.nonzero(inside)[0].max()) if inside.any() else 0
    utm = utm[last_inside:]
    z_outlet = float(dem[rr[last_inside], cc[last_inside]])

    full_len_km = LineString(utm).length / 1000.0
    smooth = resample_and_smooth(utm)
    line = LineString(smooth)
    reached_edge = line.length / 1000.0 < max_km
    if line.length > max_km * 1000.0:
        from shapely.ops import substring
        line = substring(line, 0, max_km * 1000.0)
    lonlat = np.array([_to_wgs(x, y) for x, y in line.coords])

    er, ec = rt.rowcol(transform, lonlat[:, 0], lonlat[:, 1])
    elev = []
    for a, b in zip(er, ec):
        a = min(max(int(a), 0), rows - 1)
        b = min(max(int(b), 0), cols - 1)
        elev.append(float(dem[max(a - 1, 0):a + 2, max(b - 1, 0):b + 2].min()))
    elev = np.minimum.accumulate(np.array(elev))

    info = {
        "length_km": round(line.length / 1000.0, 2),
        "raw_length_km": round(full_len_km, 2),
        "outlet_lonlat": [round(float(lonlat[0][0]), 5), round(float(lonlat[0][1]), 5)],
        "outlet_elev_m": round(z_outlet, 0),
        "end_elev_m": round(float(dem[rr[-1], cc[-1]]), 0),
        "reached_dem_edge": bool(reached_edge),
        "elevations_m": [int(round(v)) for v in elev],
    }
    if verbose and reached_edge:
        print(f"    ! WARNING: flow line hit the DEM edge at {info['length_km']} km "
              f"(< max_km={max_km}). Enlarge the bbox in LAKE_CONFIG.")
    return lonlat, info


def run_lake(lake_id: str, dem_path: Path | None, force: bool):
    cfg = LAKE_CONFIG[lake_id]
    print(f"[{lake_id}]")
    path = Path(dem_path) if dem_path else fetch_dem(lake_id, cfg["bbox"], force=force)
    dem, transform = read_dem(path)
    print(f"    DEM {dem.shape[1]}x{dem.shape[0]} cells, {np.nanmin(dem):.0f}-{np.nanmax(dem):.0f} m")
    poly = load_lake_polygon(lake_id)
    lonlat, info = trace_drainage(dem, transform, poly, cfg["max_km"])
    print(f"    outlet {info['outlet_lonlat']} @ {info['outlet_elev_m']:.0f} m  ->  "
          f"{info['length_km']} km, ends @ {info['end_elev_m']:.0f} m ({len(lonlat)} vertices)")
    return {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": [[round(x, 6), round(y, 6)] for x, y in lonlat]},
        "properties": {
            "feature_type": "drainage_path",
            "lake_id": lake_id,
            "source": "Copernicus GLO-30 DEM, priority-flood D8 trace",
            **info,
        },
    }


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--lake", choices=sorted(LAKE_CONFIG), help="only this lake (default: all)")
    ap.add_argument("--dem", help="use this local GeoTIFF (EPSG:4326) instead of downloading; needs --lake")
    ap.add_argument("--refresh", action="store_true", help="re-download cached DEMs")
    args = ap.parse_args(argv)
    if args.dem and not args.lake:
        ap.error("--dem requires --lake")

    lakes = [args.lake] if args.lake else sorted(LAKE_CONFIG)

    existing = {}
    if OUT_PATH.exists() and args.lake:
        for f in json.loads(OUT_PATH.read_text(encoding="utf-8"))["features"]:
            existing[f["properties"]["lake_id"]] = f

    for lid in lakes:
        existing[lid] = run_lake(lid, args.dem, args.refresh)

    fc = {
        "type": "FeatureCollection",
        "metadata": {"generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                     "crs": WGS84_CRS},
        "features": [existing[k] for k in sorted(existing)],
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(fc, indent=2), encoding="utf-8")
    print(f"\n[+] wrote {OUT_PATH}")
    print("    next: python pipelines/flood_Areas.py")


if __name__ == "__main__":
    sys.exit(main())
