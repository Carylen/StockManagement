"""
Pure-function helpers for parsing master Class V/G XLSX uploads.

All functions are synchronous; call parse_master_xlsx via asyncio.to_thread
in async routes.
"""
import io
from typing import Optional

import pandas as pd


_MASTER_ALIASES: dict[str, list[str]] = {
    "stockcode":      ["stockcode", "stock code", "stock_code", "kode stok"],
    "part_number":    ["part number", "part_number", "part no", "pn", "partnumber", "part no."],
    "description":    ["description", "desc", "deskripsi", "nama part", "part name"],
    "mnemonic":       ["mnemonic", "mnemo", "mnemonic code"],
    "commodity":      ["commodity", "komoditi", "komoditas", "comm"],
    "kelas":          ["class", "kelas", "kls", "classification"],
    "min_qty":        ["min", "min qty", "minimum", "min_qty"],
    "max_qty":        ["max", "max qty", "maximum", "max_qty"],
    "superseded_by":  ["new pn", "new part number", "pn baru", "part number baru", "superseded_by"],
}

REQUIRED_MASTER_COLUMNS = {"part_number", "kelas"}


def _alias_score(row_vals: list) -> int:
    all_up = {a.upper() for aliases in _MASTER_ALIASES.values() for a in aliases}
    return sum(1 for v in row_vals if str(v).upper().strip() in all_up)


def _normalize_master_cols(df: pd.DataFrame) -> pd.DataFrame:
    col_map: dict[str, str] = {}
    upper_cols = {c.upper().strip(): c for c in df.columns}
    for canonical, aliases in _MASTER_ALIASES.items():
        for alias in aliases:
            if alias.upper() in upper_cols:
                col_map[upper_cols[alias.upper()]] = canonical
                break
    return df.rename(columns=col_map)


def parse_master_xlsx(file_bytes: bytes) -> pd.DataFrame:
    """Return a normalized DataFrame from master XLSX with required columns."""
    df_raw = pd.read_excel(io.BytesIO(file_bytes), header=None, dtype=str, keep_default_na=False)
    scan = min(15, len(df_raw))
    header_row = max(range(scan), key=lambda i: _alias_score(df_raw.iloc[i].tolist()))
    df = pd.read_excel(io.BytesIO(file_bytes), header=header_row, dtype=str, keep_default_na=False)
    return _normalize_master_cols(df)


def safe_str(val) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    return s if s and s.upper() not in ("NAN", "NONE", "") else None


def safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        s = str(val).strip()
        if not s or s.upper() in ("NAN", "NONE", ""):
            return None
        return float(s.replace(",", ""))
    except (ValueError, TypeError):
        return None


def infer_producer(mnemonic: Optional[str]) -> str:
    """Komatsu if mnemonic starts with KOM, otherwise SCANIA."""
    if mnemonic and mnemonic.upper().startswith("KOM"):
        return "KOMATSU"
    return "SCANIA"
