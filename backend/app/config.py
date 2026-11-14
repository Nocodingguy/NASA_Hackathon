# All values marked PLACEHOLDER must be replaced/cited before the pitch.
BASELINE_YEARS = (2011, 2025)
LAPSE_RATE_C_PER_KM = 6.5
POWER_GRID_ELEV_M = 4500        # PLACEHOLDER
GLACIER_MEAN_ELEV_M = 5500      # PLACEHOLDER
GLACIER_AREA_KM2 = 10.0         # PLACEHOLDER (per lake; use RGI 7)
DEBRIS_FRACTION = 0.3           # PLACEHOLDER
# mm w.e. / degC / day  (check literature)
DDF_CLEAN = {"low": 5.5, "central": 7.0, "high": 9.0}
DDF_DEBRIS = {"low": 1.5, "central": 3.0, "high": 4.5}
RETAIN_FRACTION = {"low": 0.10, "central": 0.25, "high": 0.50}  # melt reaching lake
HUGGEL_A, HUGGEL_B = 0.104, 1.42   # V[m3] = 0.104 * A[m2]^1.42

# ---- lake id aliases: flood_zones.geojson (M1) vs lakes_master.geojson (M1) ----
LAKE_ID_ALIASES = {"imja": "imja_tsho", "thulagi": "thulagi_lake"}  # alias -> canonical

# ---- breach (Froehlich) ----
# PLACEHOLDER: dam/breach height per lake [m]. None -> proxy = mean lake depth (V/A).
DAM_HEIGHT_M = {"tsho_rolpa": None, "imja_tsho": None, "thulagi_lake": None}
BREACH_MODE = {"tsho_rolpa": "overtopping", "imja_tsho": "overtopping", "thulagi_lake": "overtopping"}  # PLACEHOLDER

# ---- AHP ----
AHP_WEIGHTS = {"hazard": 0.4, "exposure": 0.4, "vulnerability": 0.2}
HAZARD_SUBWEIGHTS = {"peak_discharge": 0.4, "volume": 0.4, "growth": 0.2}
VULNERABILITY = {"tsho_rolpa": 0.5, "imja_tsho": 0.5, "thulagi_lake": 0.5}  # PLACEHOLDER 0-1 (dam type/condition unknown)
CRITICALITY_WEIGHT = {"CRITICAL": 1.0, "HIGH": 0.8, "MEDIUM": 0.5, "LOW": 0.25}
TIER_WEIGHT = {"severe": 1.0, "moderate": 0.6, "low": 0.3}
RATING_THRESHOLDS = [(0.30, "Low"), (0.50, "Moderate"), (0.65, "High")]  # else "Very High"; heuristic bands

DISCLAIMER = ("Susceptibility ranking, not a prediction of when a lake will burst. "
              "Inputs marked PLACEHOLDER in config.py are unverified.")
DATA_SOURCES = [
    "NASA POWER (T2M, PRECTOTCORR)", "Landsat / Sentinel-2 (lake extents, via M1)",
    "NASADEM / Copernicus DEM GLO-30 (flood zones, via M1)", "OpenStreetMap (assets, via M1)",
    "RGI 7 via NSIDC (glacier area, pending)", "ICIMOD (inventory, supporting)",
]
# ---- hazard normalisation (heuristic; see README) ----
HAZARD_RANGES = {"log10_qp": (3.0, 3.0), "log10_vol_m3": (6.0, 3.0)}  # (floor, span): 1e3..1e6 m3/s, 1e6..1e9 m3
HAZARD_GROWTH_FULL_SCALE = 1.0   # +100% volume growth = full growth score
