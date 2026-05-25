"""
CSV/XLSX parser for readiness upload v2.0.

Expected columns (site is taken from the uploading admin's account, not the file):
  part_number  → part_number
  description  → description
  min          → min_qty
  max          → max_qty
  status       → status (taken as-is from file, no recompute)
  rtt          → rtt_qty
  tbd          → tbd_qty
  total        → validated: must equal rtt + tbd
  estimasi     → estimated_qty
"""
import io
import re
from typing import Optional
from datetime import date

import pandas as pd


REQUIRED_COLUMNS = {"part_number", "min", "max", "rtt", "tbd", "total", "estimasi", "status"}

COLUMN_ALIASES = {
    "part_number": ["part number", "part_number", "parts number", "parts_number", "part no", "parts no", "pn", "new pn", "new_pn", "partnumber"],
    "description": ["description", "desc", "deskripsi", "nama part"],
    "min":         ["min", "min qty", "minimum", "agmr min", "agmr_min"],
    "max":         ["max", "max qty", "maximum", "agmr max", "agmr_max"],
    "status":      ["status", "stock status", "kondisi"],
    "rtt":         ["rtt", "rtt qty", "rantau", "rant", "rant qty"],
    "tbd":         ["tbd", "tbd qty", "banjarmasin", "sput", "sput qty"],
    "total":       ["total", "total qty", "jumlah"],
    "estimasi":    ["estimasi", "est", "in transit", "transit qty", "estimasi qty"],
}


def _slug(s: str) -> str:
    """Normalize a column header: lowercase, collapse spaces/dashes/underscores to single space."""
    return re.sub(r"[\s_\-]+", " ", s.strip().lower())


_ALL_ALIAS_SLUGS: set[str] = {
    _slug(alias)
    for aliases in COLUMN_ALIASES.values()
    for alias in aliases
}


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    slug_to_orig = {_slug(c): c for c in df.columns}
    col_map = {}
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


def _safe_int(val) -> int:
    try:
        if pd.isna(val):
            return 0
        return int(float(val))
    except (ValueError, TypeError):
        return 0


def _safe_float(val) -> float:
    try:
        if pd.isna(val):
            return 0.0
        return float(val)
    except (ValueError, TypeError):
        return 0.0


def _safe_str(val) -> Optional[str]:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).strip()
    return s if s else None


class ParseResult:
    def __init__(self):
        self.rows: list[dict] = []
        self.errors: list[dict] = []
        self.skipped: int = 0

    @property
    def total(self) -> int:
        return len(self.rows) + len(self.errors) + self.skipped

    @property
    def processed(self) -> int:
        return len(self.rows)

    @property
    def error_count(self) -> int:
        return len(self.errors)


def parse_readiness_file(file_bytes: bytes, filename: str) -> ParseResult:
    """
    Parse a readiness upload file (v2.0 format).
    Site is NOT read from the file — it comes from the uploading admin's account.
    """
    result = ParseResult()

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

    snapshot_date = date.today()

    for idx, row in df.iterrows():
        row_num = int(idx) + 2

        part_number = _safe_str(row.get("part_number"))
        if not part_number or part_number.upper() in ("PART_NUMBER", "PART NUMBER", "N/A", "-", ""):
            result.skipped += 1
            continue

        description = _safe_str(row.get("description"))
        min_qty = _safe_float(row.get("min"))
        max_qty = _safe_float(row.get("max"))
        rtt_qty = _safe_int(row.get("rtt"))
        tbd_qty = _safe_int(row.get("tbd"))
        total_qty = _safe_int(row.get("total"))
        estimated_qty = _safe_int(row.get("estimasi"))

        # Validate total consistency
        expected_total = rtt_qty + tbd_qty
        if total_qty != 0 and total_qty != expected_total:
            result.errors.append({
                "row": row_num,
                "reason": (
                    f"Part {part_number}: total ({total_qty}) does not match "
                    f"rtt ({rtt_qty}) + tbd ({tbd_qty}) = {expected_total}"
                ),
            })
            continue

        if max_qty < min_qty:
            result.errors.append({
                "row": row_num,
                "reason": f"Part {part_number}: MAX ({max_qty}) < MIN ({min_qty})",
            })
            continue

        status = (_safe_str(row.get("status")) or "").strip().upper()

        result.rows.append({
            "part_number": part_number,
            "description": description,
            "min_qty": min_qty,
            "max_qty": max_qty,
            "rtt_qty": rtt_qty,
            "tbd_qty": tbd_qty,
            "estimated_qty": estimated_qty,
            "status": status,
            "snapshot_date": snapshot_date,
        })

    return result
