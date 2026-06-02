# Prompt Claude Code — Full RBAC Migration (Fase 1–5)

Kerjakan per fase secara berurutan. Setiap fase selesai, konfirmasi
dan tunggu instruksi sebelum lanjut ke fase berikutnya.
DB masih kosong — tidak ada data migration yang perlu dijaga.

---

## FASE 1 — Backend RBAC Foundation

```
Implementasikan RBAC foundation di backend FastAPI.
DB masih kosong, tidak ada data yang perlu dimigrasikan.

### 1A. Tabel baru

Buat migration Alembic "0002_rbac_foundation" dengan tabel:

tb_m_permissions:
  code        VARCHAR(60) PRIMARY KEY   -- e.g. "can_upload_readiness"
  label       VARCHAR(120) NOT NULL     -- e.g. "Upload Readiness"
  group_name  VARCHAR(60)               -- e.g. "Readiness", "Inquiry"
  description TEXT

tb_m_role_permissions:
  role        VARCHAR(40) NOT NULL  -- FK ke enum role
  permission  VARCHAR(60) NOT NULL  -- FK ke tb_m_permissions.code
  PRIMARY KEY (role, permission)

tb_t_supplier_sites:
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
  supplier_id UUID NOT NULL  -- FK ke tb_m_users.id
  site_code   VARCHAR(10) NOT NULL  -- FK ke tb_m_sites.code
  assigned_at TIMESTAMPTZ DEFAULT now()
  assigned_by UUID  -- FK ke tb_m_users.id (super_admin yang assign)
  UNIQUE (supplier_id, site_code)

### 1B. Seed data permissions

Insert ke tb_m_permissions:

Group "Site Data":
  can_view_own_site       → "Lihat data site sendiri"
  can_view_all_sites      → "Lihat data semua site"
  can_upload_readiness    → "Upload readiness harian"
  can_manage_master       → "Kelola master Class V/G"

Group "Inquiry":
  can_submit_inquiry      → "Submit inquiry Class G"
  can_view_team_inquiry   → "Lihat inquiry tim"
  can_view_all_inquiries  → "Lihat semua inquiry"
  can_respond_inquiry     → "Respond inquiry (UT/Supplier)"

Group "User Management":
  can_manage_employees    → "Kelola data karyawan site"
  can_manage_site_users   → "Kelola akun user di site sendiri"
  can_manage_all_users    → "Kelola semua akun user"
  can_manage_suppliers    → "Kelola akun dan assignment supplier"
  can_manage_roles        → "Kelola role dan permission"

Group "HO":
  can_manage_sites        → "Kelola master data site"
  can_view_ho_dashboard   → "Akses HO dashboard"
  can_assign_supplier     → "Assign supplier ke site"

### 1C. Seed data role_permissions

Mapping default:

super_admin:
  → semua permission

admin:
  → can_view_own_site, can_upload_readiness, can_manage_master,
    can_manage_employees, can_manage_site_users,
    can_view_team_inquiry, can_view_all_inquiries

group_leader:
  → can_view_own_site, can_submit_inquiry, can_view_team_inquiry

user:
  → can_view_own_site, can_submit_inquiry

supplier:
  → can_view_all_sites, can_respond_inquiry, can_view_all_inquiries

### 1D. Update JWT

Di app/core/auth.py, update fungsi create_access_token dan 
get_current_user:

1. Saat login, query permissions user dari tb_m_role_permissions
   berdasarkan role user
2. Include permissions[] di JWT payload:
   {
     "sub": "user_id",
     "role": "admin",
     "site": "AGMR",
     "name": "Rina",
     "permissions": ["can_view_own_site", "can_upload_readiness", ...]
   }
3. get_current_user() return dict yang include "permissions" list

### 1E. Helper require_permission()

Buat app/utils/permissions.py:

def require_permission(permission: str):
    """FastAPI dependency — cek apakah user punya permission tertentu."""
    def checker(user = Depends(get_current_user)):
        if permission not in user.get("permissions", []):
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "PERMISSION_DENIED",
                    "message": f"Required permission: {permission}"
                }
            )
        return user
    return checker

def require_any_permission(*permissions: str):
    """User harus punya minimal satu dari permissions yang disebutkan."""
    ...

def require_all_permissions(*permissions: str):
    """User harus punya semua permissions yang disebutkan."""
    ...

### 1F. Tambah role super_admin

Di tb_m_users, pastikan kolom role bisa menerima nilai "super_admin".
Update Enum atau VARCHAR sesuai tipe yang dipakai.

### 1G. TIDAK ubah endpoint yang ada

Di fase ini, endpoint yang ada TETAP pakai require_role() lama.
Jangan ubah router apapun di fase ini — hanya foundation.
Breaking change ke frontend = 0.

Setelah selesai, jalankan:
  alembic upgrade head
  
Dan verifikasi dengan:
  SELECT * FROM tb_m_permissions ORDER BY group_name;
  SELECT role, COUNT(*) FROM tb_m_role_permissions GROUP BY role;
```

