"""
CSV/XLSX parser for UT (United Tractors) stock data.

Expected columns in the UT Excel file (supports single or two-row merged headers):
  PROD        → producer  (KOMAT / SCNIA)
  COMM        → commodity
  NEW PN      → part_number
  DESCRIPTION → description
  AGMR MIN    → min_qty
  AGMR MAX    → max_qty
  RTT / RANT  → rtt_qty  (Rantau Warehouse)
  TBD / SPUT  → tbd_qty  (Sputra/Banjarmasin Depot)
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
    "RTT": ["RTT", "RTT QTY", "RANTAU", "RANT", "RANT QTY"],
    "TBD": ["TBD", "TBD QTY", "BANJARMASIN", "SPUT", "SPUT QTY"],
}

_ALL_ALIASES: set[str] = {
    alias.upper()
    for aliases in COLUMN_ALIASES.values()
    for alias in aliases
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


def _row_alias_score(row_vals: list) -> int:
    return sum(1 for v in row_vals if str(v).upper().strip() in _ALL_ALIASES)


def _clean_cell(val) -> str:
    s = str(val).strip()
    return "" if s.upper() in ("NAN", "NONE", "") else s


def _read_excel_smart(file_bytes: bytes) -> pd.DataFrame:
    """
    Read an Excel file, handling both single-row and two-row merged headers.

    Two-row header pattern (common in UT files):
      Row N-1: group labels  → AGMR (merged), RANT, SPUT
      Row N:   sub-labels    → PROD, COMM, NEW PN, DESC, MIN, MAX, QTY, QTY
    Combined → AGMR MIN, AGMR MAX, RANT QTY, SPUT QTY ...
    """
    df_raw = pd.read_excel(
        io.BytesIO(file_bytes), header=None, dtype=str, keep_default_na=False
    )

    scan_limit = min(15, len(df_raw))

    # Find the row with the most alias matches — that is the true header row.
    best_row = max(range(scan_limit), key=lambda i: _row_alias_score(df_raw.iloc[i].tolist()))

    # If there's a row directly above and it has non-empty values but zero alias matches,
    # treat it as a group/merge header and combine the two rows.
    if best_row > 0:
        group_vals = df_raw.iloc[best_row - 1].tolist()
        sub_vals = df_raw.iloc[best_row].tolist()
        group_score = _row_alias_score(group_vals)

        if group_score == 0 and any(_clean_cell(v) for v in group_vals):
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

    # Fall back to single-header read.
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


def parse_ut_file(file_bytes: bytes, filename: str) -> ParseResult:
    """
    Parse a UT Excel/CSV file and return validated rows.

    Returns ParseResult with:
      .rows    — list of validated dicts ready for DB upsert
      .errors  — list of {row, reason} dicts
      .skipped — count of blank/header rows skipped
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

        if producer:
            p = producer.upper()
            if p in ("KOMATSU", "KOM"):
                producer = "KOMAT"
            elif p in ("SCANIA", "SCA"):
                producer = "SCNIA"
            else:
                producer = p[:10]

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
