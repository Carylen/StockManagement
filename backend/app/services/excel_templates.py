"""
Pure-function XLSX builders for downloadable templates.

Each function is synchronous and CPU-bound; call via asyncio.to_thread in async routes.

Usage:
    from app.services.excel_templates import build_readiness, build_master, build_employees
    data = await asyncio.to_thread(build_master)
"""
import io
from datetime import date

import openpyxl
import openpyxl.utils
from openpyxl.styles import Alignment, Font, PatternFill
from typing import Optional


XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

_HEADER_BG = "1F6F4C"


def _styled_header(ws, headers: list[str], bg_hex: str = _HEADER_BG) -> None:
    fill  = PatternFill("solid", fgColor=bg_hex)
    font  = Font(bold=True, color="FFFFFF")
    align = Alignment(horizontal="center", vertical="center")
    for col_idx, h in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx, value=h)
        cell.font  = font
        cell.fill  = fill
        cell.alignment = align


def _set_col_widths(ws, widths: list[int]) -> None:
    for col_idx, w in enumerate(widths, start=1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = w


# ── Readiness (daily stock upload) ───────────────────────────────────────────

def build_readiness(site: Optional[str] = None) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Readiness"

    headers = ["part_number", "description", "min", "max", "status", "rtt", "tbd", "total", "estimasi"]
    _styled_header(ws, headers)

    samples = [
        ["600-311-3750", "Filter Oli Engine Komatsu",  2.0, 5.0, "AMAN",    4, 0, 4, ""],
        ["1873018",      "Air Filter Scania P460",      1.0, 3.0, "WARNING", 0, 1, 1, "15/06/2026"],
        ["207-70-73181", "Seal Kit Undercarriage",      1.0, 2.0, "MAX",     2, 0, 2, ""],
    ]
    for row in samples:
        ws.append(row)

    _set_col_widths(ws, [20, 40, 6, 6, 10, 6, 6, 8, 10])
    ws.freeze_panes = "A2"

    info = wb.create_sheet("Info")
    notes = [
        ["Kolom",       "Keterangan"],
        ["part_number", "Wajib. Nomor part (PN). Case-insensitive."],
        ["description", "Opsional. Nama/deskripsi part."],
        ["min",         "Qty minimum stok (angka desimal diperbolehkan)."],
        ["max",         "Qty maksimum stok. Harus >= min."],
        ["status",      "WARNING | AMAN | OVER | MAX — di-recompute ulang oleh backend."],
        ["rtt",         "Qty stok RTT (integer)."],
        ["tbd",         "Qty stok TBD (integer)."],
        ["total",       "Harus sama dengan rtt + tbd. Isi 0 jika tidak tahu."],
        ["estimasi",    "Opsional. Tanggal estimasi kedatangan (format: DD/MM/YYYY atau YYYY-MM-DD). Kosongkan jika tidak ada."],
        ["",            ""],
        ["Catatan",     f"Site: {site or '(sesuai akun admin yang upload)'}"],
    ]
    for r in notes:
        info.append(r)
    info.column_dimensions["A"].width = 16
    info.column_dimensions["B"].width = 60

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── Master Class V/G ──────────────────────────────────────────────────────────

def build_master() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Master Class VG"

    headers = ["Stockcode", "Part Number", "Description", "Mnemonic", "Commodity", "Class"]
    _styled_header(ws, headers)

    samples = [
        ["KOM-ENG-001", "600-311-3750",  "Filter Oli Engine Komatsu",  "KOM-ENG", "ENGINE",        "V"],
        ["SCA-BDY-001", "1873018",       "Air Filter Scania P460",     "SCA-BDY", "BODY",          "G"],
        ["KOM-UDR-001", "207-70-73181",  "Seal Kit Undercarriage",     "KOM-UDR", "UNDERCARRIAGE", "V"],
    ]
    for row in samples:
        ws.append(row)

    _set_col_widths(ws, [18, 20, 45, 16, 20, 8])
    ws.freeze_panes = "A2"

    info = wb.create_sheet("Info")
    notes = [
        ["Kolom",       "Keterangan"],
        ["Stockcode",   "Opsional. Kode stok internal."],
        ["Part Number", "Wajib. Nomor part (PN)."],
        ["Description", "Opsional. Nama/deskripsi part."],
        ["Mnemonic",    "Opsional. Prefix KOM* → Komatsu, lainnya → Scania."],
        ["Commodity",   "Opsional. Nama komoditi (ENGINE, BODY, UNDERCARRIAGE, dll.)."],
        ["Class",       "Wajib. V atau G (huruf kapital)."],
    ]
    for r in notes:
        info.append(r)
    info.column_dimensions["A"].width = 16
    info.column_dimensions["B"].width = 55

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── Employees (bulk import) ───────────────────────────────────────────────────

def build_employees() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Karyawan"

    headers = ["NRP", "Nama", "Posisi", "Shift"]
    _styled_header(ws, headers)

    samples = [
        ["KM19142", "Budi Santoso",    "Mekanik", "Day"],
        ["KM20015", "Ahmad Fauzi",     "GL",      "Day"],
        ["KM18033", "Rini Widiastuti", "Mekanik", "Night"],
    ]
    for row in samples:
        ws.append(row)

    _set_col_widths(ws, [14, 30, 12, 10])
    ws.freeze_panes = "A2"

    info = wb.create_sheet("Info")
    notes = [
        ["Kolom",  "Keterangan"],
        ["NRP",    "Wajib. ID karyawan (case-insensitive, disimpan uppercase)."],
        ["Nama",   "Wajib. Nama lengkap karyawan."],
        ["Posisi", "Wajib. Mekanik atau GL."],
        ["Shift",  "Opsional. Day, Night, dsb."],
    ]
    for r in notes:
        info.append(r)
    info.column_dimensions["A"].width = 10
    info.column_dimensions["B"].width = 55

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
