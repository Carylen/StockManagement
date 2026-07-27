"""
Parser for admin daily-readiness upload files (CSV or XLSX).

Reads: part_number, description, mnemonic, commodity, min, max, status,
rtt, tbd, total, estimasi. Site is NOT read from the file — it comes from
the uploading admin's account (or an explicit ?site= for all-sites principals).

Unlike ut_stock_parser.py, status is taken as-is from the file (trusted,
not recomputed) — but must be one of AMAN/WARNING/OVER, and total must
equal rtt + tbd, and max must be >= min. Rows failing these checks are
collected as row-level errors (not silently skipped), one of the stricter
UX requirements of this flow vs. the UT upload.
"""
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional

import pandas as pd


REQUIRED_COLUMNS = {"part_number", "min", "max", "rtt", "tbd", "total", "estimasi", "status"}

VALID_STATUSES = {"AMAN", "WARNING", "OVER"}

COLUMN_ALIASES: dict[str, list[str]] = {
    "part_number": ["part number", "part_number", "parts number", "parts_number", "part no", "parts no", "pn", "new pn", "new_pn", "partnumber"],
    "description": ["description", "desc", "deskripsi", "nama part"],
    "mnemonic":    ["mnemonic", "mnemonik", "prefix", "kode prefix"],
    "commodity":   ["commodity", "komoditi", "kategori", "cat", "group"],
    "min":         ["min", "min qty", "minimum", "agmr min", "agmr_min"],
    "max":         ["max", "max qty", "maximum", "agmr max", "agmr_max"],
    "status":      ["status", "stock status", "kondisi"],
    "rtt":         ["rtt", "rtt qty", "rantau", "rant", "rant qty"],
    "tbd":         ["tbd", "tbd qty", "banjarmasin", "sput", "sput qty"],
    "total":       ["total", "total qty", "jumlah"],
    "estimasi":    ["estimasi", "est", "in transit", "transit qty", "estimasi qty", "eta", "estimated date", "tgl estimasi"],
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


_DATE_FORMATS = [
    "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %b %Y",
    "%d %B %Y", "%Y/%m/%d", "%d-%b-%Y",
]


def _parse_date(val) -> Optional[date]:
    """Try to parse a cell value as a date. Returns None if unparseable or looks like a number."""
    s = _safe_str(val)
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


@dataclass
class AdminStockRow:
    row: int  # 1-based, matches the row number shown to the user (header = row 1)
    part_number: str
    description: Optional[str]
    mnemonic: Optional[str]
    commodity: Optional[str]
    min_qty: float
    max_qty: float
    rtt_qty: int
    tbd_qty: int
    estimated_date: Optional[date]
    status: str


@dataclass
class AdminStockRejection:
    row: int
    part_number: Optional[str]
    reason: str


@dataclass
class AdminStockParseResult:
    rows: list[AdminStockRow] = field(default_factory=list)
    rejected: list[AdminStockRejection] = field(default_factory=list)
    skipped: int = 0  # fully blank/placeholder rows, not counted as rejections
    errors: list[dict] = field(default_factory=list)  # file-level errors (missing columns, unreadable)

    @property
    def total(self) -> int:
        return len(self.rows) + len(self.rejected) + self.skipped

    @property
    def has_errors(self) -> bool:
        return bool(self.errors)


def parse_admin_stock_file(file_bytes: bytes, filename: str) -> AdminStockParseResult:
    """Parse an admin readiness upload file. Status is trusted as-is from the
    file (not recomputed) but validated against the AMAN/WARNING/OVER enum."""
    result = AdminStockParseResult()

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
        row_num = int(idx) + 2  # +1 for 0-index, +1 for header row

        part_number = _safe_str(row.get("part_number"))
        if not part_number or part_number.upper() in ("PART_NUMBER", "PART NUMBER", "N/A", "-", ""):
            result.skipped += 1
            continue
        part_number = part_number.upper()

        description = _safe_str(row.get("description"))
        mnemonic = _safe_str(row.get("mnemonic"))
        commodity_raw = _safe_str(row.get("commodity"))
        commodity = commodity_raw.upper() if commodity_raw else None

        min_qty = _safe_float(row.get("min"))
        max_qty = _safe_float(row.get("max"))
        rtt_qty = _safe_int(row.get("rtt"))
        tbd_qty = _safe_int(row.get("tbd"))
        total_qty = _safe_int(row.get("total"))
        estimated_date = _parse_date(row.get("estimasi"))
        status = (_safe_str(row.get("status")) or "").strip().upper()

        expected_total = rtt_qty + tbd_qty
        if total_qty != 0 and total_qty != expected_total:
            result.rejected.append(AdminStockRejection(
                row=row_num, part_number=part_number,
                reason=f"Total ({total_qty}) tidak sama dengan RTT ({rtt_qty}) + TBD ({tbd_qty}) = {expected_total}",
            ))
            continue

        if max_qty < min_qty:
            result.rejected.append(AdminStockRejection(
                row=row_num, part_number=part_number,
                reason=f"MAX ({max_qty}) lebih kecil dari MIN ({min_qty})",
            ))
            continue

        if status not in VALID_STATUSES:
            result.rejected.append(AdminStockRejection(
                row=row_num, part_number=part_number,
                reason=f"Status tidak dikenal: '{status or '(kosong)'}'. Harus salah satu dari AMAN, WARNING, OVER.",
            ))
            continue

        result.rows.append(AdminStockRow(
            row=row_num,
            part_number=part_number,
            description=description,
            mnemonic=mnemonic,
            commodity=commodity,
            min_qty=min_qty,
            max_qty=max_qty,
            rtt_qty=rtt_qty,
            tbd_qty=tbd_qty,
            estimated_date=estimated_date,
            status=status,
        ))

    return result
