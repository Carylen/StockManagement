# CLAUDE.md — UT STOCK by KPP Mining · Production v2.0

> Dokumen referensi lengkap: `DESIGN_UTSTOCK_KPP_FINAL.md` (taruh di root repo).
> File ini hanya berisi aturan harian yang Claude Code butuhkan tiap sesi.

---

## Stack & Repo Layout

```
ut-stock-backend/   → FastAPI + PostgreSQL (asyncpg + SQLAlchemy 2.0 async)
ut-stock-frontend/  → Next.js 14 App Router + Tailwind + SWR
```

**Backend base URL:** `http://localhost:8000/v1`
**Frontend:** `http://localhost:3000`

---

## Aturan Wajib — Jangan Dilanggar

### Backend
- Semua route handler harus `async def`
- Driver DB: `asyncpg` — jangan pakai `psycopg2`
- ORM: `SQLAlchemy 2.0` style (`select()`, `await db.execute()`) — bukan legacy `.query()`
- Validasi input: **Pydantic v2** (bukan v1)
- Auth: selalu inject `user = Depends(get_current_user)` — jangan trust body/param untuk identitas user
- Site scope: non-supplier hanya boleh akses `resource.site == user["site"]` — gunakan `require_site_match()`
- PIC UT (`role == "supplier"`) bypass site scope, bisa akses semua site
- Status inquiry: hanya `pending | valid | invalid` — tidak ada `draft`, tidak ada approval GL

### Frontend
- Theme switching via `document.documentElement.setAttribute('data-org', 'kpp'|'ut')`
- **Jangan hardcode warna brand** — pakai `var(--brand-primary)` / Tailwind class `bg-brand`, `text-brand`
- KPP context (Admin/GL/Mekanik) → `data-org="kpp"` → primary `#1F6F4C`
- UT context (PIC UT) → `data-org="ut"` → primary `#E8A323`
- Data fetching: SWR + `api` helper dari `lib/api.ts` (inject JWT otomatis)
- Form: `react-hook-form` + `zod`
- Angka stok (RTT/TBD/MIN/MAX/qty): selalu `font-mono` + `tabular-nums`

---

## Roles & Auth

| Role | Login | JWT `role` | Site |
|------|-------|-----------|------|
| Mekanik | NRP (passwordless) | `"Mekanik"` | site sendiri |
| Group Leader | NRP (passwordless) | `"GL"` | site sendiri |
| Admin Site | email + password | `"admin"` | site sendiri |
| PIC UT | email + password | `"supplier"` | `null` (semua site) |

**Login NRP:** `POST /v1/auth/login-nrp` body `{nrp}` → JWT 12 jam
**Login password:** `POST /v1/auth/login-password` body `{email, password}` → JWT 12 jam
**Tidak ada** refresh token — login ulang setiap 12 jam.
**NRP match:** uppercase-insensitive (`KM19142` == `km19142`)

JWT payload: `{sub, kind: "user"|"employee", role, site, name}`

---

## Sites

| Kode | Nama | Warehouse Primary UT |
|------|------|---------------------|
| `AGMR` | Asam-Asam · GMR | RTT |
| `RANT` | Rantau | SMR |
| `SPUT` | Satui · Putera | BTL |

Semua resource milik site — Admin/GL/Mekanik hanya akses site sendiri.

---

## Status & Business Rules

### Status Stok (re-compute backend, jangan trust file upload)
```
WARNING  →  rtt < min
AMAN     →  min ≤ rtt < max
OVER     →  rtt > max
MAX      →  rtt = max
```

### Status Inquiry
```
pending  →  mekanik submit, menunggu UT
valid    →  UT konfirmasi tersedia
invalid  →  UT kasih PN pengganti
```

Inquiry flow: **Mekanik submit → langsung `pending` → PIC UT respond**.
GL tidak approve/reject — hanya view-only.

### Readyness %
```
OH %   = % part dengan rtt > 0
MIN %  = % part dengan rtt >= min
FB %   = % part dengan (rtt + tbd) >= min
```

---

## File Penting — Backend

```
app/core/database.py     → engine async, get_db()
app/core/auth.py         → get_current_user(), require_role()
app/utils/dependencies.py → require_site_match()
app/models/              → semua SQLAlchemy models
app/schemas/             → semua Pydantic v2 schemas
app/routers/             → route handlers
app/services/            → business logic (parser, stock_calc, email)
alembic/versions/        → migration files
```

