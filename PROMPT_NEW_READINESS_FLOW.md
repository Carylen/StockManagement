# Prompt Claude Code — New Readiness Flow

Kerjakan per bagian, konfirmasi setiap bagian selesai sebelum lanjut.

---

## Gambaran Flow Baru

```
KPP Admin                          UT/Supplier
    │                                   │
    ▼                                   ▼
Master Class V/G                Upload file stok UT
(set PN, PN baru,                (ambil: material,
 MIN, MAX per part)               Plnt, Avail Stock)
    │                                   │
    └──────────────┬────────────────────┘
                   ▼
          Cross-reference:
          material ada di master KPP? → proses
          tidak ada?                  → abaikan
          Plnt → lookup tb_m_plant_site_mapping → site_code
                   │
                   ▼
          Simpan ke tb_t_ut_stock
          (replace per site, keep last jika kosong)
                   │
                   ▼
          Status dihitung ON-THE-FLY saat query:
          avail_stock < min  → WARNING
          min ≤ avail ≤ max  → AMAN
          avail_stock > max  → OVER
          avail_stock = 0    → WARNING (treat as < min)
```

---

## BAGIAN 1 — Schema & Migration

```
Buat migration Alembic "0004_new_readiness_flow" dengan perubahan:

### 1A. Tambah kolom di tb_m_parts (Master Class V/G)

ALTER TABLE tb_m_parts ADD COLUMN IF NOT EXISTS:
  min_qty          NUMERIC(10,2) DEFAULT 0
  max_qty          NUMERIC(10,2) DEFAULT 0
  superseded_by    VARCHAR(50) REFERENCES tb_m_parts(part_number) 
                   ON DELETE SET NULL NULLABLE
  is_active        BOOLEAN DEFAULT true NOT NULL

Index: CREATE INDEX ON tb_m_parts(superseded_by) WHERE superseded_by IS NOT NULL;

Catatan supersession:
- Kalau superseded_by IS NULL dan is_active = true  → PN masih berlaku
- Kalau superseded_by IS NOT NULL                   → PN digantikan PN baru
- Kalau is_active = false                           → PN nonaktif
- Query selalu resolve ke PN aktif: 
  ikuti chain superseded_by sampai superseded_by IS NULL

### 1B. Tabel baru: tb_m_plant_site_mapping

CREATE TABLE tb_m_plant_site_mapping (
  plnt_code    VARCHAR(10) PRIMARY KEY,
  site_code    VARCHAR(10) NOT NULL REFERENCES tb_m_sites(code),
  description  VARCHAR(100),
  is_active    BOOLEAN DEFAULT true NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

Seed data awal:
INSERT INTO tb_m_plant_site_mapping VALUES
  ('RTT', 'AGMR', 'Warehouse UT · AGMR', true, now()),
  ('SMR', 'RANT', 'Warehouse UT · RANT', true, now()),
  ('BTL', 'SPUT', 'Warehouse UT · SPUT', true, now());

### 1C. Tabel baru: tb_t_ut_stock

CREATE TABLE tb_t_ut_stock (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number    VARCHAR(50) NOT NULL,
  plnt_code      VARCHAR(10) NOT NULL,
  site_code      VARCHAR(10) NOT NULL REFERENCES tb_m_sites(code),
  avail_stock    NUMERIC(10,2) NOT NULL DEFAULT 0,
  upload_batch   UUID NOT NULL,
  is_latest      BOOLEAN NOT NULL DEFAULT true,
  uploaded_at    TIMESTAMPTZ DEFAULT now(),
  uploaded_by    UUID REFERENCES tb_m_users(id)
);

Index:
  CREATE INDEX ON tb_t_ut_stock(site_code, is_latest);
  CREATE INDEX ON tb_t_ut_stock(part_number, site_code, is_latest);
  CREATE INDEX ON tb_t_ut_stock(upload_batch);

### 1D. Tabel baru: tb_t_ut_upload_log

CREATE TABLE tb_t_ut_upload_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id       UUID NOT NULL UNIQUE,
  uploaded_by    UUID REFERENCES tb_m_users(id),
  filename       VARCHAR(255),
  total_rows     INT DEFAULT 0,
  matched_rows   INT DEFAULT 0,
  skipped_rows   INT DEFAULT 0,
  sites_affected JSONB,           -- ["AGMR", "RANT"]
  uploaded_at    TIMESTAMPTZ DEFAULT now()
);

### 1E. Hapus atau archive tb_t_stock_levels

Rename tabel lama:
  ALTER TABLE tb_t_stock_levels RENAME TO tb_t_stock_levels_deprecated;

Semua referensi ke stock_levels akan diganti ke query 
JOIN tb_t_ut_stock + tb_m_parts (lihat Bagian 3).
```

