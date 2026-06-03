"""RBAC catalog — single source of truth for permissions & default role mapping.

This module holds *static* RBAC definitions only (no DB access). It is consumed by:
  - the Alembic seed migration (0002_rbac_foundation)
  - any re-seed / reset script
  - tests / reference

At runtime, effective permissions are always read from the database
(tb_m_role_permissions), never from this file — so HO can edit role
permissions without a code change. This catalog is just the *default* seed.
"""
from __future__ import annotations

# ── Permission catalog ──────────────────────────────────────────────
# (code, label, group_name)
PERMISSIONS: list[tuple[str, str, str]] = [
    # Site Data
    ("can_view_own_site",    "Lihat data site sendiri",            "Site Data"),
    ("can_view_all_sites",   "Lihat data semua site",              "Site Data"),
    ("can_upload_readiness", "Upload readiness harian",            "Site Data"),
    ("can_manage_master",    "Kelola master Class V/G",            "Site Data"),
    # Inquiry
    ("can_submit_inquiry",     "Submit inquiry Class G",           "Inquiry"),
    ("can_view_team_inquiry",  "Lihat inquiry tim",                "Inquiry"),
    ("can_view_all_inquiries", "Lihat semua inquiry",              "Inquiry"),
    ("can_respond_inquiry",    "Respond inquiry (UT/Supplier)",    "Inquiry"),
    # User Management
    ("can_manage_employees",  "Kelola data karyawan site",         "User Management"),
    ("can_manage_site_users", "Kelola akun user di site sendiri",  "User Management"),
    ("can_manage_all_users",  "Kelola semua akun user",            "User Management"),
    ("can_manage_suppliers",  "Kelola akun dan assignment supplier", "User Management"),
    ("can_manage_roles",      "Kelola role dan permission",        "User Management"),
    # HO
    ("can_manage_sites",      "Kelola master data site",           "HO"),
    ("can_view_ho_dashboard", "Akses HO dashboard",                "HO"),
    ("can_assign_supplier",   "Assign supplier ke site",           "HO"),
]

# All permission codes (order-preserved), handy for super_admin = all.
ALL_PERMISSION_CODES: list[str] = [code for code, _label, _group in PERMISSIONS]

# ── Default role → permissions mapping ──────────────────────────────
# super_admin gets every permission; the rest are explicit per the plan.
ROLE_PERMISSIONS: dict[str, list[str]] = {
    "super_admin": ALL_PERMISSION_CODES,
    "admin": [
        "can_view_own_site",
        "can_upload_readiness",
        "can_manage_master",
        "can_manage_employees",
        "can_manage_site_users",
        "can_view_team_inquiry",
        "can_view_all_inquiries",
    ],
    "group_leader": [
        "can_view_own_site",
        "can_submit_inquiry",
        "can_view_team_inquiry",
    ],
    "user": [
        "can_view_own_site",
        "can_submit_inquiry",
    ],
    "supplier": [
        "can_view_all_sites",
        "can_respond_inquiry",
        "can_view_all_inquiries",
    ],
}

# Canonical role list (also the set of values tb_m_users.role / employees.role accept).
ALL_ROLES: list[str] = list(ROLE_PERMISSIONS.keys())
