"""
Full UT STOCK seed — permissions, roles, sites, users, employees, parts, stock levels, inquiries.

  docker compose exec api python scripts/seed_ut.py

Idempotent: safe to re-run; existing rows are skipped.
"""
import asyncio
import sys
import os
from datetime import datetime, date, timezone, timedelta
from decimal import Decimal
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.rbac import PERMISSIONS, ROLE_PERMISSIONS, ROLES
from app.models.site import Site
from app.models.user import User
from app.models.permission import Role, Permission, RolePermission, SupplierSite
from app.models.part import Part
from app.models.stock import StockLevel
from app.models.inquiry import Inquiry, InquiryItem
from app.models.plan_period import PlanPeriod
from app.models.plan_line import PlanLine

# Map seed "employee" role labels → (canonical role, position)
_EMP_ROLE_MAP = {
    "group_leader": ("group_leader", "group_leader"),
    # GL-Planner: a Group Leader (position) who holds the planner role —
    # can approve inquiry, create inquiry, and manage scheduled plan.
    "planner": ("planner", "group_leader"),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def pw(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def new_id() -> str:
    return str(uuid.uuid4())


def _rel(days: int) -> date:
    """A date `days` from today — keeps seed scenarios (overdue, locked) true
    no matter when this script is actually run."""
    return date.today() + timedelta(days=days)



# ---------------------------------------------------------------------------
# Seed data definitions
# ---------------------------------------------------------------------------

SITES = [
    {"code": "AGMR", "name": "Asam-Asam · GMR"},
    {"code": "RANT", "name": "Rantau"},
    {"code": "SPUT", "name": "Satui · Putera"},
]

USERS = [
    # HO super admin (full access)
    {
        "name": "Super Admin HO",
        "email": "superadmin@kpp.co.id",
        "password": "super123",
        "role": "super_admin",
        "site": "ALL",
    },
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

# Employees: field staff (user) + GL per site
EMPLOYEES = [
    # AGMR
    {"nrp": "KM19142", "name": "Budi Santoso",     "site": "AGMR", "role": "user"},
    {"nrp": "KM19143", "name": "Rudi Hermawan",    "site": "AGMR", "role": "user"},
    {"nrp": "KM19144", "name": "Agus Setiawan",    "site": "AGMR", "role": "user"},
    {"nrp": "GL19001", "name": "Hendra Wijaya",    "site": "AGMR", "role": "group_leader"},
    {"nrp": "GL19002", "name": "Slamet Riyadi",    "site": "AGMR", "role": "planner"},
    # RANT
    {"nrp": "KM29142", "name": "Doni Pratama",     "site": "RANT", "role": "user"},
    {"nrp": "KM29143", "name": "Fajar Nugroho",    "site": "RANT", "role": "user"},
    {"nrp": "KM29144", "name": "Rizal Hidayat",    "site": "RANT", "role": "user"},
    {"nrp": "GL29001", "name": "Bambang Susanto",  "site": "RANT", "role": "group_leader"},
    {"nrp": "GL29002", "name": "Suryanto",         "site": "RANT", "role": "planner"},
    # SPUT
    {"nrp": "KM39142", "name": "Eko Prasetyo",     "site": "SPUT", "role": "user"},
    {"nrp": "KM39143", "name": "Wahyu Kurniawan",  "site": "SPUT", "role": "user"},
    {"nrp": "KM39144", "name": "Teguh Santoso",    "site": "SPUT", "role": "user"},
    {"nrp": "GL39001", "name": "Joko Widodo",      "site": "SPUT", "role": "group_leader"},
    {"nrp": "GL39002", "name": "Pramono Edhi",     "site": "SPUT", "role": "planner"},
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

# Class G parts (not in VHS; submitted via inquiry by field staff)
PARTS_G = [
    {"part_number": "6754-72-2120", "description": "BRACKET, FUEL FILTER",      "mnemonic": "KOMATSU", "stockcode": "K-675472212"},
    {"part_number": "208-60-61221", "description": "MOTOR ASSY, SWING",         "mnemonic": "KOMATSU", "stockcode": "K-208606122"},
    {"part_number": "22B-62-11590", "description": "PUMP ASSY, GEAR",           "mnemonic": "KOMATSU", "stockcode": "K-22B621159"},
    {"part_number": "6D125-LINER",  "description": "LINER ASSY, CYLINDER 6D125","mnemonic": "KOMATSU", "stockcode": "K-6D125LIN"},
]

# Overhaul parts (Class G) referenced by the Scheduled Plan test file
# "PLAN OVERHAUL JUNI 2026.xlsx" — needed so plan upload validates against master.
PARTS_OVERHAUL = [
    ("02765-00412", "HOSE"), ("02781-00422", "UNION"), ("02896-21012", "O-RING"),
    ("07000-15320", "O-RING"), ("07000-F3048", "O-RING"), ("07002-22034", "O-RING"),
    ("07095-00420", "CUSHION"), ("07298-01409", "HOSE"), ("02766-00508", "HOSE ASSY"),
    ("02766-00512", "HOSE"), ("02896-21015", "O-RING"), ("07000-F2060", "O-RING"),
    ("07297-01413", "HOSE"), ("07297-02013", "HOSE"), ("286-22-11850", "O-RING"),
    ("41E-14-11110", "O-RING"), ("02762-00506", "HOSE"), ("07000-B3032", "O-RING"),
    ("07000-B3038", "O-RING"), ("07098-01008", "HOSE ASSEMBLY, NONMETALLIC"),
    ("07098-01010", "HOSE"), ("07098-010A6", "HOSE"), ("07098-010A8", "HOSE"),
    ("208-62-51270", "HOSE ASSY"), ("07000-13038", "O-RING"), ("07000-13048", "O-RING"),
    ("07098-01414", "HOSE,NONMETALLIC"), ("07099-01216", "HOSE"),
    ("209-70-51190", "BUSHING, PIPE:"), ("209-70-71640", "SHIM"), ("209-70-71650", "SHIM"),
    ("209-72-11261", "SEAL, PLAIN ENCASED"), ("02896-11018", "O RING"),
    ("706-75-92310", "O-RING"), ("02896-11009", "O RING"), ("07000-15335", "O-RING"),
    ("207-62-64740", "O RING"), ("02896-61012", "O-RING"), ("02896-61015", "O-RING"),
    ("04064-01030", "SNAP RING"), ("04071-00140", "RING SNAP"), ("07000-02140", "O-RING"),
    ("07002-12034", "O-RING"), ("07002-13034", "O-RING"), ("07002-61823", "O-RING"),
    ("07002-62034", "O-RING"), ("07002-62434", "O-RING"), ("703-11-94120", "PLATE"),
    ("703-11-95120", "SEAL"), ("703-11-96120", "SEAL, PLAIN ENCASED"),
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

# Per-site approver NRP (a GL-Planner — only role `planner` holds can_approve_inquiry).
# Used to stamp approved_by on responded seed inquiries.
_SITE_APPROVER = {
    "AGMR": "GL19002",
    "RANT": "GL29002",
    "SPUT": "GL39002",
}

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
# Scheduled Plan seed data (admin-event-flow) — demonstrates the full model:
# an OPEN event with a BASELINE mix (ready / not-ready / overdue) plus one
# planner EXTRA line, and a LOCKED event that's still incomplete (drives the
# admin "OVERDUE" period badge). Dates are relative to today (see `_rel`) so
# the scenarios stay true no matter when this script runs.
# ---------------------------------------------------------------------------

# (name, site, start_offset, due_offset, uploader_email)
SCHEDULED_PLAN_PERIODS = [
    ("Overhaul " + date.today().strftime("%B %Y"), "AGMR", -20, 25, "admin.agmr@kpp.co.id"),
    ("Mandatory " + _rel(-60).strftime("%B %Y"),    "AGMR", -60, -15, "admin.agmr@kpp.co.id"),
]

# (period_name, activity, apl_activity, egi, cn, npn, desc, qty, req_date_offset,
#  ut_location, est_date_offset, origin, creator_nrp_or_None)
# is_ready requires BOTH ut_location and est_date filled (mirrors derive_readiness);
# ut_location is free-form location text, no magic "READY" value anymore.
# origin EXTRA uses creator_nrp to stamp created_by as that planner (not admin).
SCHEDULED_PLAN_LINES = [
    ("Overhaul " + date.today().strftime("%B %Y"), "OVERHAUL", "BRAKE SYSTEM", "PC850", "EX1001",
     "02765-00412", "HOSE", 2, 5, "Gudang UT AGMR", 3, "BASELINE", None),
    ("Overhaul " + date.today().strftime("%B %Y"), "OVERHAUL", "BRAKE SYSTEM", "PC850", "EX1001",
     "02781-00422", "UNION", 1, -3, None, None, "BASELINE", None),  # overdue: req_date already past
    ("Overhaul " + date.today().strftime("%B %Y"), "OVERHAUL", "MAIN PUMP", "PC850", "EX1002",
     "02896-21012", "O-RING", 4, 10, "KMSI BJM", None, "BASELINE", None),  # location only, no est_date yet
    ("Overhaul " + date.today().strftime("%B %Y"), "OVERHAUL", "MAIN PUMP", "PC850", "EX1003",
     "07000-15320", "O-RING", 1, 7, None, None, "EXTRA", "GL19002"),  # planner add, outside baseline

    ("Mandatory " + _rel(-60).strftime("%B %Y"), "MANDATORY", "STEERING", "PC850", "EX2001",
     "07098-01008", "HOSE ASSEMBLY, NONMETALLIC", 3, -25, "Gudang UT AGMR", -22, "BASELINE", None),
    ("Mandatory " + _rel(-60).strftime("%B %Y"), "MANDATORY", "STEERING", "PC850", "EX2002",
     "07099-01216", "HOSE", 2, -20, None, None, "BASELINE", None),  # never filled before LOCKED
]


# ---------------------------------------------------------------------------
# Seeder
# ---------------------------------------------------------------------------

async def seed():
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
                auth_method="password",
                role=u["role"],
                site=u["site"],
            )
            db.add(obj)
            await db.flush()
            user_map[u["email"]] = obj
            print(f"  + {u['email']}  [{u['role']}]  site={u['site']}  pass={u['password']}")
        await db.commit()

        # ── 3. Roles ──────────────────────────────────────────────────────
        print("\nSeeding roles...")
        for code, label, is_system in ROLES:
            existing = await db.execute(select(Role).where(Role.code == code))
            if existing.scalar_one_or_none():
                print(f"  skip role {code} (exists)")
                continue
            db.add(Role(code=code, label=label, is_system=is_system))
            print(f"  + {code}  [{label}]  system={is_system}")
        await db.commit()

        # ── 5. Permissions ────────────────────────────────────────────────
        print("\nSeeding permissions...")
        for code, label, group in PERMISSIONS:
            existing = await db.execute(select(Permission).where(Permission.code == code))
            if existing.scalar_one_or_none():
                print(f"  skip {code} (exists)")
                continue
            db.add(Permission(code=code, label=label, group_name=group))
            print(f"  + {code}")
        await db.commit()

        # ── 6. Role permissions ───────────────────────────────────────────
        print("\nSeeding role permissions...")
        for role, perms in ROLE_PERMISSIONS.items():
            for perm_code in perms:
                existing = await db.execute(
                    select(RolePermission).where(
                        RolePermission.role == role,
                        RolePermission.permission == perm_code,
                    )
                )
                if existing.scalar_one_or_none():
                    continue
                db.add(RolePermission(role=role, permission=perm_code))
            print(f"  + {role}  ({len(perms)} permissions)")
        await db.commit()

        # ── 7. Supplier site assignments ──────────────────────────────────
        print("\nSeeding supplier site assignments...")
        supplier_user = user_map.get("pic.ut@ut.co.id")
        super_admin_user = user_map.get("superadmin@kpp.co.id")
        if supplier_user:
            for site_code in ["AGMR", "RANT", "SPUT"]:
                existing = await db.execute(
                    select(SupplierSite).where(
                        SupplierSite.supplier_id == supplier_user.id,
                        SupplierSite.site_code == site_code,
                    )
                )
                if existing.scalar_one_or_none():
                    print(f"  skip {supplier_user.email} → {site_code} (exists)")
                    continue
                db.add(SupplierSite(
                    supplier_id=supplier_user.id,
                    site_code=site_code,
                    assigned_by=super_admin_user.id if super_admin_user else None,
                ))
                print(f"  + {supplier_user.email} → {site_code}")
            await db.commit()
        else:
            print("  WARN: supplier pic.ut@ut.co.id not found, skip site assignments")

        # ── 8. Employees (NRP-auth accounts in the unified users table) ───
        print("\nSeeding employees...")
        emp_map: dict[str, User] = {}  # nrp -> User
        for e in EMPLOYEES:
            existing = await db.execute(
                select(User).where(
                    User.auth_method == "nrp",
                    User.nrp == e["nrp"].upper(),
                    User.site == e["site"],
                )
            )
            row = existing.scalar_one_or_none()
            if row:
                print(f"  skip {e['nrp']} @ {e['site']} (exists)")
                emp_map[e["nrp"].upper()] = row
                continue
            canonical_role, position = _EMP_ROLE_MAP.get(e["role"], ("user", None))
            obj = User(
                auth_method="nrp",
                nrp=e["nrp"].upper(),
                name=e["name"],
                site=e["site"],
                role=canonical_role,
                position=position,
            )
            db.add(obj)
            await db.flush()
            emp_map[e["nrp"].upper()] = obj
            print(f"  + {e['nrp']}  {e['name']}  [{canonical_role}/{position}]  {e['site']}")
        await db.commit()

        # ── 9. Parts (Class V) ────────────────────────────────────────────
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

        # ── 10. Parts (Class G) ───────────────────────────────────────────
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

        # ── 10b. Overhaul parts (Class G) for Scheduled Plan ───────────────
        print("\nSeeding overhaul parts (Class G)...")
        for pn, desc in PARTS_OVERHAUL:
            existing = await db.execute(select(Part).where(Part.part_number == pn))
            if existing.scalar_one_or_none():
                continue
            db.add(Part(
                part_number=pn,
                description=desc,
                mnemonic="KOMATSU",
                kelas="G",
            ))
        await db.commit()
        print(f"  + {len(PARTS_OVERHAUL)} overhaul parts ensured")

        # ── 11. Stock levels (tb_t_stock_levels — REPLACE semantics) ────────
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

        # ── 12. Inquiries ─────────────────────────────────────────────────
        print("\nSeeding inquiries...")
        for nrp, site, status, ut_note, items in INQUIRY_DATA:
            emp = emp_map.get(nrp.upper())
            if emp is None:
                r = await db.execute(
                    select(User).where(
                        User.auth_method == "nrp",
                        User.nrp == nrp.upper(),
                        User.site == site,
                    )
                )
                emp = r.scalar_one_or_none()
            if emp is None:
                print(f"  WARN: employee {nrp} not found, skip inquiry")
                continue

            # Idempotency: skip if same submitter + site + first item PN already exists
            first_pn = items[0][0] if items else ""
            existing = await db.execute(
                select(Inquiry)
                .join(InquiryItem, InquiryItem.inquiry_id == Inquiry.id)
                .where(
                    Inquiry.submitted_by_user_id == emp.id,
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

            # Approval workflow: a responded inquiry must already have passed approval
            # (supplier can only respond to approved/not_required inquiries). Pending-item
            # inquiries are left awaiting approval so they legitimately fill the queue.
            approver = emp_map.get(_SITE_APPROVER.get(site, ""))
            if is_responded:
                approval_status = "approved"
                approved_by_user_id = approver.id if approver else None
                approved_at = datetime.now(timezone.utc) - timedelta(hours=3)
            else:
                approval_status = "pending"
                approved_by_user_id = None
                approved_at = None

            inq = Inquiry(
                site=site,
                submitted_by_user_id=emp.id,
                approval_status=approval_status,
                approved_by_user_id=approved_by_user_id,
                approved_at=approved_at,
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

        # ── 13. Scheduled Plan (admin-event-flow demo data) ─────────────────
        print("\nSeeding scheduled-plan events...")
        period_map: dict[str, PlanPeriod] = {}  # name -> PlanPeriod
        for name, site, start_off, due_off, uploader_email in SCHEDULED_PLAN_PERIODS:
            existing = await db.execute(
                select(PlanPeriod).where(PlanPeriod.site == site, PlanPeriod.name == name)
            )
            row = existing.scalar_one_or_none()
            if row:
                print(f"  skip event '{name}' @ {site} (exists)")
                period_map[name] = row
                continue
            uploader = user_map.get(uploader_email)
            obj = PlanPeriod(
                id=new_id(), site=site, name=name,
                start_date=_rel(start_off), due_date=_rel(due_off),
                source_filename="seed-baseline.xlsx",
                uploaded_by=uploader.id if uploader else None,
            )
            db.add(obj)
            await db.flush()
            period_map[name] = obj
            print(f"  + {name}  @ {site}  {_rel(start_off)} → {_rel(due_off)}")
        await db.commit()

        print("\nSeeding scheduled-plan lines...")
        admin_agmr = user_map.get("admin.agmr@kpp.co.id")
        for (period_name, activity, apl_activity, egi, cn, npn, desc, qty, req_off,
             ut_location, est_off, origin, creator_nrp) in SCHEDULED_PLAN_LINES:
            period = period_map.get(period_name)
            if period is None:
                print(f"  WARN: event '{period_name}' not seeded, skip line {npn}")
                continue
            existing = await db.execute(
                select(PlanLine).where(
                    PlanLine.period_id == period.id, PlanLine.egi == egi, PlanLine.cn == cn,
                    PlanLine.npn == npn, PlanLine.apl_activity == apl_activity,
                )
            )
            if existing.scalar_one_or_none():
                print(f"  skip line {npn} @ {period_name} (exists)")
                continue

            est_date = _rel(est_off) if est_off is not None else None
            is_ready = bool((ut_location or "").strip()) and est_date is not None
            status = "READY" if is_ready else "NOT_READY"
            creator = emp_map.get(creator_nrp) if creator_nrp else admin_agmr
            db.add(PlanLine(
                id=new_id(), period_id=period.id, activity=activity,
                egi=egi, cn=cn, apl_activity=apl_activity, npn=npn,
                description=desc, req_qty=Decimal(str(qty)), req_date=_rel(req_off),
                status=status, ut_location=ut_location, est_date=est_date,
                origin=origin, is_ready=is_ready,
                created_by=creator.id if creator else None,
                updated_by=creator.id if creator else None,
            ))
            tag = "READY" if is_ready else "pending"
            print(f"  + [{origin}] {npn}  {apl_activity} @ {period_name}  qty={qty}  {tag}")
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