---

## FASE 2 — Backend Migration ke require_permission()

```
Ganti semua require_role() dengan require_permission() di semua router.
Kerjakan file per file, jangan skip.

### 2A. Update semua routers

app/routers/auth.py:
  - Login endpoint: tidak perlu permission (public)
  - Change password: require_permission("can_manage_site_users") 
    ATAU user mengubah password sendiri (cek sub == user_id)

app/routers/dashboard.py:
  - GET /dashboard/summary → require_permission("can_view_own_site")
    tambah: kalau super_admin atau can_view_all_sites, 
    accept query param ?site= tanpa filter

app/routers/parts.py:
  - GET /parts → require_permission("can_view_own_site")
  - GET /parts/{pn} → require_permission("can_view_own_site")

app/routers/inquiries.py:
  - POST /inquiries → require_permission("can_submit_inquiry")
  - GET /inquiries → require_any_permission(
      "can_view_team_inquiry", 
      "can_view_all_inquiries"
    )
  - GET /inquiries/{id} → require_any_permission(
      "can_view_team_inquiry",
      "can_view_all_inquiries"
    )
  - PATCH /inquiries/{id}/respond → require_permission("can_respond_inquiry")
  - GET /inquiries/count → require_any_permission(
      "can_view_team_inquiry",
      "can_view_all_inquiries"
    )

app/routers/upload.py:
  - POST /upload/readiness/validate → require_permission("can_upload_readiness")
  - POST /upload/readiness/publish  → require_permission("can_upload_readiness")
  - GET /upload/logs → require_permission("can_upload_readiness")

app/routers/master.py:
  - POST /master/parts/upload → require_permission("can_manage_master")
  - GET /master/parts → require_any_permission(
      "can_view_own_site", "can_view_all_sites"
    )

app/routers/employees.py:
  - GET /employees → require_permission("can_manage_employees")
  - POST /employees → require_permission("can_manage_employees")
  - PATCH /employees/{id} → require_permission("can_manage_employees")
  - DELETE /employees/{id} → require_permission("can_manage_employees")
  - POST /employees/bulk-upload → require_permission("can_manage_employees")

app/routers/users.py (akun admin/supplier):
  - GET /users → require_permission("can_manage_all_users")
  - POST /users → require_permission("can_manage_all_users")
  - PATCH /users/{id} → require_any_permission(
      "can_manage_site_users",
      "can_manage_all_users"
    )

app/routers/export.py:
  - GET /export/inquiries → require_any_permission(
      "can_view_team_inquiry",
      "can_view_all_inquiries"
    )

### 2B. Site scoping — tetap berlaku

Logika site scoping tidak berubah:
- User dengan can_view_own_site → filter resource.site == user["site"]
- User dengan can_view_all_sites → tidak difilter, atau 
  accept query param ?site=

Update require_site_match() di app/utils/dependencies.py:
  def require_site_match():
    def checker(user = Depends(get_current_user)):
      if "can_view_all_sites" in user.get("permissions", []):
        return user  # bypass site filter
      # else: filter by user["site"]
      return user
    return checker

### 2C. Tambah endpoint HO — User & Role Management

Buat app/routers/ho.py dengan prefix /v1/ho:

Users:
  GET    /ho/users                → list semua user semua site
  POST   /ho/users                → buat user baru (semua role)
  GET    /ho/users/{id}           → detail user
  PATCH  /ho/users/{id}           → update user (role, site, active)
  DELETE /ho/users/{id}           → deactivate user

Sites:
  GET    /ho/sites                → list semua site
  POST   /ho/sites                → tambah site baru
  PATCH  /ho/sites/{code}         → update site
  DELETE /ho/sites/{code}         → deactivate site

Roles & Permissions:
  GET    /ho/roles                → list semua role + permissions mereka
  GET    /ho/permissions          → list semua permission
  PUT    /ho/roles/{role}/permissions → update permissions untuk role
    body: { permissions: ["can_view_own_site", ...] }

Supplier Assignment:
  GET    /ho/suppliers                      → list semua supplier + sites
  GET    /ho/suppliers/{id}/sites           → sites yang di-assign ke supplier
  POST   /ho/suppliers/{id}/sites           → assign site ke supplier
    body: { site_code: "AGMR" }
  DELETE /ho/suppliers/{id}/sites/{code}    → unassign site dari supplier

Semua endpoint /ho/* require_permission("can_manage_all_users") 
atau sesuai permission yang relevan.
Register router di main.py: app.include_router(ho.router, prefix="/v1")

### 2D. Update supplier site scoping

Di endpoint yang diakses supplier, ganti dari "akses semua site" 
menjadi "akses site yang di-assign":

def get_supplier_sites(user = Depends(get_current_user), db = Depends(get_db)):
    if "can_view_all_sites" not in user.get("permissions", []):
        raise HTTPException(403)
    # Query tb_t_supplier_sites untuk site yang di-assign ke supplier ini
    sites = await db.execute(
        select(SupplierSite.site_code)
        .where(SupplierSite.supplier_id == user["sub"])
    )
    return [s.site_code for s in sites.scalars()]

Gunakan helper ini di:
  - GET /parts (supplier context)
  - GET /inquiries (supplier context)
  - GET /supplier/readiness

Buat migration Alembic "0003_ho_endpoints" jika ada perubahan schema.
```

