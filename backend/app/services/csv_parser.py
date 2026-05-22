"""
CSV/XLSX parser for UT (United Tractors) stock data.

Expected columns in the UT Excel file:
  PROD        → producer  (KOMAT / SCNIA)
  COMM        → commodity
  NEW PN      → part_number
  DESCRIPTION → description
  AGMR MIN    → min_qty
  AGMR MAX    → max_qty
  RTT         → rtt_qty  (Rantau Warehouse)
  TBD         → tbd_qty  (Banjarmasin Depot)
"""
import io
import uuid
from typing import Optional
from datetime import date, datetime, timezone

import pandas as pd

from app.services.stock_calc import compute_status


REQUIRED_COLUMNS = {"PROD", "COMM", "NEW PN", "DESCRIPTION", "AGMR MIN", "AGMR MAX", "RTT", "TBD"}

COLUMN_ALIASES = {
    "PROD": ["PROD", "PRODUCER", "PRODUSER"],
    "COMM": ["COMM", "COMMODITY", "KOMODITI"],
    "NEW PN": ["NEW PN", "NEW_PN", "PART NUMBER", "PART_NUMBER", "PN", "PART NO"],
    "DESCRIPTION": ["DESCRIPTION", "DESC", "DESKRIPSI", "NAMA PART"],
    "AGMR MIN": ["AGMR MIN", "AGMR_MIN", "MIN", "MIN QTY", "MINIMUM"],
    "AGMR MAX": ["AGMR MAX", "AGMR_MAX", "MAX", "MAX QTY", "MAXIMUM"],
    "RTT": ["RTT", "RTT QTY", "RANTAU"],
    "TBD": ["TBD", "TBD QTY", "BANJARMASIN"],
}


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Rename columns to canonical names, case-insensitively."""
    col_map = {}
    upper_cols = {c.upper().strip(): c for c in df.columns}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias.upper() in upper_cols:
                col_map[upper_cols[alias.upper()]] = canonical
                break
    return df.rename(columns=col_map)


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


def parse_ut_file(file_bytes: bytes, filename: str) -> ParseResult:
    """
    Parse a UT Excel/CSV file and return validated rows.

    Returns ParseResult with:
      .rows   — list of validated dicts ready for DB upsert
      .errors — list of error dicts {row, reason}
      .skipped — count of blank/header rows skipped
    """
    result = ParseResult()

    try:
        if filename.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes), dtype=str, keep_default_na=False)
        else:
            # Try to find the header row within the first 10 rows
            df_raw = pd.read_excel(io.BytesIO(file_bytes), header=None, dtype=str, keep_default_na=False)
            header_row = 0
            for i, row in df_raw.iterrows():
                row_upper = [str(v).upper().strip() for v in row.values]
                if any("NEW PN" in v or "PART" in v for v in row_upper):
                    header_row = i
                    break
            df = pd.read_excel(
                io.BytesIO(file_bytes),
                header=header_row,
                dtype=str,
                keep_default_na=False,
            )
    except Exception as e:
        result.errors.append({"row": 0, "reason": f"Failed to parse file: {str(e)}"})
        return result

    df = _normalize_columns(df)

    # Check required columns
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        result.errors.append({
            "row": 0,
            "reason": f"Missing required columns: {', '.join(sorted(missing))}. Found: {', '.join(df.columns.tolist())}",
        })
        return result

    snapshot_date = date.today()

    for idx, row in df.iterrows():
        row_num = int(idx) + 2  # 1-based + header

        part_number = _safe_str(row.get("NEW PN"))
        if not part_number or part_number.upper() in ("NEW PN", "N/A", "-", ""):
            result.skipped += 1
            continue

        description = _safe_str(row.get("DESCRIPTION"))
        producer = _safe_str(row.get("PROD"))
        commodity = _safe_str(row.get("COMM"))
        min_qty = _safe_float(row.get("AGMR MIN"))
        max_qty = _safe_float(row.get("AGMR MAX"))
        rtt_qty = _safe_int(row.get("RTT"))
        tbd_qty = _safe_int(row.get("TBD"))

        # Validate producer
        if producer and producer.upper() not in ("KOMAT", "SCNIA", "KOMATSU", "SCANIA"):
            # Normalize
            if producer.upper() in ("KOMATSU", "KOM"):
                producer = "KOMAT"
            elif producer.upper() in ("SCANIA", "SCA"):
                producer = "SCNIA"
        if producer:
            producer = producer.upper()[:10]

        if max_qty < min_qty:
            result.errors.append({
                "row": row_num,
                "reason": f"Part {part_number}: MAX ({max_qty}) < MIN ({min_qty})",
            })
            continue

        status = compute_status(rtt_qty, min_qty, max_qty)

        result.rows.append({
            "part_number": part_number,
            "description": description,
            "producer": producer,
            "commodity": commodity,
            "kelas": "V",
            "min_qty": min_qty,
            "max_qty": max_qty,
            "rtt_qty": rtt_qty,
            "tbd_qty": tbd_qty,
            "status": status,
            "snapshot_date": snapshot_date,
        })

    return result
