"""
Stock status computation and readyness metrics.
"""
from typing import Optional
from decimal import Decimal


def compute_status(rtt_qty: int, min_qty: float, max_qty: float) -> str:
    """
    Compute stock status based on RTT quantity vs MIN/MAX thresholds.

    Rules:
      WARNING : RTT < MIN
      AMAN    : MIN <= RTT <= MAX (and RTT != MAX)
      MAX     : RTT == MAX (exact)
      OVER    : RTT > MAX
    """
    rtt = rtt_qty or 0
    mn = float(min_qty or 0)
    mx = float(max_qty or 0)

    if rtt < mn:
        return "WARNING"
    elif rtt > mx:
        return "OVER"
    elif rtt == mx:
        return "MAX"
    else:
        return "AMAN"


def compute_readyness(
    parts: list[dict],
) -> dict[str, float]:
    """
    Compute OH%, MIN%, FB% readyness metrics.

    Each dict in parts must have: rtt_qty, tbd_qty, min_qty.

    OH%  = parts where RTT > 0
    MIN% = parts where RTT >= MIN
    FB%  = parts where (RTT + TBD) >= MIN
    """
    total = len(parts)
    if total == 0:
        return {"oh_pct": 0.0, "min_pct": 0.0, "fb_pct": 0.0}

    oh_count = sum(1 for p in parts if (p.get("rtt_qty") or 0) > 0)
    min_count = sum(
        1 for p in parts if (p.get("rtt_qty") or 0) >= float(p.get("min_qty") or 0)
    )
    fb_count = sum(
        1
        for p in parts
        if ((p.get("rtt_qty") or 0) + (p.get("tbd_qty") or 0))
        >= float(p.get("min_qty") or 0)
    )

    return {
        "oh_pct": round(oh_count / total * 100, 1),
        "min_pct": round(min_count / total * 100, 1),
        "fb_pct": round(fb_count / total * 100, 1),
    }