---

## FASE 3 — Frontend Auth Refactor

```
Refactor frontend agar semua guard dan nav pakai permissions[],
bukan cek role string. Kerjakan file per file.

### 3A. Update lib/auth.ts dan lib/types.ts

Di lib/types.ts, tambahkan:
  interface User {
    ...existing fields...
    permissions: string[]   // ← tambahkan
  }

Di lib/auth.ts:
  - Parse permissions[] dari JWT payload saat login/load token
  - Expose helper: can(permission: string): boolean
    → return user?.permissions?.includes(permission) ?? false
  - Expose helper: canAny(...permissions: string[]): boolean
  - Expose helper: canAll(...permissions: string[]): boolean

### 3B. Update useAuth hook

Return nilai useAuth() tambahkan:
  const { user, can, canAny, logout } = useAuth()

Contoh penggunaan:
  can("can_upload_readiness")   → true/false
  canAny("can_view_team_inquiry", "can_view_all_inquiries")

### 3C. Update middleware.ts

Ganti semua cek role string dengan cek permissions dari token:

Sebelum:
  if (user.role !== "admin") redirect("/dashboard")

Sesudah:
  const permissions = parsePermissionsFromToken(token)
  if (!permissions.includes("can_manage_master")) redirect("/dashboard")

Route protection mapping:
  /admin/*              → can_view_own_site + bukan supplier
  /admin/upload/*       → can_upload_readiness
  /admin/master/*       → can_manage_master
  /admin/employees/*    → can_manage_employees
  /supplier/*           → can_respond_inquiry
  /ho/*                 → can_view_ho_dashboard
  /inquiry/mine         → can_submit_inquiry
  /inquiry/all          → can_view_team_inquiry OR can_view_all_inquiries

### 3D. Update Sidebar.tsx

Ganti NAV_BY_ROLE (hardcode per role) dengan nav yang difilter 
berdasarkan permissions:

Definisikan MASTER_NAV dengan permission requirement per item:
  const ALL_NAV_ITEMS = [
    { href: "/dashboard",       permission: "can_view_own_site",     ... },
    { href: "/catalog",         permission: "can_view_own_site",     ... },
    { href: "/inquiry/all",     permission: "can_view_all_inquiries", ... },
    { href: "/inquiry/mine",    permission: "can_submit_inquiry",    ... },
    { href: "/admin/upload",    permission: "can_upload_readiness",  ... },
    { href: "/admin/master",    permission: "can_manage_master",     ... },
    { href: "/admin/employees", permission: "can_manage_employees",  ... },
    { href: "/supplier/inquiry",permission: "can_respond_inquiry",   ... },
    { href: "/supplier/readiness",permission:"can_view_all_sites",   ... },
    { href: "/ho/dashboard",    permission: "can_view_ho_dashboard", ... },
    { href: "/ho/users",        permission: "can_manage_all_users",  ... },
    { href: "/ho/sites",        permission: "can_manage_sites",      ... },
    { href: "/ho/suppliers",    permission: "can_manage_suppliers",  ... },
    { href: "/profile",         permission: null,                    ... },
  ]

  // Filter berdasarkan permissions user
  const NAV = ALL_NAV_ITEMS.filter(item => 
    item.permission === null || can(item.permission)
  )

Hapus NAV_BY_ROLE, GL_NAV, ADMIN_NAV, dll — tidak diperlukan lagi.

### 3E. Update MobileBottomNav.tsx

Terapkan pola yang sama dengan Sidebar — filter dari ALL_NAV_ITEMS
berdasarkan permissions, bukan role.

Batasi maksimal 5 item untuk bottom nav mobile,
prioritaskan item yang paling sering dipakai.

### 3F. Update semua page-level guard

Cari semua komponen yang ada:
  if (user?.role !== "admin") return <AccessDenied />
  
Ganti dengan:
  if (!can("can_upload_readiness")) return <AccessDenied />

Lakukan untuk semua halaman di:
  app/(admin)/**
  app/(supplier)/**
  
### 3G. Update Topbar.tsx

Jika ada role label di topbar ("Admin AGMR", "Supplier", dll),
ganti dari role string menjadi label yang lebih friendly
berdasarkan kombinasi role + site:
  - can_view_ho_dashboard → "HO · Super Admin"  
  - role admin + site     → "Admin · {site}"
  - can_respond_inquiry   → "UT · Supplier"
  - can_submit_inquiry    → "User · {site}"
```

