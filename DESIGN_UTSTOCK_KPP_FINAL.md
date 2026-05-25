# UT STOCK by KPP Mining — Design Document (FINAL)

> Sistem monitoring ketersediaan spare part **Vendor Held Stock (VHS)** dari United Tractors untuk **3 site KPP Mining**: AGMR, RANT, SPUT.
>
> **Stack ringkas:** FastAPI + PostgreSQL lokal + Next.js 14 + Tailwind. Auth handled by FastAPI sendiri (tanpa Supabase).

**Versi: FINAL v2.0** · konsolidasi dari `DESIGN_UTSTOCK_KPP.md v3.0 + ADDENDUM v3.1 + v3.2` ditambah revisi prototype clickable v2.0 · Update: 24 Mei 2026.

---

## Daftar Isi

1. [Konteks Bisnis](#1-konteks-bisnis)
2. [Klasifikasi Part — Kelas V & G](#2-klasifikasi-part--kelas-v--g)
3. [Struktur Data Real (dari Excel)](#3-struktur-data-real-dari-excel)
4. [User Roles & Permission](#4-user-roles--permission)
5. [Mekanisme Upload (3 jenis)](#5-mekanisme-upload-3-jenis)
6. [Design References — Dribbble](#6-design-references--dribbble)
7. [Design System (Dual-Brand Tokens)](#7-design-system-dual-brand-tokens)
8. [Responsive Design Guidelines](#8-responsive-design-guidelines)
9. [Sitemap Aplikasi](#9-sitemap-aplikasi)
10. [Halaman & UI Detail](#10-halaman--ui-detail)
11. [Data Model Database](#11-data-model-database)
12. [Notifikasi](#12-notifikasi)
13. [Tech Stack](#13-tech-stack)
14. [MVP Scope](#14-mvp-scope)
15. [API Endpoints Lengkap](#15-api-endpoints-lengkap)
16. [Backend Setup (FastAPI + Docker + Alembic)](#16-backend-setup-fastapi--docker--alembic)
17. [Frontend Setup (Next.js consume API)](#17-frontend-setup-nextjs-consume-api)
18. [Quick Start Development](#18-quick-start-development)
19. [Template Prompt untuk Claude Code](#19-template-prompt-untuk-claude-code)

---

## 1. Konteks Bisnis

KPP Mining memiliki kontrak **Vendor Held Stock (VHS)** dengan United Tractors (UT). UT wajib menjaga stok spare part tertentu di warehouse mereka untuk keperluan site KPP. Setiap hari, admin tiap site upload file Excel dari UT ke sistem untuk memverifikasi jumlah stok aktual vs kebutuhan Min/Max site.

### Scope v2.0 — 3 Site KPP

| Kode | Nama Site | Region | Gudang UT terkait |
|------|-----------|--------|------------------|
| **AGMR** | Asam-Asam · GMR | Kalimantan Selatan | RTT, TBD |
| **RANT** | Rantau | Kalimantan Selatan | SMR, TBD |
| **SPUT** | Satui · Putera | Kalimantan Selatan | BTL, TBD |

Setiap site punya master Class V dan stok harian sendiri-sendiri. Admin Site hanya bisa CRUD data site-nya. PIC UT bisa melihat semua site sekaligus (konsolidasi) atau filter per site.

### Lokasi Stok UT (warehouse referensi)

| Kode | Nama | Dekat | Tipe |
|------|------|-------|------|
| **RTT** | UT Rantau Warehouse | AGMR | primary |
| **SMR** | UT Samarinda Warehouse | RANT | primary |
| **BTL** | UT Batulicin Warehouse | SPUT | primary |
| **TBD** | Tower Banjarmasin Depot | transit | transit |
| **BPN** | UT Balikpapan Hub | central | central |
| **JKT** | UT Jakarta Pusat | HO | central |

> **Catatan:** Saat UT merespon inquiry, mereka isi `ut_site_code` sebagai **text bebas** — tidak divalidasi ke tabel ini. UT bisa menulis kode internal apapun.

### PIC UT
**1 akun global PIC UT** — `users.site = NULL` atau `'ALL'`. Akun ini bisa akses semua site, dibuat manual oleh Super Admin.

---

## 2. Klasifikasi Part — Kelas V & G

### Kelas V — Terdaftar di VHS
- Part yang **disimpan secara fisik** di warehouse UT (RTT/SMR/BTL/TBD)
- UT **menjamin ketersediaan** sesuai kontrak Min/Max
- Master ~**396 part** (KOMATSU + SCANIA + HENSLEY)
- **Ini yang muncul di readiness upload harian.**

### Kelas G — Tidak Terdaftar di VHS
- Part yang **tidak disimpan** di warehouse UT
- UT hanya menjamin **kedatangan/pengiriman** jika ada pesanan
- Master ~**9.356 part**
- **Tidak ada di readiness CSV → mekanik input lewat fitur Inquiry (dropdown dari master Class G).**

### Master Part — Struktur (file: `Data Part UT Class V dan G.xlsx`)

| Kolom Excel | Kolom DB | Keterangan |
|---|---|---|
| `No` | — | nomor urut, abaikan |
| `Stockcode` | `stockcode` | kode internal UT |
| `Part Number` | `part_number` | unique key |
| `Description` | `description` | nama part |
| `Mnemonic` | `mnemonic` | KOMATSU \| SCANIA \| HENSLEY |
| `Class` | `kelas` | V \| G |

> Master Class V/G di-upload sekali oleh Admin Site (jarang berubah).

---

## 3. Struktur Data Real (dari Excel)

### File harian readiness (per site)

Format **BARU v2.0** — tidak ada lagi kolom AGMR/RANT/SPUT karena site otomatis dari user yang upload:

| Kolom | Tipe | Keterangan |
|---|---|---|
| `part_number` | string | wajib, harus ada di `parts.cls='V'` |
| `description` | string | dibawa apa adanya |
| `min` | int | MIN site (kebutuhan minimum) |
| `max` | int | MAX site (batas atas) |
| `status` | string | WARNING / AMAN / OVER / MAX — backend tetap **re-compute** sendiri (jangan trust file) |
| `rtt` | int | qty di warehouse primary untuk site itu (RTT untuk AGMR, SMR untuk RANT, BTL untuk SPUT) |
| `tbd` | int | qty di Tower Banjarmasin Depot |
| `total` | int | rtt + tbd (validasi konsistensi) |
| `estimasi` | int | **BARU** — qty yang sedang dalam perjalanan ke RTT/SMR/BTL |

### Logika Status (re-compute backend, berbasis MIN/MAX site)

```
WARNING  →  rtt < min          (stok tidak cukup — perlu perhatian)
AMAN     →  min ≤ rtt < max    (stok aman sesuai kontrak)
OVER     →  rtt > max          (stok berlebih)
MAX      →  rtt = max          (tepat di batas atas)
```

### Tiga Angka Readyness

| Metrik | Formula | Arti |
|---|---|---|
| **Readyness OH %** | % part dengan `rtt > 0` | Ada fisik di warehouse primary |
| **Readyness MIN %** | % part dengan `rtt ≥ min` | Memenuhi minimum |
| **Readyness FB %** | % part dengan `rtt + tbd ≥ min` | Memenuhi minimum jika digabung TBD |

### Karyawan Plant (file: `Data_Plant_AGMR.xlsx`)

| Kolom Excel | Kolom DB | Keterangan |
|---|---|---|
| `NO` | — | urutan, abaikan |
| `NRP` | `nrp` | unique, dipakai login (uppercase-insensitive match) |
| `NAMA` | `name` | nama lengkap |
| `POSISI` | `role` | hanya boleh **Mekanik** atau **GL** |

Site otomatis = `admin.site` user yang upload.

---

## 4. User Roles & Permission

Admin KPP **membuat semua akun** — tidak ada self-registration.

| Role | Login dengan | Dibuat oleh | Site scope |
|------|-------------|-------------|-----------|
| **Mekanik** | NRP (passwordless) | Admin Site (bulk Excel) | Site sendiri |
| **Group Leader** | NRP (passwordless) | Admin Site (bulk Excel) | Site sendiri |
| **Admin Site** | Email + Password | Super Admin (manual) | Site sendiri |
| **PIC UT** | Email + Password | Super Admin (manual) | **Semua site** |

### 4.1 Login Plant (Mekanik / GL) — Passwordless

Plant tidak punya password. Login cukup dengan NRP:

```
1. Buka /login → pilih tab "Karyawan Plant"
2. Masukkan NRP (e.g. KM19142)
3. Backend cek NRP ada di `employees` & is_active=true
4. Issue JWT 12 jam berisi {nrp, site, role, name}
5. Tidak ada refresh token — login ulang setiap 12 jam
```

NRP wajib **uppercase-insensitive match**.

### 4.2 Login Admin & UT — Email + Password

```
1. Buka /login → pilih tab "Admin Site" atau "PIC UT"
2. Masukkan email + password
3. Verify bcrypt hash di `users.password`
4. Issue JWT (sama format)
```

Endpoint `PATCH /auth/change-password` tersedia untuk ganti password (min 8 karakter).

### 4.3 Permission Matrix

| Fitur | Mekanik | Group Leader | Admin Site | PIC UT |
|-------|---------|-------------|-----------|--------|
| Lihat katalog stok site sendiri | ✅ | ✅ | ✅ | ✅ semua site |
| Cari part (search + filter) | ✅ | ✅ | ✅ | ✅ |
| Lihat detail part (RTT/TBD/Estimasi) | ✅ | ✅ | ✅ | ✅ |
| Submit inquiry Class G | ✅ | ❌ | ❌ | ❌ |
| Lihat inquiry tim mekanik | ❌ | ✅ view-only | ✅ | ✅ |
| Respond inquiry (valid/invalid) | ❌ | ❌ | ❌ | ✅ |
| Export Excel inquiry | ❌ | ✅ | ✅ | ✅ |
| Upload readiness harian | ❌ | ❌ | ✅ | ❌ |
| Upload master Class V/G | ❌ | ❌ | ✅ | ❌ |
| Bulk upload karyawan | ❌ | ❌ | ✅ | ❌ |
| Kelola akun karyawan | ❌ | ❌ | ✅ | ❌ |
| Lihat log upload | ❌ | ❌ | ✅ | ❌ |

### 4.4 Catatan Penting — Tidak Ada Approval GL

> **BREAKING vs v3.2:** Step approval Group Leader **DIHAPUS**. Mekanik submit inquiry → langsung `pending` → masuk inbox UT. GL tidak lagi approve/reject.
>
> GL tetap punya halaman view-only untuk pantau inquiry tim mekanik-nya di site itu (read-only, tidak ada tombol aksi).

### 4.5 Site Scoping (RLS / business rule)

Dependency FastAPI `require_site_match()` mengecek `current_user.site == resource.site`, kecuali untuk role `supplier` (PIC UT) yang boleh akses semua site.

```python
async def require_site_match(
    resource_site: str,
    user = Depends(get_current_user),
):
    if user.role == "supplier":
        return user  # PIC UT bypass
    if user.site != resource_site:
        raise HTTPException(403, "Beda site, tidak boleh akses")
    return user
```

---

## 5. Mekanisme Upload (3 jenis)

Admin Site punya **3 halaman upload terpisah**, dipecah karena beda frekuensi:

| Halaman | Frekuensi | Fungsi |
|---|---|---|
| `/admin/upload/readiness` | **Harian** (paling sering) | Readiness CSV per site |
| `/admin/upload/master` | Sekali setup (jarang) | Master Class V & G |
| `/admin/karyawan` | Sekali setup + tambah ad-hoc | Bulk karyawan + add manual |

### 5.1 Flow Upload Readiness (harian)

```
Admin Site buka /admin/upload/readiness
    ↓
Pilih/drag file CSV / XLSX
    ↓ POST /upload/readiness/validate
Sistem validasi otomatis:
  - Cek format kolom (10 kolom v2.0)
  - Cek part_number ada di parts.cls='V'
  - Cek qty valid (angka, tidak negatif)
  - Site otomatis = admin.site
    ↓
Preview hasil validasi:
  - N baris valid ✅
  - N baris di-skip (PN tidak ditemukan / kelas ≠ V) ⚠️
  - N baris error ❌
    ↓
Admin klik "Publish" → POST /upload/readiness/publish
    ↓
Database diupdate, status re-compute, dashboard otomatis refresh
```

### 5.2 Flow Upload Master (sekali setup)

```
Admin buka /admin/upload/master
    ↓
Upload "Data Part UT Class V dan G.xlsx" (~9.752 baris)
    ↓ POST /master/parts/upload
Upsert by part_number → return {inserted, updated, classV, classG}
```

### 5.3 Flow Bulk Karyawan

```
Admin buka /admin/karyawan
    ↓
Tab 1: Upload Excel (NO, NRP, NAMA, POSISI)
       Site auto = admin.site
       Validate: NRP unique, POSISI ∈ {GL, Mekanik}
    ↓ POST /employees/bulk-upload
Return summary {valid, skipped, error}
    
Tab 2: Tambah manual satu karyawan
       Form: NRP, Nama, Posisi, Shift
    ↓ POST /employees
```

**Tidak ada** SFTP/API otomatis di v2.0 — semua upload manual.

---

## 6. Design References — Dribbble

### 📱 Mobile App (Mekanik / GL)

| # | Judul | Yang Diambil |
|---|-------|-------------|
| 1 | [Stockey - Stock Management App](https://dribbble.com/shots/14782920-Stockey-Stock-Management-App-Design) | Card summary layout, color badge status, clean list per part |
| 2 | [WareTrack Mobile App](https://dribbble.com/shots/25370142-WareTrack-Mobile-App-SaaS-Warehouse-Delivery-Details) | Bottom nav pattern, filter sidebar, industrial tone |
| 3 | [Inventix Mobile App](https://dribbble.com/shots/25505577-Inventix-Mobile-App-SaaS-Warehouse-Storage) | Storage breakdown (RTT vs TBD), progress bar stok |
| 4 | [Inventory App: Warehouse Stocking](https://dribbble.com/shots/16821388-Inventory-App-Warehouse-Stocking-UI-UX-Mobile-App) | Form inquiry UX, alur input part baru |
| 5 | [Smart Warehouse App](https://dribbble.com/search/warehouse-ui) | Dashboard summary widget, search + filter chip |

### 🖥️ Desktop (Admin Site / PIC UT)

| # | Judul | Yang Diambil |
|---|-------|-------------|
| 6 | [Responsive Inventory Management](https://dribbble.com/tags/inventory_management) | Multi-breakpoint layout, sidebar collapse |
| 7 | [Store Inventory Dashboard](https://dribbble.com/search/inventory-management-app-ui) | Tabel stok + inline badge + action bar |
| 8 | [WareTrack SaaS Dashboard](https://dribbble.com/tags/warehouse-management) | Admin 3-kolom: sidebar + content + summary panel |

### Prinsip Visual

```
✅ Status badge warna → langsung terbaca tanpa baca teks
✅ Summary card angka besar → one-glance overview
✅ Filter chip horizontal scroll → cocok di mobile sempit
✅ List item kompak 64px → thumb-friendly (sarung tangan)
✅ Bottom navigation 4 item → jangkauan ibu jari
✅ Sidebar collapsible → efisien di tablet/desktop
✅ Gauge Min → Stok → Max → lebih intuitif dari angka mentah
✅ Part Number font mono → mudah baca 0/O, 1/I
```

---

## 7. Design System (Dual-Brand Tokens)

**v2.0 menimpa total** palette v3.2 (`#F5A623`) — sekarang **dual-brand context-aware**:
- Plant context (Admin/GL/Mekanik) → **KPP green** (`#1F6F4C`)
- UT context (PIC UT) → **UT honey** (`#E8A323`)

### 7.1 Color Tokens (CSS variables di `globals.css`)

```css
:root {
  /* ── Neutral base (putih dominan) ────────────────── */
  --c-bg:           #F6F3EE;   /* pearl background — body */
  --c-surface:      #FFFFFF;   /* cards, panels, inputs */
  --c-surface-alt:  #EDE9E0;   /* secondary surfaces, chip bg */
  --c-ink:          #16110D;   /* primary text */
  --c-ink-2:        #6B6256;   /* secondary text */
  --c-ink-3:        #A39A8A;   /* tertiary text, placeholder */
  --c-line:         rgba(27,24,20,0.06);
  --c-line-strong:  rgba(27,24,20,0.12);

  /* ── KPP Mining · hijau elegan ────────────────── */
  --c-kpp:          #1F6F4C;   /* primary */
  --c-kpp-deep:     #0F4A30;   /* hover/active */
  --c-kpp-mid:      #2F7D5C;   /* secondary accent */
  --c-kpp-soft:     #DCEEE3;   /* tint background */

  /* ── United Tractors · honey/kuning ─────────── */
  --c-ut:           #E8A323;   /* primary */
  --c-ut-deep:      #B07410;   /* hover/active */
  --c-ut-soft:      #FFF1D0;   /* tint background */

  /* ── Site accents (untuk site badge) ────────── */
  --c-site-agmr:      #1F6F4C;   /* sama dgn KPP green */
  --c-site-agmr-soft: #DCEEE3;
  --c-site-rant:      #5B5BD6;   /* indigo */
  --c-site-rant-soft: #E6E6F9;
  --c-site-sput:      #FF7A59;   /* coral */
  --c-site-sput-soft: #FFE5DC;

  /* ── Status stok (re-compute backend) ───────── */
  --c-aman:    #16A34A;  --c-aman-bg:    #DCFCE7;
  --c-warning: #DC2626;  --c-warning-bg: #FCE7E7;
  --c-over:    #D97706;  --c-over-bg:    #FEF3C7;
  --c-max:     #2563EB;  --c-max-bg:     #DBEAFE;

  /* ── Status inquiry v2.0 ──────────────────── */
  --c-pending:  #D97706;  --c-pending-bg:  #FEF3C7;
  --c-valid:    #15803D;  --c-valid-bg:    #DCFCE7;
  --c-invalid:  #B91C1C;  --c-invalid-bg:  #FEE2E2;

  /* ── Default brand-primary (override per role) ── */
  --brand-primary:      var(--c-kpp);
  --brand-primary-deep: var(--c-kpp-deep);
  --brand-primary-soft: var(--c-kpp-soft);
  --on-brand-primary:   #FFFFFF;
}

/* Switch tema per role context */
:root[data-org="ut"] {
  --brand-primary:      var(--c-ut);
  --brand-primary-deep: var(--c-ut-deep);
  --brand-primary-soft: var(--c-ut-soft);
  --on-brand-primary:   var(--c-ink);     /* honey bg → dark text */
}
:root[data-org="kpp"] {
  --brand-primary:      var(--c-kpp);
  --brand-primary-deep: var(--c-kpp-deep);
  --brand-primary-soft: var(--c-kpp-soft);
  --on-brand-primary:   #FFFFFF;          /* green bg → white text */
}
```

### 7.2 Aturan Pakai per Role

| current_user.role | `data-org` attr | Primary | Soft | On-primary |
|---|---|---|---|---|
| Admin Site | `kpp` | `#1F6F4C` | `#DCEEE3` | white |
| Group Leader | `kpp` | `#1F6F4C` | `#DCEEE3` | white |
| Mekanik | `kpp` | `#1F6F4C` | `#DCEEE3` | white |
| PIC UT | `ut` | `#E8A323` | `#FFF1D0` | ink |

Di `app/layout.tsx`:

```tsx
useEffect(() => {
  const org = user?.role === 'supplier' ? 'ut' : 'kpp';
  document.documentElement.setAttribute('data-org', org);
}, [user]);
```

**Jangan hard-code warna brand di komponen** — semua tombol primary, sidebar active state, link aktif, focus ring, dll pakai `var(--brand-primary)`.

### 7.3 Tailwind Config

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        bg:         'var(--c-bg)',
        surface:    'var(--c-surface)',
        'surface-alt': 'var(--c-surface-alt)',
        ink:        'var(--c-ink)',
        'ink-2':    'var(--c-ink-2)',
        'ink-3':    'var(--c-ink-3)',
        line:       'var(--c-line)',
        'line-strong': 'var(--c-line-strong)',
        brand: {
          DEFAULT: 'var(--brand-primary)',
          deep:    'var(--brand-primary-deep)',
          soft:    'var(--brand-primary-soft)',
          on:      'var(--on-brand-primary)',
        },
        kpp:  { DEFAULT:'var(--c-kpp)',  deep:'var(--c-kpp-deep)',  soft:'var(--c-kpp-soft)',  mid:'var(--c-kpp-mid)' },
        ut:   { DEFAULT:'var(--c-ut)',   deep:'var(--c-ut-deep)',   soft:'var(--c-ut-soft)' },
        aman: { DEFAULT:'var(--c-aman)',    bg:'var(--c-aman-bg)'    },
        warn: { DEFAULT:'var(--c-warning)', bg:'var(--c-warning-bg)' },
        over: { DEFAULT:'var(--c-over)',    bg:'var(--c-over-bg)'    },
        max:  { DEFAULT:'var(--c-max)',     bg:'var(--c-max-bg)'     },
        pending: { DEFAULT:'var(--c-pending)', bg:'var(--c-pending-bg)' },
        valid:   { DEFAULT:'var(--c-valid)',   bg:'var(--c-valid-bg)'   },
        invalid: { DEFAULT:'var(--c-invalid)', bg:'var(--c-invalid-bg)' },
        'site-agmr': { DEFAULT:'var(--c-site-agmr)', soft:'var(--c-site-agmr-soft)' },
        'site-rant': { DEFAULT:'var(--c-site-rant)', soft:'var(--c-site-rant-soft)' },
        'site-sput': { DEFAULT:'var(--c-site-sput)', soft:'var(--c-site-sput-soft)' },
      },
      borderRadius: {
        sm:'8px', md:'12px', lg:'16px', xl:'18px', '2xl':'24px',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
};
```

### 7.4 Typography Scale

```css
--text-xs:   11px / 16px;   /* chip label, timestamp, PN mono */
--text-sm:   13px / 20px;   /* body kecil, tabel */
--text-base: 15px / 22px;   /* body utama */
--text-lg:   18px / 26px;   /* section title */
--text-xl:   22px / 30px;   /* page title topbar */
--text-2xl:  28px / 36px;   /* dashboard greeting */
--text-3xl:  36px / 44px;   /* hero stat angka besar */
--text-4xl:  48px / 52px;   /* KPI card angka utama */
```

Dashboard KPI cards & hero stat: pakai `letter-spacing: -0.04em` agar angka besar terlihat solid.

### 7.5 Component Contracts

- **Tombol primary** → `bg-brand text-brand-on hover:bg-brand-deep`. Otomatis hijau di KPP context, honey di UT context.
- **Sidebar active state** → `bg-brand-soft text-brand-deep`.
- **Status badge stok** → `<Badge tone="aman|warning|over|max" />`.
- **Status badge inquiry** → `<Badge tone="pending|valid|invalid" />`.
- **Site badge** → `<SiteBadge site="AGMR|RANT|SPUT" />`, konsisten di mana pun (baris inquiry, dashboard UT).
- **Part Number** → selalu `font-mono` (hindari ambiguity 0/O, 1/I).
- **Angka stok (RTT/TBD/MIN/MAX/qty/estimasi)** → `font-mono font-feature-settings:'"tnum"'` agar rata kanan.

### 7.6 Spacing & Radius

```css
/* 8-point grid */
--space-1: 4px;  --space-2: 8px;   --space-3: 12px;
--space-4: 16px; --space-5: 20px;  --space-6: 24px;
--space-8: 32px; --space-10: 40px;
```

### 7.7 Don't list

❌ Jangan pakai `#F5A623` (warna v3.2 lama) — ganti `#E8A323`.
❌ Jangan gradient agresif sebagai background utama (boleh sentuh kecil di hero card).
❌ Jangan aksen merah selain untuk WARNING / INVALID.
❌ Jangan satu warna brand di seluruh app — wajib beda KPP vs UT.
❌ Hindari emoji di copy resmi (boleh sesekali di greeting "Hai, Budi 👋").

---

## 8. Responsive Design Guidelines

### 8.1 Breakpoints

```
xs:  < 375px    → HP kecil
sm:  375–639px  → HP standar — PRIMARY TARGET (mekanik lapangan)
md:  640–767px  → HP besar / phablet
lg:  768–1023px → Tablet portrait
xl:  1024–1279px → Tablet landscape / laptop kecil
2xl: ≥ 1280px   → Desktop — target Admin & UT dashboard
```

### 8.2 Layout Skeleton

**Mobile sm** (Mekanik / GL):
```
┌──────────────────┐
│  Topbar  56px    │  sticky, logo + notif
├──────────────────┤
│  Main Content    │  padding: 16px
│  single column   │
├──────────────────┤
│  Bottom Nav 64px │  fixed + safe area inset
└──────────────────┘
```

**Desktop 2xl** (Admin / UT):
```
┌─────────┬────────────────────┬──────────┐
│ Sidebar │  Topbar             │  Right   │
│  256px  ├─────────────────────┤  Panel   │
│         │  Main Content       │  300px   │
│         │  dense table mode   │ (optional)│
└─────────┴─────────────────────┴──────────┘
```

### 8.3 Komponen Responsive Rules

**Summary Cards:**
- `sm`: 2×2 grid, `width: calc(50% - 8px)`
- `lg`: 4×1 grid equal width
- `2xl`: 4×1, `max-width: 280px`

**Tabel Stok:**
- `sm`: Kolom PN | Nama | Status (3 kolom) → tap baris → bottom sheet detail
- `lg`: PN | Nama | RTT | TBD | MIN | Status
- `2xl`: PN | Nama | Prod | Comm | RTT | TBD | Total | Estimasi | MIN | MAX | Status

**Filter & Search:**
- `sm`: Search full-width + chip scroll horizontal
- `2xl`: Search + chips + sort dalam 1 baris

### 8.4 Touch & Interaction Rules

```
Min tap target:    44 × 44px (Apple HIG)
List item height:  min 64px (sarung tangan friendly)
FAB Inquiry:       fixed bottom-right 56×56px (di atas bottom nav)
Pull to refresh:   dashboard + katalog
Long press:        copy part number ke clipboard
```

### 8.5 Offline & Low-Signal (site tambang)

```
○ Skeleton loading, bukan full-page spinner
○ Cache data terakhir di memory/localStorage
○ "Terakhir diupdate: [timestamp]" selalu terlihat
○ Error state dengan tombol Retry
○ Lazy load gambar
○ Critical path CSS inline
```

---

## 9. Sitemap Aplikasi

```
/
├── [AUTH]
│   └── /login                         ← 3 tab: Plant NRP / Admin / PIC UT
│
├── [MEKANIK] data-org="kpp"
│   ├── /dashboard                     ← ringkasan stok site sendiri
│   ├── /katalog                       ← list Class V + search + filter
│   │   └── /katalog/:partNumber       ← detail RTT/TBD/Estimasi/gauge
│   ├── /inquiry
│   │   ├── /inquiry/baru              ← form submit Class G (dropdown PN)
│   │   └── /inquiry/saya              ← status inquiry pribadi
│   └── /profil
│
├── [GROUP LEADER] data-org="kpp"
│   ├── /dashboard                     ← + highlight WARNING
│   ├── /katalog
│   ├── /inquiry/tim                   ← view-only inquiry tim mekanik site
│   └── /profil
│
├── [ADMIN SITE] data-org="kpp"
│   ├── /dashboard                     ← full readyness % + 3 upload card
│   ├── /katalog
│   ├── /inquiry/semua                 ← semua inquiry site (read)
│   ├── /admin
│   │   ├── /admin/upload/readiness    ← harian
│   │   ├── /admin/upload/master       ← Class V/G (jarang)
│   │   ├── /admin/karyawan            ← bulk + manual
│   │   ├── /admin/log                 ← history upload & error
│   │   └── /admin/users               ← kelola akun admin/UT (optional)
│   └── /profil
│
└── [PIC UT] data-org="ut"
    ├── /ut/inquiry                    ← inbox inquiry, filter ?site=
    ├── /ut/readiness                  ← view readiness semua site
    └── /profil
```

---

## 10. Halaman & UI Detail

### 10.1 Login (3 tab)

```
┌────────────────────────────────────┐
│   UT STOCK · KPP Mining           │
│                                    │
│   [ Karyawan Plant ][ Admin ][ UT ]│
│   ─────────────────────────────── │
│                                    │
│   NRP                              │  ← tab Plant aktif
│   [ KM19142                       ]│
│                                    │
│   [        Masuk                  ]│
│                                    │
│   Karyawan tidak punya password.   │
│   Cukup masukkan NRP.              │
└────────────────────────────────────┘
```

**Tab Admin Site & PIC UT** → form email + password + link ganti password.

### 10.2 Dashboard Mekanik / GL (mobile)

```
┌──────────────────────────────────────────────┐
│ [☰]  UT STOCK  KPP Mining            [🔔 3] │
├──────────────────────────────────────────────┤
│  Selamat pagi, Ahmad 👋                      │
│  Site AGMR · Mekanik                         │
│                          🕐 21 Mei · 08:30   │
├──────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐               │
│  │     405   │  │      32   │               │
│  │ Total Part│  │  WARNING  │               │
│  └───────────┘  └───────────┘               │
│  ┌───────────┐  ┌───────────┐               │
│  │     350   │  │      23   │               │
│  │   AMAN    │  │   OVER    │               │
│  └───────────┘  └───────────┘               │
├──────────────────────────────────────────────┤
│  Readyness AGMR                             │
│  OH   ████████████░░  87%                   │
│  MIN  ██████████░░░░  72%                   │
│  FB   ████████████░░  91%                   │
├──────────────────────────────────────────────┤
│  Stok Terkini              [Lihat Semua →]  │
│  1R-1808 FILTER AS-ENG OIL  RTT: 120 🟢    │
│  9W-8552 ADAPTER AS-BUCKET  RTT:  45 🟡    │
│  7T-3407 ROLLER AS-CARRIER  RTT:   0 🔴    │
├──────────────────────────────────────────────┤
│  💬 Part tidak ada? Ajukan Inquiry Class G→ │
├──────────────────────────────────────────────┤
│ [🏠] [🔍 Cari] [📋 Inquiry] [👤 Profil]    │
└──────────────────────────────────────────────┘
```

### 10.3 Katalog / Cari Part

```
sm (mobile):
[🔍 Cari part number atau nama...]
[Semua] [⚠️ WARNING] [✅ AMAN] [🟡 OVER] [🔵 MAX]  ← scroll horizontal
[KOMATSU] [SCANIA] [HENSLEY]

┌──────────────────────────────────────────────┐
│ 01643-31032                      🟢 AMAN     │
│ WASHER                                        │
│ KOMATSU · -ISP-                              │
│ RTT: 120  TBD: 10  Estimasi: 5  Min: 101    │
└──────────────────────────────────────────────┘

2xl (desktop tabel):
PN          | NAMA   | PROD    | RTT | TBD | EST | TOTAL | MIN | MAX | STATUS
01643-31032 | WASHER | KOMATSU | 120 |  10 |   5 |  130  | 101 | 134 | 🟢 AMAN
```

### 10.4 Detail Part

```
← 01643-31032 · WASHER
   KOMATSU · -ISP-                         🟢 AMAN

┌──────────────────────────────────────────┐
│  Stok UT Saat Ini                        │
│  RTT  (warehouse primary)  120 pcs  ███  │
│  TBD  (Banjarmasin Depot)   10 pcs  █░░  │
│  Estimasi (in-transit)       5 pcs  █░░  │
│  ──────────────────────────────────────  │
│  Total                     130 pcs       │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  vs. Kebutuhan AGMR                      │
│  0 ──[MIN:101]──[RTT:120]──[MAX:134]──► │
│       █████████████████░░               │
└──────────────────────────────────────────┘
```

### 10.5 Form Inquiry Class G (Mekanik) — Disederhanakan v2.0

Hanya **3 field** yang dikirim mekanik:

```
← Ajukan Inquiry Class G

ℹ️ Pilih Part Number dari master Class G.
   Inquiry langsung dikirim ke PIC UT.

Part Number *
[ 🔍 cari & pilih dari master Class G    ▼ ]
└─ 6212-31-2300 · SHAFT, CRANK
   01010-61235 · BOLT
   6245-71-1100 · PUMP ASSY
   ...

Jumlah Dibutuhkan *
[ 5 ]

Untuk Unit / Aset *
[ PC200 #07                              ]

              [ Submit Inquiry ]

Status setelah submit: 🟡 PENDING → langsung ke PIC UT
```

> Field yang **dihapus** dari payload mekanik vs v3.2: `part_name` (ambil dari master), `notes`, `urgency`, `date_needed`.

### 10.6 Halaman Inquiry Tim (GL — view only)

```
← Inquiry Tim Mekanik AGMR

[ Status: Semua ▼ ]  [ Bulan: Mei 2026 ▼ ]

┌──────────────────────────────────────────┐
│ 🟡 PENDING               21 Mei · 14:32  │
│ 6212-31-2300 SHAFT, CRANK    Qty: 5     │
│ Ahmad (KM19142) · PC200 #07              │
│                                          │
│ Menunggu respon PIC UT.                  │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ 🟢 VALID                 20 Mei · 09:15  │
│ 01010-61235 BOLT             Qty: 12    │
│ Budi (KM19200) · HD785 #03               │
│                                          │
│ UT (RTT): "Tersedia siap dikirim 2 hari" │
└──────────────────────────────────────────┘
```

> **Tidak ada tombol approve/reject.** GL hanya pantau.

### 10.7 PIC UT — Inbox Inquiry (multi-site)

```
Inquiry Masuk · Semua Site                 [Export Excel]

[ Site: Semua ▼ ] [ Status: Pending ▼ ]

SITE  | TGL   | PN              | DESKRIPSI       | QTY | UNIT       | STATUS
AGMR  | 21/5  | 6212-31-2300    | SHAFT, CRANK    |   5 | PC200 #07  | 🟡 [Respond ▼]
RANT  | 21/5  | 01010-61235     | BOLT            |  12 | HD785 #03  | 🟡 [Respond ▼]
SPUT  | 20/5  | 6245-71-1100    | PUMP ASSY       |   2 | EX1200 #1  | 🟢 VALID

Click [Respond] → opens panel:

┌──────────────────────────────────────────┐
│  Respond Inquiry · 6212-31-2300          │
│                                          │
│  ○ VALID   — part tersedia               │
│  ● INVALID — kasih pengganti             │
│                                          │
│  Replacement PN (jika INVALID)           │
│  [ 6212-31-2301                        ] │
│                                          │
│  UT Site / Warehouse Code                │
│  [ RTT ]   ← bebas (max 8 char)         │
│                                          │
│  Catatan untuk Plant                     │
│  [ PN diganti karena discontinued.     ] │
│  [                                     ] │
│                                          │
│              [ Kirim Respond ]           │
└──────────────────────────────────────────┘
```

### 10.8 Admin — Upload Readiness

```
Upload Readiness Harian · Site: AGMR        [Lihat Log]

┌──────────────────────────────────────────────┐
│  📁 Drag & drop atau klik untuk pilih file   │
│     Format: .csv · .xlsx · Max: 10MB         │
└──────────────────────────────────────────────┘

Upload terakhir: 20 Mei 2026 · 08:15 WIB
File: READYNESS_VHS_KPP_AGMR_20_05_2026.xlsx
Hasil: ✅ 402 valid · ⚠️ 3 skip · ❌ 0 error

──────────────────────────────────────────────
Preview validasi file baru:

✅ 400 baris valid
⚠️  5 baris di-skip (PN tidak ditemukan / kelas ≠ V)
❌  0 baris error

PN          | RTT | TBD | EST | MIN | MAX | Status (recompute)
01643-31032 | 120 |  10 |   5 | 101 | 134 | 🟢 AMAN
07000-12018 |  45 |   0 |   0 |  50 |  70 | 🔴 WARNING

              [ Batalkan ]   [ ✅ Publish ke Database ]
```

### 10.9 Admin — Upload Master (sekali setup)

```
Upload Master Class V & G                      [Histori]

┌──────────────────────────────────────────────┐
│  📁 Pilih: Data Part UT Class V dan G.xlsx   │
└──────────────────────────────────────────────┘

Last upload: 1 Apr 2026
Total master saat ini: 396 Class V + 9.356 Class G

Setelah upload baru, upsert by Part Number:
  → Inserted: N · Updated: N · Class V: N · Class G: N
```

### 10.10 Admin — Kelola Karyawan

```
Karyawan Plant · Site AGMR              [+ Tambah Manual]

[Tab: Daftar] [Tab: Bulk Upload]

┌──────────────────────────────────────────────┐
│  📁 Upload Excel (NO, NRP, NAMA, POSISI)     │
└──────────────────────────────────────────────┘

NRP       | NAMA              | POSISI  | SHIFT  | STATUS
KM19142   | Ahmad Setiawan    | Mekanik | Pagi   | 🟢 Aktif
KM19200   | Budi Pratama      | Mekanik | Sore   | 🟢 Aktif
KM18055   | Cahya Wibowo      | GL      | —      | 🟢 Aktif
```

---

## 11. Data Model Database

### `sites` (referensi)
```sql
CREATE TABLE sites (
    code          VARCHAR(8) PRIMARY KEY,        -- AGMR | RANT | SPUT
    name          VARCHAR(80) NOT NULL,
    region        VARCHAR(80),
    ut_warehouses TEXT[]                          -- ['RTT','TBD']
);
```

### `users` (Admin Site & PIC UT — email+password)
```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password      VARCHAR(255) NOT NULL,         -- bcrypt
    role          VARCHAR(20) NOT NULL CHECK (role IN ('admin','supplier')),
    site          VARCHAR(8) REFERENCES sites(code),  -- NULL untuk PIC UT global
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    password_changed_at TIMESTAMPTZ,
    created_by    UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `employees` (Mekanik & GL — passwordless, login via NRP)
```sql
CREATE TABLE employees (
    nrp         VARCHAR(20) PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    site        VARCHAR(8) NOT NULL REFERENCES sites(code),
    role        VARCHAR(20) NOT NULL CHECK (role IN ('Mekanik','GL')),
    shift       VARCHAR(20),                     -- Pagi | Sore | Malam
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `parts` (master Class V & G)
```sql
CREATE TABLE parts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_number  VARCHAR(50) NOT NULL UNIQUE,
    stockcode    VARCHAR(20),
    description  TEXT NOT NULL,
    mnemonic     VARCHAR(20),                    -- KOMATSU | SCANIA | HENSLEY
    kelas        CHAR(1) NOT NULL CHECK (kelas IN ('V','G')),
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_parts_kelas ON parts(kelas);
CREATE INDEX idx_parts_mnemonic ON parts(mnemonic);
```

### `stock_levels` (snapshot harian per site)
```sql
CREATE TABLE stock_levels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id         UUID NOT NULL REFERENCES parts(id),
    site            VARCHAR(8) NOT NULL REFERENCES sites(code),
    min_qty         INTEGER NOT NULL DEFAULT 0,
    max_qty         INTEGER NOT NULL DEFAULT 0,
    rtt_qty         INTEGER NOT NULL DEFAULT 0,    -- warehouse primary qty
    tbd_qty         INTEGER NOT NULL DEFAULT 0,    -- Banjarmasin Depot qty
    estimated_qty    INTEGER NOT NULL DEFAULT 0,    -- BARU v2.0 — in-transit
    total_qty       INTEGER GENERATED ALWAYS AS (rtt_qty + tbd_qty) STORED,
    status          VARCHAR(10) NOT NULL CHECK (status IN ('WARNING','AMAN','OVER','MAX')),
    readyness_oh    BOOLEAN GENERATED ALWAYS AS (rtt_qty > 0) STORED,
    readyness_min   BOOLEAN GENERATED ALWAYS AS (rtt_qty >= min_qty) STORED,
    readyness_fb    BOOLEAN GENERATED ALWAYS AS ((rtt_qty + tbd_qty) >= min_qty) STORED,
    snapshot_date   DATE NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (part_id, site, snapshot_date)
);
CREATE INDEX idx_stock_part_date ON stock_levels(part_id, snapshot_date DESC);
CREATE INDEX idx_stock_site_status ON stock_levels(site, status);
```

### `stock_history`
```sql
CREATE TABLE stock_history (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id      UUID NOT NULL REFERENCES parts(id),
    site         VARCHAR(8) NOT NULL REFERENCES sites(code),
    warehouse    VARCHAR(5) NOT NULL,             -- RTT | SMR | BTL | TBD
    old_qty      INTEGER NOT NULL,
    new_qty      INTEGER NOT NULL,
    delta        INTEGER GENERATED ALWAYS AS (new_qty - old_qty) STORED,
    source_file  VARCHAR(255),
    uploaded_by  UUID REFERENCES users(id),
    synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `inquiries` (Class G — alur disederhanakan v2.0)
```sql
CREATE TABLE inquiries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submitted_by_nrp VARCHAR(20) NOT NULL REFERENCES employees(nrp),
    site            VARCHAR(8) NOT NULL REFERENCES sites(code),
    part_number     VARCHAR(50) NOT NULL REFERENCES parts(part_number),
    qty_needed      INTEGER NOT NULL,
    unit_asset      VARCHAR(100) NOT NULL,
    status          VARCHAR(10) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','valid','invalid')),

    -- response dari UT
    result          VARCHAR(10) CHECK (result IN ('valid','invalid')),
    ut_site_code    VARCHAR(8),                  -- text bebas (RTT/SMR/BTL/JKT...)
    replacement_pn  VARCHAR(50),                 -- text bebas (invalid → pengganti)
    ut_note         TEXT,
    responded_by    UUID REFERENCES users(id),
    responded_at    TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inq_status ON inquiries(status);
CREATE INDEX idx_inq_site ON inquiries(site);
CREATE INDEX idx_inq_submitter ON inquiries(submitted_by_nrp);
```

> **Yang dihapus dari v3.2:**
> - kolom `reviewed_by`, `rejection_reason`, `reviewed_at` (tidak ada approval GL)
> - kolom `part_name`, `notes`, `date_needed`, `supplier_notes` (form lebih ringkas)
> - status `draft`, `available`, `unavailable`, `partial`, `rejected` (cuma 3: pending/valid/invalid)

### `upload_logs`
```sql
CREATE TABLE upload_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind            VARCHAR(20) NOT NULL CHECK (kind IN ('readiness','master','employees')),
    site            VARCHAR(8) REFERENCES sites(code),  -- null untuk master global
    filename        VARCHAR(255) NOT NULL,
    uploaded_by     UUID REFERENCES users(id),
    rows_total      INTEGER NOT NULL DEFAULT 0,
    rows_processed  INTEGER NOT NULL DEFAULT 0,
    rows_skipped    INTEGER NOT NULL DEFAULT 0,
    rows_error      INTEGER NOT NULL DEFAULT 0,
    error_detail    JSONB,
    status          VARCHAR(10) NOT NULL CHECK (status IN ('success','partial','failed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Trigger `updated_at`

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at      BEFORE UPDATE ON users      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_employees_updated_at  BEFORE UPDATE ON employees  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_parts_updated_at      BEFORE UPDATE ON parts      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inquiries_updated_at  BEFORE UPDATE ON inquiries  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Seed `sites`

```sql
INSERT INTO sites (code, name, region, ut_warehouses) VALUES
  ('AGMR', 'Asam-Asam · GMR',  'Kalimantan Selatan', ARRAY['RTT','TBD']),
  ('RANT', 'Rantau',           'Kalimantan Selatan', ARRAY['SMR','TBD']),
  ('SPUT', 'Satui · Putera',   'Kalimantan Selatan', ARRAY['BTL','TBD']);
```

---

## 12. Notifikasi

| Trigger | Penerima | Pesan |
|---------|----------|-------|
| Part masuk WARNING setelah upload | Admin Site + GL | "[PN] stok di bawah MIN — RTT: X, MIN: Y" |
| Part RTT = 0 | Admin Site + GL | "⚠️ [PN] HABIS di warehouse primary site!" |
| Inquiry baru (pending) dari Mekanik | PIC UT | "Inquiry baru dari [SITE]: [PN], qty: [N]" |
| PIC UT respond VALID | Mekanik + GL | "Inquiry [PN]: TERSEDIA di [ut_site_code]" |
| PIC UT respond INVALID | Mekanik + GL | "Inquiry [PN]: TIDAK ADA. Pengganti: [replacement_pn]" |
| Upload gagal | Admin Site | "Upload [kind] gagal: [error detail]" |

> Implementasi pakai **Resend** (email). Phase 2 boleh tambah PWA push notification.

---

## 13. Tech Stack

### Backend
| Package | Fungsi |
|---------|--------|
| `fastapi` >= 0.111 | Framework API |
| `uvicorn[standard]` | ASGI server |
| `pydantic` v2 | Schema validation |
| `sqlalchemy[asyncio]` 2.0 | ORM async |
| `asyncpg` | Driver PostgreSQL async |
| `alembic` | Database migrations |
| `passlib[bcrypt]` | Hash password |
| `python-jose[cryptography]` | JWT issue & verify |
| `python-multipart` | File upload |
| `pandas` + `openpyxl` | Parse CSV/XLSX + export Excel |
| `resend` | Email notification |
| `python-dotenv` | Env config |

### Frontend
| Package | Fungsi |
|---------|--------|
| `next` 14 | Framework (App Router) |
| `tailwindcss` | Styling |
| `swr` | Data fetching + cache + revalidate |
| `react-hook-form` | Form handling |
| `zod` | Form validation schema |
| `recharts` | Grafik histori stok |
| `lucide-react` | Icons |
| `date-fns` | Format tanggal |
| `clsx` + `tailwind-merge` | Conditional class |

### Infrastructure
| Layer | Pilihan |
|-------|---------|
| Database | **PostgreSQL 16** (Docker lokal) |
| Backend | **FastAPI** (Docker / langsung) |
| Frontend | **Next.js** localhost:3000 |
| Migration | **Alembic** |
| GUI DB | TablePlus / pgAdmin / DBeaver |
| Email | Resend (free tier 3.000/bulan) |

---

## 14. MVP Scope

### Phase 1 — Inti (siapkan pakai)
1. Login 3 tab (Plant NRP / Admin email / UT email)
2. Dashboard per role + readyness % (Admin + GL + Mekanik per site)
3. Katalog Class V: search + filter status/mnemonic + list/tabel
4. Detail part: RTT/TBD/Estimasi + gauge Min/Max
5. Upload readiness harian (validate → publish)
6. Upload master Class V/G (upsert)
7. Bulk upload karyawan + add manual
8. Form inquiry Class G dropdown (mekanik submit → pending)
9. Inbox PIC UT multi-site + respond (valid/invalid)
10. Halaman view-only GL untuk pantau inquiry tim

### Phase 2
11. Notifikasi email otomatis (semua trigger di §12)
12. Histori stok 7 hari (grafik line di detail part)
13. Export Excel inquiry (UT & GL & Admin)
14. Readyness gauge % per site di dashboard PIC UT
15. Ganti password admin/UT

### Phase 3
16. Analitik: part paling sering WARNING / paling banyak di-inquiry
17. PWA installable (push notification)
18. Halaman Super Admin (kelola akun admin/UT)
19. Audit log

---

## 15. API Endpoints Lengkap

**Base URL:** `http://localhost:8000/v1` (dev) · `https://api.utstock-kpp.id/v1` (prod)

### 15.1 Auth

| Method | Endpoint | Role | Keterangan |
|--------|----------|------|-----------|
| POST | `/auth/login-nrp` | public | Plant login. Body `{nrp}`. Return JWT 12h. |
| POST | `/auth/login-password` | public | Admin/UT login. Body `{email, password}`. Return JWT. |
| PATCH | `/auth/change-password` | admin, supplier | Body `{old_password, new_password}`. Min 8 char. |
| GET | `/auth/me` | any | Return current user info dari JWT. |

**Response login:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 43200,
  "user": {
    "nrp_or_id": "KM19142",
    "name": "Ahmad Setiawan",
    "role": "Mekanik",
    "site": "AGMR"
  }
}
```

### 15.2 Dashboard

| Method | Endpoint | Role | Keterangan |
|--------|----------|------|-----------|
| GET | `/dashboard/summary?site=AGMR` | all | Summary per site. Supplier dapat `?site=ALL` (consolidated). |
| GET | `/dashboard/stock-latest?site=` | all | 5 baris terkini. |
| GET | `/dashboard/inquiry-count?site=` | all | Jumlah pending/valid/invalid. |

**Response `/dashboard/summary`:**
```json
{
  "site": "AGMR",
  "last_updated": "2026-05-21T08:30:00+07:00",
  "total_parts": 405,
  "status_count": { "WARNING": 32, "AMAN": 350, "OVER": 23, "MAX": 0 },
  "readyness": { "oh_pct": 87.2, "min_pct": 72.1, "fb_pct": 91.3 }
}
```

### 15.3 Parts & Stock

| Method | Endpoint | Role | Keterangan |
|--------|----------|------|-----------|
| GET | `/parts?cls=V&site=AGMR` | all | List part dgn stok per site. |
| GET | `/parts/{pn}?site=AGMR` | all | Detail satu part + stok di site itu. |
| GET | `/parts/{pn}/history?site=AGMR&days=7` | all | Histori stok 7/30 hari. |

**Query params `/parts`:**
```
?cls=V|G          → filter kelas (default V untuk readiness)
?site=AGMR|RANT|SPUT|ALL   → wajib untuk non-supplier
?search=          → partial PN atau description
?status=WARNING|AMAN|OVER|MAX
?mnemonic=KOMATSU|SCANIA|HENSLEY
?page=1&limit=20  → pagination
?sort_by=part_number|status|rtt_qty
?sort_dir=asc|desc
```

### 15.4 Master Parts (Class V/G)

| Method | Endpoint | Role | Keterangan |
|--------|----------|------|-----------|
| POST | `/master/parts/upload` | admin | Upload Excel master, upsert by PN. |
| GET | `/master/parts?cls=G&search=` | all | List master (paginated). |
| GET | `/master/parts/{pn}` | all | Detail satu part dari master. |

**Response `/master/parts/upload`:**
```json
{
  "inserted": 120,
  "updated": 9230,
  "class_v": 396,
  "class_g": 9356,
  "skipped": 5,
  "errors": []
}
```

### 15.5 Upload Readiness

| Method | Endpoint | Role | Keterangan |
|--------|----------|------|-----------|
| POST | `/upload/readiness/validate` | admin | multipart file. Site auto = admin.site. |
| POST | `/upload/readiness/publish` | admin | Body `{session_id}`. |
| GET | `/upload/logs?kind=readiness` | admin | History upload site. |
| GET | `/upload/logs/{id}` | admin | Detail satu log. |

**Response validate:**
```json
{
  "session_id": "abc123",
  "site": "AGMR",
  "rows_valid": 400,
  "rows_skipped": 5,
  "rows_error": 0,
  "preview": [
    { "pn": "01643-31032", "min": 101, "max": 134, "rtt": 120, "tbd": 10, "estimasi": 5, "status": "AMAN" }
  ],
  "skipped_detail": [
    { "row": 15, "pn": "XX-99", "reason": "PN not found in master Class V" }
  ]
}
```

### 15.6 Employees (Plant)

| Method | Endpoint | Role | Keterangan |
|--------|----------|------|-----------|
| POST | `/employees/bulk-upload` | admin | Excel (NO, NRP, NAMA, POSISI). Site auto. |
| GET | `/employees?search=&role=` | admin | List karyawan site admin. |
| POST | `/employees` | admin | Tambah satu karyawan manual. |
| PATCH | `/employees/{nrp}` | admin | Update name/role/shift/is_active. |

### 15.7 Inquiries (Class G)

| Method | Endpoint | Role | Keterangan |
|--------|----------|------|-----------|
| POST | `/inquiries` | Mekanik | Submit baru → status `pending`. |
| GET | `/inquiries/me` | Mekanik | Inquiry sendiri. |
| GET | `/inquiries?site=&status=` | GL, admin, supplier | List sesuai scope. |
| GET | `/inquiries/{id}` | all | Detail. |
| PATCH | `/inquiries/{id}/respond` | supplier | UT respond (valid/invalid). |
| GET | `/inquiries/export?site=&from=&to=` | GL, admin, supplier | Download Excel. |

**Request POST `/inquiries` (mekanik):**
```json
{
  "part_number": "6212-31-2300",
  "qty_needed": 5,
  "unit_asset": "PC200 #07"
}
```

Server isi otomatis: `submitted_by_nrp` = current user NRP, `site` = current user site, `status` = `pending`.

**Request PATCH `/inquiries/{id}/respond` (UT):**

Mode VALID:
```json
{
  "result": "valid",
  "ut_site_code": "RTT",
  "note": "Tersedia 5 pcs siap dikirim."
}
```

Mode INVALID:
```json
{
  "result": "invalid",
  "replacement_pn": "6212-31-2301",
  "ut_site_code": "BTL",
  "note": "PN diganti karena discontinued."
}
```

**Query params `/inquiries`:**
```
?site=AGMR|RANT|SPUT|ALL    → ALL hanya untuk supplier
?status=pending|valid|invalid
?from_date=YYYY-MM-DD
?to_date=YYYY-MM-DD
?page=&limit=
```

### 15.8 Export

| Method | Endpoint | Role | Keterangan |
|--------|----------|------|-----------|
| GET | `/export/inquiries?site=&from=&to=` | GL, admin, supplier | Download `.xlsx` inquiry. |
| GET | `/export/stock-report?site=` | admin, supplier | Snapshot stok saat ini → `.xlsx`. |

### 15.9 Error Response Format

```json
{
  "error": {
    "code": "STOCK_NOT_FOUND",
    "message": "Part number '99-9999' tidak ditemukan di katalog",
    "detail": null
  }
}
```

| HTTP | Kapan |
|------|-------|
| 200 / 201 | Success / Created |
| 400 | Payload salah format |
| 401 | Token tidak ada / expired |
| 403 | Role atau site tidak match |
| 404 | Resource not found |
| 409 | Conflict (duplicate NRP, dll) |
| 422 | Validation error (Pydantic) |
| 500 | Server error |

---

## 16. Backend Setup (FastAPI + Docker + Alembic)

### 16.1 Project Structure

```
ut-stock-backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py          ← Settings from .env
│   │   ├── database.py        ← Async engine + get_db()
│   │   ├── auth.py            ← JWT issue + verify + require_role
│   │   └── security.py        ← bcrypt helpers
│   ├── models/
│   │   ├── site.py
│   │   ├── user.py
│   │   ├── employee.py
│   │   ├── part.py
│   │   ├── stock.py
│   │   ├── inquiry.py
│   │   └── upload_log.py
│   ├── schemas/               ← Pydantic v2 models
│   │   ├── auth.py
│   │   ├── part.py
│   │   ├── stock.py
│   │   ├── inquiry.py
│   │   ├── employee.py
│   │   └── upload.py
│   ├── routers/
│   │   ├── auth.py            ← /auth/login-nrp, /auth/login-password
│   │   ├── dashboard.py
│   │   ├── parts.py
│   │   ├── master.py          ← /master/parts/*
│   │   ├── upload.py          ← /upload/readiness/*
│   │   ├── employees.py
│   │   ├── inquiries.py
│   │   └── export.py
│   ├── services/
│   │   ├── readiness_parser.py
│   │   ├── master_parser.py
│   │   ├── employee_parser.py
│   │   ├── stock_calc.py      ← compute status, readyness %
│   │   ├── email.py           ← Resend wrapper
│   │   └── excel_export.py
│   └── utils/
│       └── dependencies.py    ← require_role, require_site_match
├── alembic/
│   ├── env.py
│   └── versions/
├── scripts/
│   ├── seed_sites.py
│   └── seed_admin.py
├── requirements.txt
├── alembic.ini
├── .env.example
├── Dockerfile
└── docker-compose.yml
```

### 16.2 `docker-compose.yml`

```yaml
version: '3.8'
services:
  db:
    image: postgres:16-alpine
    container_name: utstock_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: utstock
      POSTGRES_USER: utstock_user
      POSTGRES_PASSWORD: utstock_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U utstock_user -d utstock"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: .
    container_name: utstock_api
    restart: unless-stopped
    env_file: .env
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

volumes:
  postgres_data:
```

### 16.3 `requirements.txt`

```
fastapi>=0.111.0
uvicorn[standard]
pydantic>=2.0
sqlalchemy[asyncio]>=2.0
asyncpg
alembic
passlib[bcrypt]
python-jose[cryptography]
python-multipart
pandas
openpyxl
resend
python-dotenv
```

### 16.4 Database Connection (`app/core/database.py`)

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

### 16.5 Auth Implementation (`app/routers/auth.py`)

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.models.employee import Employee
from app.schemas.auth import LoginNRP, LoginPassword, ChangePassword, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])
pwd = CryptContext(schemes=["bcrypt"])

def issue_jwt(payload: dict) -> str:
    payload = {**payload, "exp": datetime.utcnow() + timedelta(hours=12)}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")

@router.post("/login-nrp", response_model=TokenResponse)
async def login_nrp(body: LoginNRP, db: AsyncSession = Depends(get_db)):
    nrp = body.nrp.strip().upper()
    emp = (await db.execute(
        select(Employee).where(Employee.nrp == nrp, Employee.is_active == True)
    )).scalar_one_or_none()

    if not emp:
        raise HTTPException(401, "NRP tidak ditemukan atau tidak aktif")

    token = issue_jwt({
        "sub": emp.nrp,
        "kind": "employee",
        "name": emp.name,
        "role": emp.role,           # Mekanik | GL
        "site": emp.site,
    })
    return {"access_token": token, "token_type": "bearer", "expires_in": 43200,
            "user": {"nrp_or_id": emp.nrp, "name": emp.name, "role": emp.role, "site": emp.site}}

@router.post("/login-password", response_model=TokenResponse)
async def login_password(body: LoginPassword, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(
        select(User).where(User.email == body.email.lower())
    )).scalar_one_or_none()

    if not user or not pwd.verify(body.password, user.password):
        raise HTTPException(401, "Email atau password salah")
    if not user.is_active:
        raise HTTPException(403, "Akun tidak aktif")

    token = issue_jwt({
        "sub": str(user.id),
        "kind": "user",
        "name": user.name,
        "role": user.role,          # admin | supplier
        "site": user.site,          # bisa None untuk supplier
    })
    return {"access_token": token, "token_type": "bearer", "expires_in": 43200,
            "user": {"nrp_or_id": str(user.id), "name": user.name, "role": user.role, "site": user.site}}

@router.patch("/change-password")
async def change_password(body: ChangePassword, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user["kind"] != "user":
        raise HTTPException(403, "Hanya admin/UT yang punya password")
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password minimal 8 karakter")

    u = await db.get(User, user["user_id"])
    if not pwd.verify(body.old_password, u.password):
        raise HTTPException(400, "Password lama salah")
    u.password = pwd.hash(body.new_password)
    u.password_changed_at = datetime.utcnow()
    return {"ok": True}
```

### 16.6 JWT Verify Middleware (`app/core/auth.py`)

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        return {
            "user_id": payload["sub"],
            "kind": payload["kind"],         # 'user' | 'employee'
            "role": payload["role"],
            "site": payload.get("site"),
            "name": payload["name"],
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except JWTError:
        raise HTTPException(401, "Token invalid")

def require_role(*roles: str):
    async def checker(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Forbidden")
        return user
    return checker
```

### 16.7 CORS Setup (`app/main.py`)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import auth, dashboard, parts, master, upload, employees, inquiries, export

app = FastAPI(title="UT STOCK by KPP Mining", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router,        prefix="/v1")
app.include_router(dashboard.router,   prefix="/v1")
app.include_router(parts.router,       prefix="/v1")
app.include_router(master.router,      prefix="/v1")
app.include_router(upload.router,      prefix="/v1")
app.include_router(employees.router,   prefix="/v1")
app.include_router(inquiries.router,   prefix="/v1")
app.include_router(export.router,      prefix="/v1")
```

### 16.8 Alembic Workflow

```bash
# Setup awal
pip install alembic
alembic init alembic

# Edit alembic/env.py:
#   from app.core.database import Base
#   from app.models import site, user, employee, part, stock, inquiry, upload_log
#   target_metadata = Base.metadata

# Edit alembic.ini:
#   sqlalchemy.url = postgresql+asyncpg://utstock_user:utstock_pass@localhost:5432/utstock

# Workflow
alembic revision --autogenerate -m "init schema v2.0"
alembic upgrade head

# Setelah ubah model
alembic revision --autogenerate -m "add estimated_qty to stock_levels"
alembic upgrade head

# Rollback
alembic downgrade -1
```

### 16.9 Migration Plan v2.0 (Urut)

Jika punya DB v3.2 lama, jalankan revision Alembic ini berurutan:

1. `add_sites_table` — buat tabel `sites` + seed 3 row
2. `users_site_to_enum` — ubah `users.site` jadi referensi `sites(code)`, tambah `password_changed_at`
3. `add_employees_table` — buat tabel `employees`
4. `parts_add_stockcode_mnemonic` — `ALTER TABLE parts ADD stockcode, mnemonic`
5. `stock_add_estimated_qty` — `ALTER TABLE stock_levels ADD estimated_qty INT DEFAULT 0`
6. `inquiries_v2_restructure`:
   - `DROP COLUMN reviewed_by, rejection_reason, reviewed_at, supplier_notes, responded_at, part_name, notes, urgency, date_needed`
   - `UPDATE inquiries SET status='pending' WHERE status='draft'`
   - `ALTER status CHECK ('pending','valid','invalid')`
   - `ADD COLUMN result, ut_site_code, replacement_pn, ut_note, responded_by, responded_at`
   - `ADD COLUMN submitted_by_nrp REFERENCES employees(nrp)` (backfill dari `submitted_by`)
7. `upload_logs_add_kind` — `ALTER TABLE upload_logs ADD kind, site`

### 16.10 Seed Scripts

```python
# scripts/seed_sites.py
import asyncio
from sqlalchemy import insert
from app.core.database import AsyncSessionLocal
from app.models.site import Site

async def seed():
    async with AsyncSessionLocal() as db:
        sites = [
            {"code":"AGMR","name":"Asam-Asam · GMR","region":"Kalimantan Selatan","ut_warehouses":["RTT","TBD"]},
            {"code":"RANT","name":"Rantau","region":"Kalimantan Selatan","ut_warehouses":["SMR","TBD"]},
            {"code":"SPUT","name":"Satui · Putera","region":"Kalimantan Selatan","ut_warehouses":["BTL","TBD"]},
        ]
        await db.execute(insert(Site), sites)
        await db.commit()
        print("Sites seeded.")

asyncio.run(seed())
```

```python
# scripts/seed_admin.py — buat 3 admin per site + 1 PIC UT global
import asyncio
from passlib.context import CryptContext
from app.core.database import AsyncSessionLocal
from app.models.user import User

async def seed():
    pwd = CryptContext(schemes=["bcrypt"])
    async with AsyncSessionLocal() as db:
        accounts = [
            ("Admin AGMR", "admin.agmr@kpp.co.id", "admin",    "AGMR"),
            ("Admin RANT", "admin.rant@kpp.co.id", "admin",    "RANT"),
            ("Admin SPUT", "admin.sput@kpp.co.id", "admin",    "SPUT"),
            ("PIC UT",     "pic@ut.co.id",          "supplier", None),
        ]
        for name, email, role, site in accounts:
            db.add(User(name=name, email=email, password=pwd.hash("admin123"),
                        role=role, site=site))
        await db.commit()
        print("Admin + PIC UT seeded.")

asyncio.run(seed())
```

### 16.11 Environment Variables

`.env` (backend):

```env
# Database
DATABASE_URL=postgresql+asyncpg://utstock_user:utstock_pass@localhost:5432/utstock

# JWT — generate: python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET_KEY=ganti_dengan_random_string_min_32_karakter
JWT_EXPIRE_HOURS=12

# Email
RESEND_API_KEY=re_xxxx
MAIL_FROM=noreply@utstock-kpp.id

# App
ENVIRONMENT=development
CORS_ORIGINS=["http://localhost:3000"]
```

`.env.local` (frontend):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/v1
```

---

## 17. Frontend Setup (Next.js consume API)

### 17.1 Project Structure

```
ut-stock-frontend/
├── app/
│   ├── layout.tsx              ← set data-org dari user role
│   ├── (auth)/
│   │   └── login/page.tsx      ← 3 tab (Plant/Admin/UT)
│   ├── (plant)/                ← layout untuk Mekanik & GL
│   │   ├── dashboard/page.tsx
│   │   ├── katalog/
│   │   │   ├── page.tsx
│   │   │   └── [pn]/page.tsx
│   │   ├── inquiry/
│   │   │   ├── baru/page.tsx
│   │   │   ├── saya/page.tsx
│   │   │   └── tim/page.tsx    ← GL only
│   │   └── profil/page.tsx
│   ├── (admin)/                ← layout Admin Site
│   │   └── admin/
│   │       ├── dashboard/page.tsx
│   │       ├── upload/
│   │       │   ├── readiness/page.tsx
│   │       │   └── master/page.tsx
│   │       ├── karyawan/page.tsx
│   │       ├── log/page.tsx
│   │       └── users/page.tsx
│   └── (ut)/                   ← layout PIC UT
│       └── ut/
│           ├── inquiry/page.tsx
│           └── readiness/page.tsx
├── components/
│   ├── ui/                     ← Button, Badge, Card, Input, Modal, Sheet
│   ├── layout/                 ← Topbar, Sidebar, BottomNav
│   ├── dashboard/              ← SummaryCards, ReadynessBars
│   ├── katalog/                ← PartCard, PartTable, FilterChips
│   ├── inquiry/                ← InquiryForm, InquiryRow, RespondPanel
│   ├── upload/                 ← FileDropzone, ValidationPreview
│   └── badge/                  ← StatusBadge, SiteBadge
├── lib/
│   ├── api.ts                  ← fetch helper + JWT injection
│   ├── auth.ts                 ← token storage (memory + cookie)
│   ├── types.ts                ← TypeScript types
│   └── utils.ts                ← cn, formatDate, dll
├── hooks/
│   ├── useAuth.ts
│   ├── useDashboard.ts
│   ├── useStock.ts
│   └── useInquiry.ts
├── middleware.ts               ← auth guard, role redirect
├── tailwind.config.ts
└── app/globals.css             ← CSS variables dari §7
```

### 17.2 API Client (`lib/api.ts`)

```typescript
import { getToken } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error?.message || `API error: ${res.status}`)
  }
  return res.json()
}

export const api = {
  get:    <T>(url: string) => apiFetch<T>(url),
  post:   <T>(url: string, body: unknown) =>
            apiFetch<T>(url, { method: 'POST', body: JSON.stringify(body) }),
  patch:  <T>(url: string, body: unknown) =>
            apiFetch<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(url: string) => apiFetch<T>(url, { method: 'DELETE' }),

  // Upload multipart
  upload: async <T>(url: string, file: File): Promise<T> => {
    const token = getToken()
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API_URL}${url}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    })
    if (!res.ok) throw new Error((await res.json()).error?.message || 'Upload failed')
    return res.json()
  },
}
```

### 17.3 Auth Storage (`lib/auth.ts`)

```typescript
// Token disimpan di memory + cookie httpOnly (set by login API route)
let _token: string | null = null
let _user: User | null = null

export function setSession(token: string, user: User) {
  _token = token
  _user = user
  document.cookie = `utstock_token=${token}; path=/; max-age=43200; secure; samesite=strict`
  localStorage.setItem('utstock_user', JSON.stringify(user))
}

export function getToken(): string | null {
  if (_token) return _token
  const m = document.cookie.match(/utstock_token=([^;]+)/)
  _token = m?.[1] ?? null
  return _token
}

export function getUser(): User | null {
  if (_user) return _user
  const raw = localStorage.getItem('utstock_user')
  _user = raw ? JSON.parse(raw) : null
  return _user
}

export function clearSession() {
  _token = null
  _user = null
  document.cookie = 'utstock_token=; path=/; max-age=0'
  localStorage.removeItem('utstock_user')
}
```

### 17.4 SWR Hook (`hooks/useDashboard.ts`)

```typescript
import useSWR from 'swr'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'

export function useDashboardSummary() {
  const user = getUser()
  const site = user?.role === 'supplier' ? 'ALL' : user?.site
  return useSWR(['dashboard/summary', site], () =>
    api.get<DashboardSummary>(`/dashboard/summary?site=${site}`)
  )
}
```

### 17.5 Root Layout dengan Theme Switch (`app/layout.tsx`)

```tsx
'use client'
import { useEffect } from 'react'
import { getUser } from '@/lib/auth'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const user = getUser()
    const org = user?.role === 'supplier' ? 'ut' : 'kpp'
    document.documentElement.setAttribute('data-org', org)
  }, [])

  return (
    <html lang="id" data-org="kpp">
      <body className="bg-bg text-ink font-sans">{children}</body>
    </html>
  )
}
```

### 17.6 Middleware Auth Guard (`middleware.ts`)

```typescript
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC = ['/login', '/api']

export function middleware(req: NextRequest) {
  const token = req.cookies.get('utstock_token')?.value
  const path = req.nextUrl.pathname

  if (PUBLIC.some(p => path.startsWith(p))) return NextResponse.next()
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next|favicon|.*\\..*).*)'] }
```

---

## 18. Quick Start Development

```bash
# ── 1. Backend ─────────────────────────────────────
git clone <repo>/ut-stock-backend
cd ut-stock-backend

# Start PostgreSQL
docker compose up -d db

# Install deps
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Setup env
cp .env.example .env
# → edit JWT_SECRET_KEY (python -c "import secrets; print(secrets.token_hex(32))")

# Run migrations
alembic upgrade head

# Seed (urut)
python scripts/seed_sites.py
python scripts/seed_admin.py

# Run API
uvicorn app.main:app --reload --port 8000

# Cek Swagger
open http://localhost:8000/docs

# ── 2. Frontend (terminal lain) ────────────────────
cd ../ut-stock-frontend
npm install
cp .env.example .env.local
npm run dev
# → http://localhost:3000

# ── 3. Login coba ──────────────────────────────────
# Plant   → /login tab Plant   → NRP: KM19142 (setelah bulk upload karyawan)
# Admin   → /login tab Admin   → admin.agmr@kpp.co.id / admin123
# PIC UT  → /login tab UT      → pic@ut.co.id / admin123
```

> **Bonus FastAPI:** Swagger UI (`/docs`) & ReDoc (`/redoc`) tersedia otomatis. Test semua endpoint langsung dari browser tanpa Postman.

---

## 19. Template Prompt untuk Claude Code

Copy-paste ini saat minta Claude generate kode per modul/halaman:

```
Buatkan [nama halaman/endpoint] untuk "UT STOCK by KPP Mining" sesuai
design doc DESIGN_UTSTOCK_KPP_FINAL.md.

──────────── FRONTEND ────────────
Tech:
- Next.js 14 App Router + React + TypeScript
- Tailwind CSS dengan tokens di app/globals.css (§7)
- Data fetching: SWR + api helper dari lib/api.ts
- Form: react-hook-form + zod
- Icons: lucide-react

Endpoint dikonsumsi: [GET/POST /v1/xxx — paste dari §15]
Response shape: [paste schema]
Role yang akses: [Mekanik | GL | admin | supplier]
data-org context: [kpp | ut]

Layout target:
- sm: [wireframe dari §10.x]
- 2xl: [wireframe desktop jika ada]

──────────── BACKEND ────────────
Tech:
- FastAPI + SQLAlchemy async + Pydantic v2
- Auth: get_current_user dependency
- Role check: require_role("admin"), require_site_match()
- DB: asyncpg ke PostgreSQL lokal

Model terkait: [paste dari §11]
Skema Pydantic: [definisikan di schemas/<modul>.py]
Business rule: [list dari §4/§5/§7]

──────────── Output yang diminta ────────────
1. List file yang akan dibuat/diubah (path)
2. Code lengkap setiap file
3. Alembic migration jika ada perubahan schema
4. Cara test (curl atau Swagger)
```

---

*File: DESIGN_UTSTOCK_KPP_FINAL.md · v2.0 · 24 Mei 2026*
*Konsolidasi v3.0 + v3.1 + v3.2 + delta v2.0 — siap langsung dipakai develop.*