---

## BAGIAN 2 — UT Stock Parser

```
Buat app/services/ut_stock_parser.py

Parser untuk file upload UT. File bisa CSV atau XLSX.
File punya 4-5 kolom, kita hanya ambil 3:
  - "material"     → part_number (case-insensitive header match)
  - "Plnt"         → plnt_code   (alias: "plant", "plnt", "wh", "warehouse")
  - "Avail Stock"  → avail_stock (alias: "avail stock", "available stock", 
                                   "avail_stock", "stock", "qty")

Kolom lain: ABAIKAN sepenuhnya.

REQUIRED_COLUMNS = {"material", "plnt", "avail_stock"}

COLUMN_ALIASES = {
  "material":    ["material", "part number", "part_number", "pn", "matnr"],
  "plnt":        ["plnt", "plant", "wh", "warehouse", "site", "loc"],
  "avail_stock": ["avail stock", "avail_stock", "available stock", 
                  "available_stock", "stock", "qty available", "qty"],
}

Logic parser:
1. Baca file (smart header detection seperti readiness_parser.py)
2. Match kolom dengan alias (case-insensitive)
3. Kalau salah satu dari 3 kolom tidak ditemukan → return error
4. Per baris:
   - Skip jika material kosong / NaN / header row
   - plnt_code = _clean_cell(row["plnt"]).upper()
   - part_number = _clean_cell(row["material"]).upper()
   - avail_stock = _safe_float(row["avail_stock"])
   - Skip jika avail_stock < 0

5. Return ParseResult:
   {
     rows: [{ part_number, plnt_code, avail_stock }],
     skipped: int,
     errors: [],
     plnt_codes_found: set  -- ["RTT", "SMR"] untuk info
   }

TIDAK ada validasi apakah PN ada di master — itu dilakukan di service layer.
```

---

## BAGIAN 3 — Upload Service & Endpoint

```
Buat app/services/ut_stock_service.py

Fungsi utama: process_ut_stock_upload(file_bytes, filename, uploader_id, db)

Step 1 — Parse file:
  result = parse_ut_stock_file(file_bytes, filename)
  if result.errors: return error

Step 2 — Resolve Plnt → Site:
  Query tb_m_plant_site_mapping WHERE plnt_code IN (result.plnt_codes_found)
  AND is_active = true
  
  Buat dict: { "RTT": "AGMR", "SMR": "RANT", ... }
  
  Rows dengan plnt_code yang tidak ada di mapping → skip, catat di warnings

Step 3 — Cross-reference dengan master KPP:
  Query tb_m_parts WHERE part_number IN (all part_numbers from file)
  AND is_active = true
  
  Resolve supersession chain:
    def resolve_active_pn(pn, parts_dict):
      part = parts_dict.get(pn)
      if not part: return None          # tidak ada di master → skip
      if part.superseded_by:
        return resolve_active_pn(part.superseded_by, parts_dict)
      return part.part_number           # ini PN aktif
  
  Rows dengan PN tidak ada di master → skip (jangan error, cukup catat)

Step 4 — Replace data lama per site:
  batch_id = uuid4()
  sites_affected = set(plnt_site_map.values())
  
  Untuk setiap site yang terpengaruh:
    UPDATE tb_t_ut_stock 
    SET is_latest = false 
    WHERE site_code = site AND is_latest = true
  
  Insert semua rows baru dengan is_latest = true dan batch_id

Step 5 — Simpan upload log:
  INSERT tb_t_ut_upload_log (batch_id, uploaded_by, filename, 
    total_rows, matched_rows, skipped_rows, sites_affected)

Step 6 — Return summary:
  {
    batch_id,
    total_rows,
    matched_rows,    -- rows yang ada di master KPP
    skipped_rows,    -- rows yang tidak ada di master atau plnt tidak dikenal
    sites_affected,  -- ["AGMR"]
    warnings: []     -- plnt codes yang tidak dikenal
  }

### Endpoint

Di app/routers/upload.py, tambahkan:

POST /v1/upload/ut-stock/validate
  - require_permission("can_upload_readiness") — untuk supplier
  - Parse dan dry-run (tidak simpan ke DB)
  - Return preview: matched_rows, skipped_rows, sites_affected, 
    sample 10 baris pertama yang matched

POST /v1/upload/ut-stock/publish
  - require_permission("can_upload_readiness")
  - Jalankan full process_ut_stock_upload()
  - Return summary

GET /v1/upload/ut-stock/logs
  - require_permission("can_upload_readiness")
  - Return list tb_t_ut_upload_log, terbaru dulu
```

