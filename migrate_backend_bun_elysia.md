# Spec / Prompt: Migrasi Backend FastAPI → Bun + ElysiaJS

> **Untuk Claude Code:** Tujuannya **mengganti backend Python (FastAPI)** dengan backend
> baru berbasis **Bun + ElysiaJS** yang hemat resource dan best-practice, **tanpa
> mengubah frontend dan tanpa mengubah skema database**. Kerjakan di branch fitur baru
> dari `develop` (mis. `feature/backend-bun-elysia`).
>
> **Prinsip utama — PARITY DULU, optimasi kemudian:**
> 1. **Kontrak API tidak berubah.** Semua path tetap (`/v1/...`), bentuk request/response,
>    status code, dan header (`Content-Disposition`, CORS) identik. Frontend Next.js
>    tidak boleh perlu diubah.
> 2. **Skema DB tidak berubah.** Backend baru menyambung ke Postgres yang sama, tabel
>    yang sama. Migrasi data tidak diperlukan.
> 3. **Token & password interop.** JWT tetap HS256 dengan `SECRET_KEY` yang sama dan
>    klaim yang sama (`sub`, `permissions`, `exp`), agar token lama tetap valid. Password
>    lama ber-hash **bcrypt** harus tetap bisa diverifikasi.
>
> **Langkah 0 — pelajari kode nyata dulu.** Baca seluruh `backend/app/` di `develop`
> (routers, models, schemas, services, core, utils, alembic) sebelum menulis kode.
> Spec ini sumber kebenaran untuk *strategi & behavior*, bukan untuk detail field literal.

---

## 1. Stack: Dari → Ke

| Concern | Sekarang (Python) | Target (Bun + Elysia) | Catatan |
|---|---|---|---|
| Runtime | CPython + uvicorn | **Bun** | startup cepat, memori rendah |
| Framework | FastAPI | **ElysiaJS** | |
| Validasi | Pydantic v2 | **TypeBox bawaan Elysia** (`t.Object`, dll) | tanpa lib tambahan |
| ORM/DB | SQLAlchemy async + asyncpg | **Drizzle ORM + `postgres` (postgres.js)** | type-safe, ringan |
| Migrasi | Alembic | **Drizzle Kit** | introspect skema existing dulu |
| Auth JWT | python-jose (HS256) | **`@elysiajs/jwt`** (HS256, secret sama) | klaim payload dipertahankan |
| Bearer | OAuth2PasswordBearer | **`@elysiajs/bearer`** + login form flow | endpoint login form-urlencoded dipertahankan |
| Hash password | bcrypt | **`Bun.password`** (verify bcrypt; hash baru tetap bcrypt) | bawaan Bun, tanpa dep |
| CORS | CORSMiddleware | **`@elysiajs/cors`** | expose `Content-Disposition` |
| Upload file | python-multipart | multipart bawaan Elysia (`t.File`) | |
| Excel/CSV | pandas + openpyxl | **`exceljs`** (xlsx read/write) + parser CSV ringan | bagian paling berisiko — uji ketat |
| Email | resend (python) | **`resend` (npm)** | API sama |
| HTTP client | httpx | **`fetch` bawaan Bun** | |
| Config | pydantic-settings | modul config + `Bun.env`, divalidasi TypeBox saat start | |
| Logging | — | **`@bogeychan/elysia-logger` / pino** minimal | |

## 2. Inventaris yang harus dimigrasi (1:1)

**Routers (`/v1`):** `auth`, `dashboard`, `parts`, `inquiries`, `upload`, `users`,
`employees`, `export`, `master`, `templates`, `sites`, `ho`. Petakan setiap endpoint
(path, method, query/body, response model, status code) tanpa kecuali.

**Models (tabel):** `user`, `part`, `inquiry` (+ items), `stock`, `upload_log`,
`master_upload`, `site`, `permission`, `plant_site_mapping`, `ut_stock`. Drizzle schema
harus cocok persis dengan tabel yang ada (nama tabel `tb_m_*` / `tb_t_*`, nama kolom,
tipe, index, FK, default).

**Services (logika bisnis — port hati-hati):** `csv_parser`, `employee_parser`,
`excel_templates`, `stock_calc`, `readiness_service`, `ut_stock_parser`,
`ut_stock_service`, `email`. Yang berbasis pandas (`*_parser`, `excel_templates`,
`export`) adalah area paling rawan regresi.

**Core/Utils:** `auth` (Principal, JWT, `require_role`), `config`, `database`,
`rbac` (katalog permission), `permissions`, `scoping`, `dependencies`.