---

## FASE 4 — HO Dashboard

```
Buat HO Dashboard sebagai route group baru di frontend.
Super Admin login → redirect ke /ho/dashboard.

### 4A. Route group

Buat app/(ho)/layout.tsx:
  - Sidebar khusus HO (warna berbeda — pakai neutral/dark, bukan green/honey)
  - Guard: if (!can("can_view_ho_dashboard")) redirect("/dashboard")
  - Logo tetap UT-STOCK tapi dengan label "HQ · Super Admin"

### 4B. Halaman HO Dashboard (/ho/dashboard)
  - KPI: Total Sites, Total Users, Total Suppliers, 
    Total Inquiries (semua site, 30 hari terakhir)
  - Tabel ringkasan per site: readiness %, inquiry pending count
  - Data dari endpoint yang sudah ada + filter all sites

### 4C. Halaman Manage Sites (/ho/sites)
  - List semua site (AGMR, RANT, SPUT, + future sites)
  - Kolom: Kode, Nama, Status (active/inactive), Jumlah user, 
    Jumlah supplier assigned
  - Tombol tambah site baru (modal form)
  - Toggle active/inactive per site

### 4D. Halaman Manage Users (/ho/users)
  - List semua user semua site dengan filter: site, role
  - Kolom: Nama, Role, Site, Status, Dibuat
  - Buat akun baru (semua role termasuk admin site baru)
  - Edit role dan site assignment
  - Deactivate akun

### 4E. Halaman Manage Suppliers (/ho/suppliers)
  - List semua akun supplier
  - Per supplier: tampilkan site mana saja yang di-assign
  - Assign/unassign site ke supplier (multi-select)
  - Buat akun supplier baru

### 4F. Halaman Manage Roles (/ho/roles)
  - List semua role dengan permission yang dimiliki
  - Toggle permission per role (checkbox grid)
  - Perubahan langsung update tb_m_role_permissions
  - Warning: "Perubahan akan berlaku saat user login ulang"
    (karena permissions di-embed di JWT)

  Tampilkan sebagai matrix:
  
  Permission          | super_admin | admin | group_leader | user | supplier
  can_upload_readiness|      ✓      |   ✓   |              |      |
  can_submit_inquiry  |      ✓      |       |      ✓       |  ✓   |
  ...

### 4G. Redirect logic update

Di middleware.ts, tambahkan:
  - User dengan can_view_ho_dashboard yang akses "/" 
    → redirect ke /ho/dashboard
  - User lain yang coba akses /ho/* 
    → redirect ke /dashboard dengan toast "Access Denied"
```

