"""
Full UT STOCK seed — sites, users, employees, parts, stock levels, inquiries.

  docker compose exec backend python scripts/seed_ut.py

Idempotent: safe to re-run; existing rows are skipped.
"""
import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, engine, Base
from app.models.site import Site
from app.models.user import User
from app.models.employee import Employee
from app.models.part import Part
from app.models.stock import StockLevel
from app.models.inquiry import Inquiry, InquiryItem


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def pw(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def new_id() -> str:
    return str(uuid.uuid4())



# ---------------------------------------------------------------------------
# Seed data definitions
# ---------------------------------------------------------------------------

SITES = [
    {"code": "AGMR", "name": "Asam-Asam · GMR"},
    {"code": "RANT", "name": "Rantau"},
    {"code": "SPUT", "name": "Satui · Putera"},
]

USERS = [
    # Admin per site
    {
        "name": "Admin AGMR",
        "email": "admin.agmr@kpp.co.id",
        "password": "admin123",
        "role": "admin",
        "site": "AGMR",
    },
    {
        "name": "Admin RANT",
        "email": "admin.rant@kpp.co.id",
        "password": "admin123",
        "role": "admin",
        "site": "RANT",
    },
    {
        "name": "Admin SPUT",
        "email": "admin.sput@kpp.co.id",
        "password": "admin123",
        "role": "admin",
        "site": "SPUT",
    },
    # PIC UT — single global account, site = "ALL" (bypasses site scope)
    {
        "name": "PIC UT United Tractors",
        "email": "pic.ut@ut.co.id",
        "password": "ut123456",
        "role": "supplier",
        "site": "ALL",
    },
]

# Employees: Mekanik + GL per site
EMPLOYEES = [
    # AGMR
    {"nrp": "KM19142", "name": "Budi Santoso",     "site": "AGMR", "role": "mechanic"},
    {"nrp": "KM19143", "name": "Rudi Hermawan",    "site": "AGMR", "role": "mechanic"},
    {"nrp": "KM19144", "name": "Agus Setiawan",    "site": "AGMR", "role": "mechanic"},
    {"nrp": "GL19001", "name": "Hendra Wijaya",    "site": "AGMR", "role": "group_leader"},
    # RANT
    {"nrp": "KM29142", "name": "Doni Pratama",     "site": "RANT", "role": "mechanic"},
    {"nrp": "KM29143", "name": "Fajar Nugroho",    "site": "RANT", "role": "mechanic"},
    {"nrp": "KM29144", "name": "Rizal Hidayat",    "site": "RANT", "role": "mechanic"},
    {"nrp": "GL29001", "name": "Bambang Susanto",  "site": "RANT", "role": "group_leader"},
    # SPUT
    {"nrp": "KM39142", "name": "Eko Prasetyo",     "site": "SPUT", "role": "mechanic"},
    {"nrp": "KM39143", "name": "Wahyu Kurniawan",  "site": "SPUT", "role": "mechanic"},
    {"nrp": "KM39144", "name": "Teguh Santoso",    "site": "SPUT", "role": "mechanic"},
    {"nrp": "GL39001", "name": "Joko Widodo",      "site": "SPUT", "role": "group_leader"},
]

# Class V parts (monitored via daily readiness upload)
PARTS_V = [
    {"part_number": "600-311-3530", "description": "FILTER ASSY, OIL",           "mnemonic": "KOMATSU", "stockcode": "K-600311353"},
    {"part_number": "600-319-3860", "description": "FILTER ASSY, FUEL",          "mnemonic": "KOMATSU", "stockcode": "K-600319386"},
    {"part_number": "07063-01054",  "description": "FILTER, HYDRAULIC",          "mnemonic": "KOMATSU", "stockcode": "K-070630105"},
    {"part_number": "421-62-34160", "description": "BELT, V (FAN)",              "mnemonic": "KOMATSU", "stockcode": "K-421623416"},
    {"part_number": "20Y-62-41290", "description": "HOSE ASSY, OIL COOLER",     "mnemonic": "KOMATSU", "stockcode": "K-20Y624129"},
    {"part_number": "1879218C91",   "description": "FILTER ASSY, AIR",          "mnemonic": "KOMATSU", "stockcode": "K-187921891"},
    {"part_number": "1-87810015-0", "description": "ELEMENT, FILTER AIR",       "mnemonic": "KOMATSU", "stockcode": "K-187810015"},
    {"part_number": "2044-1309",    "description": "BELT, ALTERNATOR SCANIA",   "mnemonic": "SCANIA",  "stockcode": "S-20441309"},
    {"part_number": "H100-1218",    "description": "TOOTH ASSY HENSLEY",        "mnemonic": "HENSLEY", "stockcode": "HEN-H1001218"},
    {"part_number": "H100-1223",    "description": "ADAPTER HENSLEY SYS 100",   "mnemonic": "HENSLEY", "stockcode": "HEN-H1001223"},
]

# Class G parts (not in VHS; submitted via inquiry by Mekanik)
PARTS_G = [
    {"part_number": "6754-72-2120", "description": "BRACKET, FUEL FILTER",      "mnemonic": "KOMATSU", "stockcode": "K-675472212"},
    {"part_number": "208-60-61221", "description": "MOTOR ASSY, SWING",         "mnemonic": "KOMATSU", "stockcode": "K-208606122"},
    {"part_number": "22B-62-11590", "description": "PUMP ASSY, GEAR",           "mnemonic": "KOMATSU", "stockcode": "K-22B621159"},
    {"part_number": "6D125-LINER",  "description": "LINER ASSY, CYLINDER 6D125","mnemonic": "KOMATSU", "stockcode": "K-6D125LIN"},
]

# Stock levels per (part_number, site) — (min, max, rtt, tbd)
# tb_t_stock_levels: REPLACE semantics, no snapshot_date, estimated_date=None for seed
STOCK_DATA = [
    # 600-311-3530 oil filter
    ("600-311-3530", "AGMR", 4, 8, 7, 1),   # AMAN  (min<=rtt<max)
    ("600-311-3530", "RANT", 3, 6, 2, 2),   # WARNING (rtt<min)
    ("600-311-3530", "SPUT", 2, 5, 5, 0),   # MAX  (rtt==max)

    # 600-319-3860 fuel filter
    ("600-319-3860", "AGMR", 3, 6, 5, 0),   # AMAN
    ("600-319-3860", "RANT", 3, 6, 7, 0),   # OVER  (rtt>max)
    ("600-319-3860", "SPUT", 3, 6, 1, 1),   # WARNING

    # 07063-01054 hydraulic filter
    ("07063-01054",  "AGMR", 5, 10, 8, 2),  # AMAN
    ("07063-01054",  "RANT", 5, 10, 5, 0),  # AMAN
    ("07063-01054",  "SPUT", 5, 10, 3, 1),  # WARNING

    # 421-62-34160 v-belt fan
    ("421-62-34160", "AGMR", 2, 4, 4, 0),   # MAX
    ("421-62-34160", "RANT", 2, 4, 2, 0),   # AMAN
    ("421-62-34160", "SPUT", 2, 4, 1, 0),   # WARNING

    # 20Y-62-41290 hose assy
    ("20Y-62-41290", "AGMR", 2, 4, 3, 0),   # AMAN
    ("20Y-62-41290", "RANT", 2, 4, 0, 1),   # WARNING (rtt=0 < min)
    ("20Y-62-41290", "SPUT", 2, 4, 5, 0),   # OVER

    # 1879218C91 air filter
    ("1879218C91",   "AGMR", 3, 6, 6, 0),   # MAX
    ("1879218C91",   "RANT", 3, 6, 4, 0),   # AMAN
    ("1879218C91",   "SPUT", 3, 6, 2, 0),   # WARNING

    # 1-87810015-0 air element
    ("1-87810015-0", "AGMR", 4, 8, 6, 1),   # AMAN
    ("1-87810015-0", "RANT", 4, 8, 9, 0),   # OVER
    ("1-87810015-0", "SPUT", 4, 8, 4, 0),   # AMAN

    # 2044-1309 scania belt
    ("2044-1309",    "AGMR", 2, 4, 2, 0),   # AMAN
    ("2044-1309",    "RANT", 2, 4, 1, 1),   # WARNING
    ("2044-1309",    "SPUT", 2, 4, 3, 0),   # AMAN

    # H100-1218 hensley tooth
    ("H100-1218",    "AGMR", 10, 20, 15, 2), # AMAN
    ("H100-1218",    "RANT", 10, 20, 8,  3), # WARNING
    ("H100-1218",    "SPUT", 10, 20, 20, 0), # MAX

    # H100-1223 hensley adapter
    ("H100-1223",    "AGMR", 5, 10, 7, 1),  # AMAN
    ("H100-1223",    "RANT", 5, 10, 4, 0),  # WARNING
    ("H100-1223",    "SPUT", 5, 10, 12, 0), # OVER
]


def compute_status(rtt: int, min_qty: int, max_qty: int) -> str:
    if rtt < min_qty:
        return "WARNING"
    if rtt == max_qty:
        return "MAX"
    if rtt > max_qty:
        return "OVER"
    return "AMAN"


# ---------------------------------------------------------------------------
# Inquiry seed data (references employee NRPs resolved at runtime)
# ---------------------------------------------------------------------------

# Each entry = one Inquiry (header). items is a list of (part_number, part_name, qty, replacement_pn).
# (submitter_nrp, site, status, ut_note, items)
INQUIRY_DATA = [
    # AGMR — pending (multi-part)
    ("KM19142", "AGMR", "pending", None, [
        ("6754-72-2120", "BRACKET, FUEL FILTER",       2, None),
        ("208-60-61221", "MOTOR ASSY, SWING",           1, None),
    ]),
    ("KM19143", "AGMR", "pending", None, [
        ("6D125-LINER",  "LINER ASSY, CYLINDER 6D125",  1, None),
    ]),
    # AGMR — responded valid
    ("KM19144", "AGMR", "valid", "Stock available at RTT, ETA 3 working days.", [
        ("22B-62-11590", "PUMP ASSY, GEAR",             1, None),
    ]),
    # RANT — pending
    ("KM29142", "RANT", "pending", None, [
        ("6D125-LINER",  "LINER ASSY, CYLINDER 6D125",  4, None),
    ]),
    # RANT — responded invalid with replacement PN
    ("KM29143", "RANT", "invalid", "Available at SMR.", [
        ("6754-72-2120", "BRACKET, FUEL FILTER",        3, "6754-72-2121"),
    ]),
    # SPUT — pending
    ("KM39142", "SPUT", "pending", None, [
        ("208-60-61221", "MOTOR ASSY, SWING",           1, None),
    ]),
    # SPUT — responded valid
    ("KM39143", "SPUT", "valid", "Confirmed available at BTL.", [
        ("22B-62-11590", "PUMP ASSY, GEAR",             2, None),
        ("208-60-61221", "MOTOR ASSY, SWING",           1, None),
    ]),
]


# ---------------------------------------------------------------------------
# Seeder
# ---------------------------------------------------------------------------

async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # ── 1. Sites ──────────────────────────────────────────────────────
        print("Seeding sites...")
        for s in SITES:
            existing = await db.execute(select(Site).where(Site.code == s["code"]))
            if existing.scalar_one_or_none():
                print(f"  skip site {s['code']} (exists)")
                continue
            db.add(Site(code=s["code"], name=s["name"]))
            print(f"  + {s['code']}  {s['name']}")
        await db.commit()

        # ── 2. Users ──────────────────────────────────────────────────────
        print("\nSeeding users...")
        user_map: dict[str, User] = {}
        for u in USERS:
            existing = await db.execute(select(User).where(User.email == u["email"]))
            row = existing.scalar_one_or_none()
            if row:
                print(f"  skip {u['email']} (exists)")
                user_map[u["email"]] = row
                continue
            obj = User(
                name=u["name"],
                email=u["email"],
                password=pw(u["password"]),
                role=u["role"],
                site=u["site"],
            )
            db.add(obj)
            await db.flush()
            user_map[u["email"]] = obj
            print(f"  + {u['email']}  [{u['role']}]  site={u['site']}  pass={u['password']}")
        await db.commit()

        # ── 3. Employees ──────────────────────────────────────────────────
        print("\nSeeding employees...")
        emp_map: dict[str, Employee] = {}  # nrp -> Employee
        for e in EMPLOYEES:
            existing = await db.execute(
                select(Employee).where(Employee.nrp == e["nrp"].upper(), Employee.site == e["site"])
            )
            row = existing.scalar_one_or_none()
            if row:
                print(f"  skip {e['nrp']} @ {e['site']} (exists)")
                emp_map[e["nrp"].upper()] = row
                continue
            obj = Employee(
                nrp=e["nrp"].upper(),
                name=e["name"],
                site=e["site"],
                role=e["role"],
            )
            db.add(obj)
            await db.flush()
            emp_map[e["nrp"].upper()] = obj
            print(f"  + {e['nrp']}  {e['name']}  [{e['role']}]  {e['site']}")
        await db.commit()

        # ── 4. Parts (Class V) ────────────────────────────────────────────
        print("\nSeeding Class V parts...")
        part_map: dict[str, Part] = {}
        for p in PARTS_V:
            existing = await db.execute(select(Part).where(Part.part_number == p["part_number"]))
            row = existing.scalar_one_or_none()
            if row:
                print(f"  skip {p['part_number']} (exists)")
                part_map[p["part_number"]] = row
                continue
            obj = Part(
                part_number=p["part_number"],
                description=p["description"],
                mnemonic=p["mnemonic"],
                stockcode=p.get("stockcode"),
                kelas="V",
            )
            db.add(obj)
            await db.flush()
            part_map[p["part_number"]] = obj
            print(f"  + {p['part_number']}  {p['description']}")
        await db.commit()

        # ── 5. Parts (Class G) ────────────────────────────────────────────
        print("\nSeeding Class G parts...")
        for p in PARTS_G:
            existing = await db.execute(select(Part).where(Part.part_number == p["part_number"]))
            row = existing.scalar_one_or_none()
            if row:
                print(f"  skip {p['part_number']} (exists)")
                continue
            obj = Part(
                part_number=p["part_number"],
                description=p["description"],
                mnemonic=p["mnemonic"],
                stockcode=p.get("stockcode"),
                kelas="G",
            )
            db.add(obj)
            print(f"  + {p['part_number']}  {p['description']}")
        await db.commit()

        # ── 6. Stock levels (tb_t_stock_levels — REPLACE semantics) ──────────
        print("\nSeeding stock levels...")
        # Build description lookup from parts seed data
        desc_map = {p["part_number"]: p["description"] for p in PARTS_V}

        for pn, site, min_q, max_q, rtt, tbd in STOCK_DATA:
            existing = await db.execute(
                select(StockLevel).where(
                    StockLevel.part_number == pn,
                    StockLevel.site == site,
                )
            )
            if existing.scalar_one_or_none():
                print(f"  skip stock {pn}@{site} (exists)")
                continue

            status = compute_status(rtt, min_q, max_q)
            db.add(StockLevel(
                part_number=pn,
                site=site,
                description=desc_map.get(pn),
                commodity=None,
                min_qty=min_q,
                max_qty=max_q,
                rtt_qty=rtt,
                tbd_qty=tbd,
                estimated_date=None,
                status=status,
                updated_at=datetime.now(timezone.utc),
            ))
            print(f"  + {pn:<20}  {site}  rtt={rtt} min={min_q} max={max_q}  → {status}")
        await db.commit()

        # ── 7. Inquiries ──────────────────────────────────────────────────
        print("\nSeeding inquiries...")
        for nrp, site, status, ut_note, items in INQUIRY_DATA:
            emp = emp_map.get(nrp.upper())
            if emp is None:
                r = await db.execute(
                    select(Employee).where(Employee.nrp == nrp.upper(), Employee.site == site)
                )
                emp = r.scalar_one_or_none()
            if emp is None:
                print(f"  WARN: employee {nrp} not found, skip inquiry")
                continue

            # Idempotency: skip if same submitter_nrp + site + first item PN already exists
            first_pn = items[0][0] if items else ""
            existing = await db.execute(
                select(Inquiry)
                .join(InquiryItem, InquiryItem.inquiry_id == Inquiry.id)
                .where(
                    Inquiry.submitted_by_nrp == emp.nrp,
                    Inquiry.site == site,
                    InquiryItem.part_number == first_pn,
                )
            )
            if existing.scalar_one_or_none():
                print(f"  skip inquiry by {nrp} @ {site} [{status}] (exists)")
                continue

            # status/respond fields are now per-item (not on Inquiry)
            is_responded = status in ("valid", "invalid")
            responded_at = datetime.now(timezone.utc) - timedelta(hours=2) if is_responded else None

            inq = Inquiry(
                site=site,
                submitted_by_nrp=emp.nrp,
                submitted_by_name=emp.name,
            )
            db.add(inq)
            await db.flush()

            for pn, part_name, qty, replacement_pn in items:
                db.add(InquiryItem(
                    inquiry_id=inq.id,
                    part_number=pn,
                    part_name=part_name,
                    qty=qty,
                    status=status if is_responded else "pending",
                    replacement_pn=replacement_pn,
                    ut_note=ut_note if is_responded else None,
                    responded_at=responded_at,
                    responded_by="UT Seed" if is_responded else None,
                ))

            pn_list = ", ".join(i[0] for i in items)
            print(f"  + [{status}]  {pn_list}  by {nrp} @ {site}  ({len(items)} parts)")
        await db.commit()

    # ── Summary ───────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("Seed complete. Credentials:")
    print("-" * 60)
    for u in USERS:
        print(f"  {u['email']:<35} pass={u['password']}  role={u['role']}  site={u['site']}")
    print("-" * 60)
    print("Employee NRP logins (passwordless via /v1/auth/login-nrp):")
    for e in EMPLOYEES:
        print(f"  {e['nrp']:<12} {e['name']:<22} [{e['role']}]  {e['site']}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed())