---

## File Penting — Frontend

```
app/globals.css          → CSS variables (--brand-primary, --c-kpp, --c-ut, dll)
tailwind.config.ts       → token mapping ke Tailwind class
lib/api.ts               → fetch helper + JWT injection
lib/auth.ts              → token storage (cookie + memory)
lib/types.ts             → TypeScript types
hooks/                   → SWR hooks per domain
middleware.ts            → auth guard + role redirect
```

---

## Komponen UI

```
components/ui/           → Button, Badge, Card, Input, Modal, Sheet
components/badge/        → StatusBadge (aman|warning|over|max)
                           InquiryBadge (pending|valid|invalid)
                           SiteBadge (AGMR|RANT|SPUT)
components/layout/       → Topbar, Sidebar, BottomNav (mobile)
components/upload/       → FileDropzone, ValidationPreview
```

**SiteBadge warna:**
- `AGMR` → `#1F6F4C` (hijau KPP)
- `RANT` → `#5B5BD6` (indigo)
- `SPUT` → `#FF7A59` (coral)

---

## API Endpoints Ringkas

| Method | Path | Role | Fungsi |
|--------|------|------|--------|
| POST | `/auth/login-nrp` | public | Login NRP |
| POST | `/auth/login-password` | public | Login email |
| PATCH | `/auth/change-password` | admin, supplier | Ganti password |
| GET | `/dashboard/summary?site=` | all | KPI + readyness % |
| GET | `/parts?site=&status=&search=` | all | List stok Class V |
| GET | `/parts/{pn}?site=` | all | Detail part |
| POST | `/master/parts/upload` | admin | Upload Class V/G Excel |
| POST | `/upload/readiness/validate` | admin | Validasi file harian |
| POST | `/upload/readiness/publish` | admin | Publish ke DB |
| GET | `/upload/logs` | admin | Riwayat upload |
| POST | `/employees/bulk-upload` | admin | Bulk karyawan Excel |
| POST | `/employees` | admin | Tambah manual |
| GET | `/employees` | admin | List karyawan site |
| POST | `/inquiries` | Mekanik | Submit inquiry Class G |
| GET | `/inquiries?site=&status=` | GL, admin, supplier | List inquiry |
| PATCH | `/inquiries/{id}/respond` | supplier | UT respond |
| GET | `/export/inquiries` | GL, admin, supplier | Export Excel |

Detail request/response lengkap → lihat **§15 di DESIGN_UTSTOCK_KPP_FINAL.md**.

---

## Checklist Setiap Kali Bikin Endpoint Baru

- [ ] Inject `user = Depends(get_current_user)`
- [ ] Cek role dengan `require_role("admin")` atau sesuai permission matrix
- [ ] Cek site dengan `require_site_match(resource.site, user)` untuk non-supplier
- [ ] Return error pakai format `{"error": {"code": "...", "message": "..."}}`
- [ ] Tulis Alembic migration jika ada perubahan schema
- [ ] Update `app/main.py` jika ada router baru

## Checklist Setiap Kali Bikin Page/Komponen Baru

- [ ] Pastikan `data-org` sudah ter-set di `app/layout.tsx`
- [ ] Gunakan `bg-brand` bukan hardcode warna hex
- [ ] Buat SWR hook di `hooks/` untuk data fetching
- [ ] Validasi form pakai `zod` schema
- [ ] Angka stok pakai `font-mono` + `tabular-nums`
- [ ] Komponen mobile: min tap target 44×44px, list item min 64px

---

## Environment Variables

**Backend `.env`:**
```
DATABASE_URL=postgresql+asyncpg://utstock_user:utstock_pass@localhost:5432/utstock
JWT_SECRET_KEY=<random 32 char>
JWT_EXPIRE_HOURS=12
RESEND_API_KEY=re_xxxx
CORS_ORIGINS=["http://localhost:3000"]
```

**Frontend `.env.local`:**
```
NEXT_PUBLIC_API_URL=http://localhost:8000/v1
```

---

## Cara Minta Claude Code Generate Kode

```
Buatkan [nama halaman / endpoint] untuk UT STOCK by KPP Mining.
Referensi desain: DESIGN_UTSTOCK_KPP_FINAL.md §[nomor section].

Role yang akses: [Mekanik | GL | admin | supplier]
Endpoint: [method + path dari tabel di atas]
File yang perlu dibuat/diubah: [list path]
```