"""Breach parameters. SI units.
tf and Bavg: Froehlich (2008), J. Hydraul. Eng. 134(12).
Qp: Froehlich (1995) form Qp = 0.607 Vw^0.295 hw^1.24 (m3/s). The 2008 Qp equation
constants were NOT reproduced from memory; verify against the paper before citing as 2008."""
import math
from . import config as C

G = 9.80665
K0 = {"overtopping": 1.4, "piping": 1.0}

def breach_height_m(lake_id, volume_m3, area_m2):
    h = C.DAM_HEIGHT_M.get(lake_id)
    if h: return float(h), "config_placeholder"
    return volume_m3 / area_m2, "proxy_mean_depth"

def froehlich(volume_m3: float, hb_m: float, mode: str = "overtopping") -> dict:
    k0 = K0.get(mode, 1.4)
    bavg = 0.27 * k0 * volume_m3 ** 0.32 * hb_m ** 0.04
    tf_s = 63.2 * math.sqrt(volume_m3 / (G * hb_m ** 2))
    qp = 0.607 * volume_m3 ** 0.295 * hb_m ** 1.24
    return {"peak_discharge_m3s": round(qp), "breach_time_h": round(tf_s / 3600, 2),
            "avg_breach_width_m": round(bavg, 1), "breach_height_m": round(hb_m, 1), "mode": mode,
            "equation_note": "tf,Bavg: Froehlich 2008; Qp: Froehlich 1995 (verify 2008 form)"}