---

## BAGIAN 4 — Query Readiness On-The-Fly

```
Buat app/services/readiness_service.py

Fungsi: get_readiness(site_code, db, filters=None)

Query:
  SELECT 
    p.part_number,
    COALESCE(p.superseded_by, p.part_number) as active_pn,
    p.description,
    p.mnemonic,
    p.commodity,
    p.class,
    p.min_qty,
    p.max_qty,
    s.avail_stock,
    s.uploaded_at,
    CASE
      WHEN s.avail_stock IS NULL     THEN 'NO_DATA'
      WHEN s.avail_stock < p.min_qty THEN 'WARNING'
      WHEN s.avail_stock > p.max_qty THEN 'OVER'
      ELSE 'AMAN'
    END as status
  FROM tb_m_parts p
  LEFT JOIN tb_t_ut_stock s 
    ON s.part_number = p.part_number 
    AND s.site_code = :site_code 
    AND s.is_latest = true
  WHERE p.class = 'V'
    AND p.is_active = true
  ORDER BY 
    CASE status 
      WHEN 'WARNING' THEN 1 
      WHEN 'OVER' THEN 2 
      WHEN 'AMAN' THEN 3 
      WHEN 'NO_DATA' THEN 4 
    END,
    p.part_number

Fallback — kalau SEMUA is_latest = false (belum ada upload sama sekali):
  Gunakan data upload terakhir:
  JOIN dengan subquery: 
    SELECT * FROM tb_t_ut_stock 
    WHERE site_code = :site_code 
    AND uploaded_at = (
      SELECT MAX(uploaded_at) FROM tb_t_ut_stock 
      WHERE site_code = :site_code
    )

Filter yang didukung:
  status: 'WARNING' | 'AMAN' | 'OVER' | 'NO_DATA'
  search: part_number ILIKE atau description ILIKE
  class: 'V' | 'G' (default 'V')

### Update endpoint GET /v1/parts

Ganti implementasi lama (dari stock_levels) ke readiness_service.get_readiness()

Response per item tambahkan field:
  avail_stock: float | null
  last_uploaded_at: datetime | null  (kapan UT terakhir upload)
  is_fallback: bool  (true jika pakai data kemarin bukan latest)

### Update endpoint GET /v1/dashboard/summary

Hitung statistik dari readiness_service:
  readiness_oh_pct  = parts dengan avail_stock > 0 / total parts * 100
  readiness_min_pct = parts dengan avail_stock >= min_qty / total parts * 100
  total_pct         = (avail_stock + estimasi) >= min_qty / total * 100
  
  status_breakdown  = { WARNING: X, AMAN: X, OVER: X, NO_DATA: X }
  last_ut_upload    = MAX(uploaded_at) dari tb_t_ut_upload_log untuk site ini
```

---

## BAGIAN 5 — Master Class V/G Update

```
Update app/routers/master.py dan schemas

### 5A. Schema MasterPart update

Tambahkan field ke PartResponse dan PartCreate:
  min_qty:       float = 0
  max_qty:       float = 0  
  superseded_by: str | None = None
  is_active:     bool = True

### 5B. Endpoint GET /v1/master/parts

Tambahkan kolom ke response:
  min_qty, max_qty, superseded_by, is_active

Tambahkan filter:
  ?is_active=true|false|all (default: all)
  ?has_supersession=true (hanya yang punya superseded_by)

### 5C. Endpoint PATCH /v1/master/parts/{pn}

Buat endpoint untuk update min/max dan supersession per part:
  body: {
    min_qty?: float,
    max_qty?: float,
    superseded_by?: str | null,  -- null untuk hapus supersession
    is_active?: bool
  }
  
  Validasi:
  - Kalau superseded_by diisi, pastikan target PN ada di master
  - Jangan boleh circular supersession (A→B→A)
  - Kalau set is_active=false tapi part punya avail_stock > 0, 
    return warning (bukan error)
  
  require_permission("can_manage_master")

### 5D. Upload master Excel — update parser

Di master_parser.py, tambahkan kolom opsional:
  "min"  → min_qty  (alias: "min qty", "minimum", "min_qty")
  "max"  → max_qty  (alias: "max qty", "maximum", "max_qty")
  "new pn" → superseded_by (alias: "new part number", "pn baru", 
                              "part number baru", "superseded_by")

Kalau kolom ini tidak ada di file upload → isi dengan nilai existing di DB
(jangan overwrite dengan 0 kalau kolom tidak ada di file).
```

