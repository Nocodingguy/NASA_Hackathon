import pandas as pd
import pymannkendall as mk
from scipy.stats import theilslopes

def _yearly(daily, how):
    s = pd.Series(daily)
    s.index = pd.to_datetime(s.index, format="%Y%m%d")
    s = s.where(s > -900)                      # -999 = missing
    g = s.groupby(s.index.year)
    ok = g.count() >= 300                      # drop years with too many gaps
    out = g.mean() if how == "mean" else g.sum()
    return out[ok]

def analyze(daily, how, unit):
    s = _yearly(daily, how).dropna()
    r = mk.hamed_rao_modification_test(s.values)
    slope, _, lo, hi = theilslopes(s.values, s.index.values)
    sig = r.p < 0.05
    verdict = (f"Statistically significant {r.trend} trend of {slope:+.3f} {unit}/yr (p={r.p:.3f})"
               if sig else f"No statistically significant trend (p={r.p:.3f})")
    return {"trend": r.trend, "p_value": float(r.p), "z": float(r.z),
            "slope_per_yr": float(slope), "slope_ci": [float(lo), float(hi)],
            "significant": bool(sig), "verdict": verdict,
            "series": [{"year": int(y), "value": round(float(v), 3)} for y, v in s.items()]}