## 3. Struktur project yang disarankan

```
backend-bun/
  src/
    index.ts                # bootstrap Elysia, mount plugins & routes
    config.ts               # env typed + validasi saat start
    db/
      client.ts             # postgres.js + drizzle instance, pool kecil
      schema/               # drizzle schema per tabel (mirror models)
      migrations/           # output drizzle-kit
    plugins/
      auth.ts               # jwt + bearer + derive principal + requireRole/requirePermission
      cors.ts
      logger.ts
    modules/                # 1 folder per router
      auth/  dashboard/  parts/  inquiries/  upload/  users/
      employees/  export/  master/  templates/  sites/  ho/
        *.routes.ts
        *.model.ts          # TypeBox schemas (request/response)
        *.service.ts        # logika bisnis
    services/               # parser excel/csv, email, stock_calc, dll
    utils/                  # permissions, scoping
  drizzle.config.ts
  package.json
  tsconfig.json
  Dockerfile
```

## 4. Strategi DB & Migrasi (Drizzle)

1. **Introspect dulu:** jalankan `drizzle-kit introspect` ke Postgres existing (hasil
   Alembic) untuk meng-generate Drizzle schema yang **dijamin paritas**. Rapikan hasilnya
   ke `src/db/schema/`.
2. **Baseline:** tandai migrasi awal sebagai baseline (schema yang sudah ada di DB);
   jangan generate ulang CREATE TABLE yang sudah ada.
3. **Setelah cutover**, perubahan skema berikutnya pakai `drizzle-kit generate` +
   `drizzle-kit migrate`. Alembic dipensiunkan.
4. **Pola koneksi:** `postgres.js` dengan pool kecil (mis. `max: 10`) + `prepare: true`.
   Per-request transaction: buka transaksi di awal handler, commit di akhir, rollback saat
   error — meniru `get_db()` yang sekarang (commit di akhir request).
5. **Hati-hati tipe:** kolom `Numeric`/`Decimal` (mis. `min_qty`, `max_qty`) dikembalikan
   Drizzle sebagai string — tangani konsisten agar response numerik sama dengan sekarang.
   Pertahankan timezone-aware datetime (UTC).

## 5. Auth & RBAC (titik interop kritis)

- **JWT:** `@elysiajs/jwt` dengan `secret = SECRET_KEY`, `alg: "HS256"`. Klaim payload
  **harus sama**: `sub` (user id), `permissions: string[]`, `exp` (detik). Verifikasi
  token lama harus lolos. `ACCESS_TOKEN_EXPIRE_HOURS` dipertahankan.
- **Login:** endpoint `POST /v1/auth/login` saat ini mengikuti OAuth2 password flow
  (**form-urlencoded** `username`/`password`). Pertahankan persis (frontend mengirim form).
  Dukung dua `auth_method`: `password` (email+password) dan `nrp` (passwordless).
- **Password:** verifikasi dengan `Bun.password.verify(plain, hash)` — mendukung bcrypt
  existing. Hash baru tetap pakai bcrypt (`Bun.password.hash(pw, { algorithm: "bcrypt" })`)
  agar konsisten dengan data lama. (Opsional: rehash bertahap ke argon2id saat login
  sukses — hanya jika diminta.)
- **Principal:** bangun objek `Principal` yang sama (id, name, role, site, auth_method,
  email, nrp, position, permissions) via Elysia `derive`/`resolve`.
- **Normalisasi role legacy** (`mekanik→user`, `gl→group_leader`, dst) dipertahankan.
- **Guard:** sediakan `requireRole(...roles)` dan `requirePermission(...perms)` setara
  dependency FastAPI sekarang. Permission dibaca dari klaim JWT + tabel RBAC seperti sekarang.
- **`rbac.ts`:** port katalog permission & mapping role default dari `core/rbac.py`
  apa adanya (single source of truth untuk seed).

## 6. Parser & Export Excel/CSV (area paling berisiko)

- Ganti pandas/openpyxl dengan **`exceljs`** (baca & tulis `.xlsx`) dan parser CSV ringan.
- Untuk setiap parser (`ut_stock_parser`, `csv_parser`, `employee_parser`) dan generator
  (`excel_templates`, router `export`/`templates`):
  - Siapkan **file sampel** dari sistem lama dan tulis test yang membandingkan output
    backend baru vs lama **byte-for-byte secara semantik** (baris, kolom, tipe, urutan).
  - Pertahankan nama sheet, header, format kolom, dan header `Content-Disposition`
    (nama file unduhan) yang sama.
- Streaming untuk file besar bila memungkinkan agar memori rendah.

