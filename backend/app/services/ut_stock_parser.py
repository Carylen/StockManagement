"""
Parser for UT/Supplier stock upload files (CSV or XLSX).

Reads these columns (material/plnt/avail_stock required, rtt/tbd/estimasi optional):
  material    → part_number
  plnt        → plnt_code
  avail_stock → avail_stock (used as-is only when rtt/tbd are absent for the row)
  rtt         → rtt_qty (optional)
  tbd         → tbd_qty (optional)
  estimasi    → estimated_date (optional, informational — no cross-validation
                against tbd, same lenient convention as the admin upload)

When a row has rtt and/or tbd filled in, avail_stock is recomputed as just
rtt_qty (on-hand now) — this mirrors the admin daily-readiness upload, where
avail_stock/status are driven by RTT alone and TBD (incoming/in-transit) is
kept as a separate informational figure, not counted as "available" yet.
Whatever the file's own avail_stock cell says is ignored for that row. Rows
with neither rtt nor tbd filled in keep the legacy behavior: avail_stock read
straight from the file.

No master-KPP validation here — that is done in the service layer.
"""
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional

import pandas as pd


REQUIRED_COLUMNS = {"material", "plnt", "avail_stock"}

COLUMN_ALIASES: dict[str, list[str]] = {
    "material":    ["material", "part number", "part_number", "pn", "matnr"],
    "plnt":        ["plnt", "plant", "wh", "warehouse", "site", "loc"],
    "avail_stock": [
        "avail stock", "avail_stock", "available stock",
        "available_stock", "stock", "qty available", "qty",
    ],
    "rtt": ["rtt", "rtt qty", "rantau", "rant", "rant qty"],
    "tbd": ["tbd", "tbd qty", "banjarmasin", "sput", "sput qty"],
    "estimasi": ["estimasi", "est", "in transit", "transit qty", "estimasi qty", "eta", "estimated date", "tgl estimasi"],
}


def _slug(s: str) -> str:
    return re.sub(r"[\s_\-]+", " ", s.strip().lower())


_ALL_ALIAS_SLUGS: set[str] = {
    _slug(alias)
    for aliases in COLUMN_ALIASES.values()
    for alias in aliases
}


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    slug_to_orig = {_slug(c): c for c in df.columns}
    col_map: dict[str, str] = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if _slug(alias) in slug_to_orig:
                col_map[slug_to_orig[_slug(alias)]] = canonical
                break
    return df.rename(columns=col_map)


def _row_alias_score(row_vals: list) -> int:
    return sum(1 for v in row_vals if _slug(str(v)) in _ALL_ALIAS_SLUGS)


def _clean_cell(val) -> str:
    s = str(val).strip()
    return "" if s.upper() in ("NAN", "NONE", "") else s


def _safe_float(val) -> float:
    try:
        if pd.isna(val):
            return 0.0
        return float(str(val).replace(",", ""))
    except (ValueError, TypeError):
        return 0.0


class _InvalidNumericValue(ValueError):
    """Raised when an optional RTT/TBD cell holds non-blank, non-numeric text —
    blank/missing cells are fine (means 'not provided'), but garbage text
    shouldn't be silently coerced into a number."""


def _optional_int(val) -> Optional[int]:
    if val is None:
        return None
    s = str(val).strip()
    if s == "" or s.upper() in ("NAN", "NONE"):
        return None
    try:
        return int(float(s.replace(",", "")))
    except (ValueError, TypeError):
        raise _InvalidNumericValue(str(val))


_DATE_FORMATS = [
    "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %b %Y",
    "%d %B %Y", "%Y/%m/%d", "%d-%b-%Y",
]


