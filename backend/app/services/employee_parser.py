from io import BytesIO
import pandas as pd

_ALIASES = {
    "no":   ["no", "#", "nomor"],
    "nrp":  ["nrp", "nrp/nik", "nik", "id karyawan"],
    "name": ["nama", "name", "nama lengkap", "full name"],
    "role": ["posisi", "role", "jabatan", "position", "status"],
}

_ROLE_MAP = {
    "mekanik":      "mechanic",
    "mechanic":     "mechanic",
    "teknisi":      "mechanic",
    "gl":           "group_leader",
    "group leader": "group_leader",
    "group_leader": "group_leader",
    "kepala group": "group_leader",
}

_REQUIRED = {"nrp", "name", "role"}


def _normalize_columns(df: pd.DataFrame):
    df.columns = [str(c).strip().lower() for c in df.columns]
    col_map = {}
    for canonical, aliases in _ALIASES.items():
        for alias in aliases:
            if alias in df.columns and canonical not in col_map.values():
                col_map[alias] = canonical
    df = df.rename(columns=col_map)
    missing = _REQUIRED - set(df.columns)
    return df, list(missing)


def parse_employee_excel(content: bytes) -> dict:
    try:
        df = pd.read_excel(BytesIO(content), dtype=str)
    except Exception as exc:
        return {"error": str(exc), "rows": [], "parse_errors": []}

    df, missing = _normalize_columns(df)
    if missing:
        return {
            "error": f"Kolom tidak ditemukan: {', '.join(missing).upper()}",
            "rows": [],
            "parse_errors": [],
        }

    rows = []
    parse_errors = []

    for idx, row in df.iterrows():
        line = int(idx) + 2  # Excel row number (1-indexed + header)

        nrp = str(row.get("nrp", "")).strip().upper()
        if not nrp or nrp in ("", "NAN", "NONE"):
            continue  # skip blank rows silently

        name = str(row.get("name", "")).strip()
        raw_role = str(row.get("role", "")).strip().lower()

        if not name or name.upper() in ("NAN", "NONE"):
            parse_errors.append({"row": line, "reason": f"NRP {nrp}: nama kosong"})
            continue

        role = _ROLE_MAP.get(raw_role)
        if role is None:
            parse_errors.append({
                "row": line,
                "reason": f"NRP {nrp}: posisi '{raw_role}' tidak dikenali — gunakan Mekanik atau GL",
            })
            continue

        rows.append({"nrp": nrp, "name": name, "role": role})

    return {"error": None, "rows": rows, "parse_errors": parse_errors}