## 7. Best practice hemat resource (Bun/Elysia)

- Gunakan **TypeBox** untuk semua validasi (dikompilasi, cepat, tanpa overhead runtime besar).
- **Pool DB kecil** + `prepare: true` di postgres.js; hindari koneksi berlebih.
- Hindari library berat. Pilih `exceljs` hanya di modul yang butuh; pertimbangkan lazy import.
- Build & run efisien: `bun build --target=bun` lalu jalankan, atau `bun run src/index.ts`.
  Image Docker pakai `oven/bun:1-alpine` (jauh lebih kecil dari image Python).
- Untuk multi-core: jalankan beberapa instance di belakang nginx, atau gunakan
  `Bun.serve({ reusePort: true })` — jangan over-provision.
- Aktifkan gzip/stream untuk response besar (export). Logging minimal di produksi.
- Set `NODE_ENV`/`BUN_ENV=production`; matikan pretty-log di prod.

## 8. Docker & Deploy

- Ganti service `api` di `docker-compose.yml`: `build.context: ./backend-bun`,
  `Dockerfile` berbasis `oven/bun:1-alpine`, expose port **8000** yang sama.
- `depends_on: db (service_healthy)` dan `nginx` tetap. Env (`DATABASE_URL`,
  `SECRET_KEY`, `CORS_ORIGINS`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
  `ACCESS_TOKEN_EXPIRE_HOURS`) dipertahankan namanya.
- Multi-stage build: `bun install --frozen-lockfile` → copy source → runtime image ramping.
- Sediakan healthcheck `GET /` (sudah mengembalikan `{status:"ok",...}`).

## 9. Rencana eksekusi bertahap

1. Scaffold project Bun+Elysia, config, db client (introspect schema), plugin auth/cors/logger.
2. Port **auth** (login dua metode, JWT, Principal, guard) + verifikasi token lama lolos.
3. Port modul read-only dulu: `dashboard`, `parts`, `sites`, `master` → uji paritas response.
4. Port modul tulis: `inquiries`, `users`, `employees`, `ho`.
5. Port **upload/export/templates** + parser Excel/CSV (paling rawan) dengan test fixture.
6. Port `email` (Resend), `readiness_service`, `ut_stock_service`, `stock_calc`.
7. Dockerize, ganti service `api`, jalankan paralel dengan backend lama untuk uji banding.
8. Cutover setelah semua acceptance criteria hijau; pensiunkan FastAPI + Alembic.

## 10. Acceptance Criteria

- [ ] Semua endpoint `/v1/*` punya path, method, request/response, status code, dan header
      identik dengan backend lama (uji dengan koleksi request/respons nyata).
- [ ] Frontend Next.js berjalan **tanpa perubahan** terhadap backend baru.
- [ ] Token JWT yang diterbitkan backend lama tetap diterima backend baru, dan sebaliknya
      (secret/alg/klaim sama).
- [ ] User dengan password bcrypt lama bisa login.
- [ ] Login `nrp` (passwordless) dan `password` (email) keduanya jalan.
- [ ] RBAC: `require_role`/`require_permission` memberi 403 yang sama seperti sekarang.
- [ ] Upload/parse Excel/CSV menghasilkan data identik dengan implementasi pandas (uji fixture).
- [ ] Export/template menghasilkan file dengan struktur & nama unduhan sama.
- [ ] Email via Resend terkirim dengan template yang sama.
- [ ] Drizzle schema cocok 100% dengan tabel existing; tidak ada migrasi destruktif.
- [ ] Image Docker baru lebih kecil & pemakaian memori runtime lebih rendah dari FastAPI
      (lampirkan angka before/after).

## 11. Risiko & Gotcha

- **Decimal as string** di Drizzle → jaga konsistensi serialisasi angka.
- **Bentuk error FastAPI** (`{"detail": ...}`, 422 validation) ditiru agar frontend yang
  membaca `detail` tetap jalan; map error TypeBox ke format yang sama.
- **OAuth2 form login** (bukan JSON) mudah terlewat — pastikan content-type
  `application/x-www-form-urlencoded` didukung di endpoint login.
- **CORS `expose_headers: Content-Disposition`** wajib agar unduhan file di frontend jalan.
- **Paritas parser Excel** adalah sumber regresi terbesar — jangan anggap remeh; uji fixture.
- **Timezone & format tanggal** harus tetap UTC ISO yang sama.

## 12. Out of Scope

- Perubahan UI/UX atau kontrak API.
- Perubahan skema database atau migrasi data.
- Penambahan fitur baru (fokus migrasi 1:1).
