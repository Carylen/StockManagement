"""
Parser for Scheduled-Plan (overhaul) upload files (XLSX).

Parsing is by HEADER NAME, not column position. Recognised columns
(canonical → aliases):

  distrik       → DISTRIK, SITE
  egi           → EGI
  cn            → CN
  activity      → ACTIVITY
  apl_activity  → APL ACTIVITY, APL
  npn           → NPN, PART NUMBER
  description   → DESC, DESCRIPTION
  req_qty       → QTY, REQ QTY
  status        → STATUS
  req_date      → REQ DATE
  est_date      → EST DATE

Columns not listed (e.g. QTY UT, READYNESS) are ignored — QTY UT is dropped
by design and READYNESS is derived live from `status`.

NPN-in-master validation is done in the service layer (needs DB).
"""
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime

import pandas as pd


ACTIVITIES = {"OVERHAUL", "MIDLIFE", "MANDATORY"}

REQUIRED_COLUMNS = {"distrik", "egi", "cn", "activity", "apl_activity", "npn", "req_qty"}

COLUMN_ALIASES: dict[str, list[str]] = {
    "distrik":      ["distrik", "site", "district"],
    "egi":          ["egi"],
    "cn":           ["cn"],
    "activity":     ["activity"],
    "apl_activity": ["apl activity", "apl_activity", "apl"],
    "npn":          ["npn", "part number", "part_number", "pn"],
    "description":  ["desc", "description", "deskripsi"],
    "req_qty":      ["qty", "req qty", "req_qty"],
    "status":       ["status"],
    "req_date":     ["req date", "req_date"],
    "est_date":     ["est date", "est_date"],
}


def _slug(s: str) -> str:
    return re.sub(r"[\s_\-]+", " ", str(s).strip().lower())


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    slug_to_orig = {_slug(c): c for c in df.columns}
    col_map: dict[str, str] = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if _slug(alias) in slug_to_orig:
                col_map[slug_to_orig[_slug(alias)]] = canonical
                break
    return df.rename(columns=col_map)


def _clean(val) -> str:
    if val is None:
        return ""
    s = str(val).strip()
    return "" if s.upper() in ("NAN", "NONE", "") else s


def _to_qty(val) -> float | None:
    try:
        if val is None or (isinstance(val, float) and pd.isna(val)):
            return None
        q = float(str(val).replace(",", ""))
        return q
    except (ValueError, TypeError):
        return None


def _to_date(val) -> date | None:
    if val is None or _clean(val) == "":
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    s = _clean(val)
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


@dataclass
class PlanRow:
    excel_row: int
    distrik: str
    egi: str
    cn: str
    activity: str
    apl_activity: str
    npn: str
    description: str
    req_qty: float
    status: str          # READY | NOT_READY
    ut_location: str | None
    req_date: date | None
    est_date: date | None


@dataclass
class PlanParseResult:
    rows: list[PlanRow] = field(default_factory=list)
    skipped: int = 0
    errors: list[dict] = field(default_factory=list)
    activities: set[str] = field(default_factory=set)
    sites: set[str] = field(default_factory=set)

    @property
    def total(self) -> int:
        return len(self.rows) + self.skipped

    @property
    def has_errors(self) -> bool:
        return bool(self.errors)


def _map_status(raw: str) -> tuple[str, str | None]:
    """READY → (READY, None); anything else (incl. blank) → (NOT_READY, raw_or_None)."""
    s = _clean(raw)
    if s.upper() == "READY":
        return "READY", None
    return "NOT_READY", (s or None)


def parse_plan_file(file_bytes: bytes, filename: str) -> PlanParseResult:
    result = PlanParseResult()

    try:
        df = pd.read_excel(io.BytesIO(file_bytes), dtype=object, keep_default_na=False)
    except Exception as e:  # noqa: BLE001
        result.errors.append({"row": 0, "reason": f"Failed to parse file: {e}"})
        return result

    df = _normalize_columns(df)
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        result.errors.append({
            "row": 0,
            "reason": (
                f"Missing required columns: {', '.join(sorted(missing)).upper()}. "
                f"Found: {', '.join(str(c) for c in df.columns)}"
            ),
        })
        return result

    has_status = "status" in df.columns
    has_desc = "description" in df.columns
    has_req_date = "req_date" in df.columns
    has_est_date = "est_date" in df.columns

    for idx, row in df.iterrows():
        line = int(idx) + 2  # 1-indexed + header row

        npn = _clean(row.get("npn"))
        if not npn:
            result.skipped += 1
            continue  # blank line — skip silently

        egi = _clean(row.get("egi"))
        cn = _clean(row.get("cn"))
        apl_activity = _clean(row.get("apl_activity"))
        distrik = _clean(row.get("distrik")).upper()
        activity = _clean(row.get("activity")).upper()

        if activity not in ACTIVITIES:
            result.errors.append({"row": line, "reason": f"ACTIVITY '{activity}' tidak valid"})
            result.skipped += 1
            continue
        if not (egi and cn and apl_activity and distrik):
            result.errors.append({"row": line, "reason": f"NPN {npn}: DISTRIK/EGI/CN/APL ACTIVITY tidak boleh kosong"})
            result.skipped += 1
            continue

        qty = _to_qty(row.get("req_qty"))
        if qty is None or qty <= 0:
            result.errors.append({"row": line, "reason": f"NPN {npn}: QTY tidak valid"})
            result.skipped += 1
            continue

        status, ut_location = _map_status(row.get("status")) if has_status else ("NOT_READY", None)

        result.rows.append(PlanRow(
            excel_row=line,
            distrik=distrik,
            egi=egi.upper(),
            cn=cn.upper(),
            activity=activity,
            apl_activity=apl_activity.upper(),
            npn=npn.upper(),
            description=_clean(row.get("description")) if has_desc else "",
            req_qty=qty,
            status=status,
            ut_location=ut_location,
            req_date=_to_date(row.get("req_date")) if has_req_date else None,
            est_date=_to_date(row.get("est_date")) if has_est_date else None,
        ))
        result.activities.add(activity)
        result.sites.add(distrik)

    return result