---

## FASE 5 — Supplier Multisite

```
Supplier sekarang hanya bisa akses site yang di-assign HO,
bukan semua site.

### 5A. Backend — update supplier site access

Di semua endpoint yang diakses supplier:
  GET /v1/parts?site=           → hanya site yang di-assign
  GET /v1/inquiries             → hanya inquiry dari site yang di-assign  
  GET /v1/supplier/readiness    → hanya site yang di-assign

Gunakan helper get_supplier_sites() dari Fase 2.

Tambahkan endpoint:
  GET /v1/me/sites 
  → return list site yang accessible oleh user yang sedang login
  → untuk supplier: dari tb_t_supplier_sites
  → untuk admin: [user.site]
  → untuk super_admin: semua site aktif

### 5B. Frontend — update supplier pages

Di semua halaman supplier yang ada filter site:
  - Fetch accessible sites dari GET /v1/me/sites
  - Tampilkan hanya site tersebut di filter/dropdown
  - Jika hanya 1 site → tidak perlu tampilkan filter, 
    langsung load data site tersebut
  - Jika 0 site → tampilkan empty state 
    "Belum ada site yang di-assign. Hubungi HO."

### 5C. Frontend — HO assign supplier flow

Di /ho/suppliers/{id}:
  - Tampilkan site yang sudah di-assign (badge per site)
  - Tombol "+ Assign Site" → dropdown/multiselect site aktif
  - Tombol unassign (x) per site
  - Perubahan langsung efektif (tidak perlu supplier logout)

### 5D. JWT supplier — refresh sites

Karena sites di-assign secara dinamis oleh HO (tidak di JWT),
supplier fetch /v1/me/sites setiap load halaman (bukan dari JWT).
Gunakan SWR dengan revalidateOnFocus: true.

### 5E. Notifikasi ke supplier saat di-assign ke site baru

Ketika HO assign supplier ke site baru:
  POST /ho/suppliers/{id}/sites
  → trigger email notifikasi ke supplier:
    "Kamu telah di-assign ke site {site_name}. 
     Silakan login kembali untuk mengakses data site tersebut."

Gunakan email service yang sudah ada (Resend).

---

## Catatan penting untuk semua fase

1. Setiap fase yang melibatkan perubahan schema → 
   buat migration Alembic terpisah dengan nama deskriptif

2. Setiap fase selesai → jalankan:
   alembic upgrade head
   
3. JWT expire 12 jam — perubahan permissions 
   baru berlaku saat user login ulang.
   Tambahkan info ini di HO dashboard saat edit role permissions.

4. Jangan hapus require_role() lama sampai Fase 2 selesai penuh —
   transisi bertahap per router.

5. Test setiap fase dengan akun masing-masing role sebelum lanjut.
```