def _parse_date(val) -> Optional[date]:
    """Try to parse a cell value as a date. Returns None if unparseable or looks like a number."""
    s = _clean_cell(val)
    if not s:
        return None
    try:
        float(s)
        return None
    except ValueError:
        pass
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _read_excel_smart(file_bytes: bytes) -> pd.DataFrame:
    df_raw = pd.read_excel(
        io.BytesIO(file_bytes), header=None, dtype=str, keep_default_na=False
    )
    scan_limit = min(15, len(df_raw))
    best_row = max(range(scan_limit), key=lambda i: _row_alias_score(df_raw.iloc[i].tolist()))

    if best_row > 0:
        group_vals = df_raw.iloc[best_row - 1].tolist()
        sub_vals = df_raw.iloc[best_row].tolist()
        if _row_alias_score(group_vals) == 0 and any(_clean_cell(v) for v in group_vals):
            combined_cols = []
            last_group = ""
            for g, s in zip(group_vals, sub_vals):
                g = _clean_cell(g)
                s = _clean_cell(s)
                if g:
                    last_group = g
                if last_group and s:
                    combined_cols.append(f"{last_group} {s}")
                elif s:
                    combined_cols.append(s)
                elif last_group:
                    combined_cols.append(last_group)
                else:
                    combined_cols.append(f"_col_{len(combined_cols)}")
            data = df_raw.iloc[best_row + 1:].reset_index(drop=True)
            data.columns = combined_cols[: len(data.columns)]
            df = _normalize_columns(data)
            if not (REQUIRED_COLUMNS - set(df.columns)):
                return df

    return pd.read_excel(
        io.BytesIO(file_bytes), header=best_row, dtype=str, keep_default_na=False
    )


@dataclass
class UTStockRow:
    part_number: str
    plnt_code: str
    avail_stock: float
    rtt_qty: Optional[int] = None
    tbd_qty: Optional[int] = None
    estimated_date: Optional[date] = None


@dataclass
class UTParseResult:
    rows: list[UTStockRow] = field(default_factory=list)
    skipped: int = 0
    errors: list[dict] = field(default_factory=list)
    plnt_codes_found: set[str] = field(default_factory=set)

    @property
    def total(self) -> int:
        return len(self.rows) + self.skipped

    @property
    def has_errors(self) -> bool:
        return bool(self.errors)


def parse_ut_stock_file(file_bytes: bytes, filename: str) -> UTParseResult:
    result = UTParseResult()

    try:
        if filename.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes), dtype=str, keep_default_na=False)
            df = _normalize_columns(df)
        else:
            df = _read_excel_smart(file_bytes)
            df = _normalize_columns(df)
    except Exception as e:
        result.errors.append({"row": 0, "reason": f"Failed to parse file: {str(e)}"})
        return result

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        result.errors.append({
            "row": 0,
            "reason": (
                f"Missing required columns: {', '.join(sorted(missing))}. "
                f"Found: {', '.join(df.columns.tolist())}"
            ),
        })
        return result

    for idx, row in df.iterrows():
        material = _clean_cell(row.get("material", ""))
        if not material or material.upper() in ("MATERIAL", "PART NUMBER", "MATNR", "N/A", "-"):
            result.skipped += 1
            continue

        plnt_raw = _clean_cell(row.get("plnt", ""))
        if not plnt_raw:
            result.skipped += 1
            continue

        try:
            rtt_qty = _optional_int(row.get("rtt"))
            tbd_qty = _optional_int(row.get("tbd"))
        except _InvalidNumericValue:
            result.skipped += 1
            continue

        if rtt_qty is not None or tbd_qty is not None:
            # RTT/TBD provided → avail_stock = RTT only (on-hand now); TBD stays
            # separate/informational, same convention as the admin upload flow.
            avail_stock = float(rtt_qty or 0)
        else:
            avail_stock = _safe_float(row.get("avail_stock", 0))
        if avail_stock < 0:
            result.skipped += 1
            continue

        part_number = material.upper()
        plnt_code = plnt_raw.upper()
        estimated_date = _parse_date(row.get("estimasi"))

        result.rows.append(UTStockRow(
            part_number=part_number,
            plnt_code=plnt_code,
            avail_stock=avail_stock,
            rtt_qty=rtt_qty,
            tbd_qty=tbd_qty,
            estimated_date=estimated_date,
        ))
        result.plnt_codes_found.add(plnt_code)

    return result