---

## BAGIAN 6 — Remove Upload Readiness dari Admin

```
### 6A. Backend

Hapus atau disable endpoint:
  POST /v1/upload/readiness/validate
  POST /v1/upload/readiness/publish
  GET  /v1/upload/logs  (ganti ke ut-stock logs untuk supplier)

Kalau mau aman, jangan hapus — cukup return 410 Gone:
  @router.post("/upload/readiness/validate")
  async def deprecated():
    raise HTTPException(
      status_code=410, 
      detail="Endpoint deprecated. Readiness kini diupload oleh UT/Supplier."
    )

### 6B. Frontend Admin

1. Hapus nav item "Upload Readiness" dari ADMIN_NAV 
   di Sidebar.tsx dan MobileBottomNav.tsx

2. Hapus atau redirect halaman app/(admin)/admin/upload/page.tsx
   Kalau diakses langsung → redirect ke /dashboard

3. Update CLAUDE.md: catat bahwa upload readiness 
   sekarang ada di menu Supplier, bukan Admin

### 6C. Frontend Supplier — tambah Upload Readiness

Tambahkan nav item "Upload Stock" ke SUPPLIER_NAV:
  { href: "/supplier/upload", label: "Upload Stock", icon: Upload,
    permission: "can_upload_readiness" }

Buat halaman app/(supplier)/supplier/upload/page.tsx:

Layout halaman:
1. Info banner:
   "Upload file stok UT. Kolom yang dibaca: Material, Plnt, Avail Stock.
    Part number yang tidak ada di katalog KPP akan diabaikan otomatis."

2. Step 1 — Pilih file (drag & drop atau browse)
   Accept: .xlsx, .xls, .csv
   Max: 20MB

3. Step 2 — Setelah pilih file → POST /upload/ut-stock/validate
   Tampilkan preview hasil validasi:
   - X baris matched dengan katalog KPP
   - X baris diabaikan (PN tidak dikenal)
   - Site yang akan diupdate: [badge AGMR] [badge RANT]
   - Tabel preview 10 baris pertama: PN | Nama Part | Plnt | Avail Stock

4. Step 3 — Tombol "Publish" → POST /upload/ut-stock/publish
   Loading state → Success state dengan summary

5. Upload History (bawah halaman):
   List dari GET /upload/ut-stock/logs
   Kolom: Tanggal | File | Matched | Skipped | Sites | Uploaded by
```

---

## BAGIAN 7 — Plant-Site Mapping di HO Dashboard

```
Tambahkan endpoint untuk HO manage mapping Plnt → Site:

GET    /v1/ho/plant-mappings        → list semua mapping
POST   /v1/ho/plant-mappings        → tambah mapping baru
  body: { plnt_code, site_code, description }
PATCH  /v1/ho/plant-mappings/{code} → update atau toggle active
DELETE /v1/ho/plant-mappings/{code} → hapus mapping

require_permission("can_manage_sites") untuk semua endpoint ini.

Di HO frontend (/ho/sites atau tab terpisah di Manage Sites):
Tampilkan tabel mapping:
  Plnt Code | Site | Deskripsi | Status | Actions
  RTT       | AGMR | Warehouse UT · AGMR | Active | Edit | Toggle
```

---

## Urutan pengerjaan

1. Bagian 1 — Schema & migration (foundation)
2. Bagian 2 — UT stock parser
3. Bagian 3 — Upload service & endpoint
4. Bagian 4 — Query on-the-fly (update GET /parts dan dashboard)
5. Bagian 5 — Master Class V/G update (min/max, supersession)
6. Bagian 6 — Remove upload dari admin, tambah ke supplier
7. Bagian 7 — HO plant-site mapping

Setelah semua selesai:
  alembic upgrade head
  
Test manual dengan file UT yang ada (kolom: material, Plnt="RTT", Avail Stock).
