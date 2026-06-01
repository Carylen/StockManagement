# Prompt untuk Claude Code — Batch Fix

Kerjakan semua perubahan berikut satu per satu, mulai dari backend lalu frontend.
Setiap bagian selesai, konfirmasi sebelum lanjut ke bagian berikutnya.

---

## BACKEND — Kerjakan lebih dulu

### 1. Inquiry — Multi-part submission
Ubah schema dan logic inquiry agar satu submission bisa berisi banyak part sekaligus.

```
Ubah model dan endpoint inquiry:

Schema baru submission:
POST /v1/inquiries
body: {
  parts: [
    { part_number: str, part_name: str, qty: int, notes?: str },
    ...
  ],
  urgency: "URGENT" | "NORMAL",
  site: str  (dari user JWT, bukan dari body)
}

- Satu inquiry = satu "request" yang punya banyak inquiry_items
- Hapus field unit/equipment dari model
- Hapus field unit/equipment dari schema
- Mechanic bisa langsung submit tanpa approval GL (status langsung PENDING)
- part_name di-fetch dari master class V/G berdasarkan part_number
  sehingga tidak perlu diisi manual oleh mechanic

Buat/update tabel:
- tb_t_inquiries: id, site, submitted_by (nrp), submitted_by_name, 
  urgency, status (pending/valid/invalid), created_at, responded_at,
  responded_by, ut_note, ut_site_code
- tb_t_inquiry_items: id, inquiry_id (FK), part_number, part_name, 
  qty, replacement_pn (untuk invalid)

Update endpoint:
- POST /v1/inquiries → buat inquiry + items sekaligus
- GET /v1/inquiries → list per inquiry (bukan per item), 
  include: submitted_by_name, site, total_unique_parts (count items),
  total_qty (sum qty), status, created_at
- GET /v1/inquiries/{id} → detail + semua items
- PATCH /v1/inquiries/{id}/respond → respond valid/invalid untuk 
  semua items sekaligus, bukan per item
- GET /v1/inquiries/count?status=pending → return { count: int }

Hapus field unit/equipment dari semua schema dan model.
```

### 2. Readiness — Pisahkan storage dari Master Class V/G
```
Pisahkan tabel readiness harian dari master class V/G:

- tb_m_parts (master class V/G): permanent, tidak terpengaruh upload harian
- tb_t_stock_levels (readiness harian): bersifat REPLACE per upload,
  tidak historical — setiap upload admin replace semua data site tersebut

Pastikan:
- GET /v1/parts (catalog) → baca dari tb_t_stock_levels (hasil upload harian)
- GET /v1/master/parts → baca dari tb_m_parts (master class V/G)
- Upload readiness → replace semua stock_levels untuk site tersebut
- Kolom yang disimpan dari upload: part_number, description, commodity,
  min_qty, max_qty, rtt_qty, tbd_qty, estimated_qty, status
- Hapus kolom producer/mnemonic dari stock_levels 
  (itu ada di master, bukan di readiness)
- Commodity tetap disimpan dari hasil upload
- Estimasi disimpan sebagai DATE nullable, bukan string

Buat migration Alembic untuk perubahan ini.
```

### 3. Employees — Hapus shift
```
Hapus field shift dari:
- Model tb_m_employees
- Schema EmployeeCreate, EmployeeUpdate, EmployeeResponse
- Endpoint POST /v1/employees dan PATCH /v1/employees/{id}
- Buat migration Alembic: ALTER TABLE tb_m_employees DROP COLUMN shift
```

### 4. Sites — Baca dari DB bukan hardcode
```
Pastikan endpoint GET /v1/sites mengembalikan hanya site yang is_active=true
dari tb_m_sites. Supplier/UT menggunakan endpoint ini untuk filter,
bukan hardcode ["AGMR", "RANT", "SPUT"].
```

### 5. Inquiry — Fix permission untuk Mechanic
```
Di router inquiries, pastikan:
- Role "mechanic" bisa POST /v1/inquiries tanpa perlu approval GL
- Hapus semua logika approval GL jika ada
- Status langsung "pending" saat mechanic submit
```

---

## FRONTEND — Kerjakan setelah backend selesai

### MENU MEKANIK

#### Inquiry Form — Multi-part
```
Update halaman submit inquiry untuk mechanic (app/(mechanic)/inquiry/new 
atau sejenisnya):

1. Hapus field "Unit / Equipment" dari form
2. Hapus field "Part yang diminta" sebagai text input bebas
3. Ganti dengan flow:
   - Search / pilih part number dari master class V/G 
     (fetch dari GET /v1/master/parts?search=...)
   - Setelah pilih PN, nama part otomatis muncul (disabled, dari DB)
   - Input qty
   - Tombol "+ Tambah Part" untuk tambah baris part lagi
   - Bisa tambah banyak part sebelum submit
   - Tampilkan list part yang akan di-submit sebelum konfirmasi
4. Submit → POST /v1/inquiries dengan array parts
```

#### Menu Inquiry GL
```
Di navigasi GL, ganti label "My Teams Inquiries" atau "Team Mechanics" 
menjadi "Inquiries" saja.
```

---

### MENU ADMIN

#### Dashboard
```
1. "Kategori" → rename jadi "Commodity"
2. Commodity: fetch dari stock_levels.commodity, tampilkan di tabel/card
3. "Estimasi" → format sebagai tanggal (DD MMM YYYY), 
   kalau null tampilkan blank/dash bukan "—" atau "0"
4. "FB" → rename jadi "TOTAL" di semua tampilan dashboard
```

#### Employees
```
1. Hapus semua field shift dari:
   - Form tambah karyawan
   - Form edit karyawan  
   - Tabel list karyawan
   - Stat cards
2. Fix total count: stat card "Total Plant Employees" harus 
   pakai employees.length (semua), bukan glCount + mekanikCount 
   yang mungkin ada filter aktif
```

#### Readiness Catalog
```
1. Hapus kolom "Producer" dari tabel — itu sama dengan mnemonic, 
   tidak perlu ditampilkan
2. Tambahkan kolom "Commodity" — fetch dari stock_levels.commodity
3. Data yang ditampilkan murni dari hasil upload harian (stock_levels),
   bukan join dengan master
```

#### Class G Inquiry (Admin view)
```
Ubah tampilan list inquiry:

List view (bukan per item, tapi per request):
- Kolom: Nama Mekanik, Role, Site, Total Unique PN, Total Qty, 
  Urgency, Status, Tanggal Submit
- Hapus semua kode/ID dari tampilan list
- Klik row → buka detail

Detail view:
- Desktop: gunakan sidebar/panel samping, BUKAN modal
- Mobile: gunakan modal/bottom sheet
- Pastikan tidak muncul dua-duanya sekaligus
- Isi detail: semua items (PN, nama part, qty), 
  info mekanik, urgency, status, respond UT jika ada
```

#### Master Class V/G
```
Tambahkan kolom Mnemonic dan Commodity pada:
- Tabel preview master
- Response API GET /v1/master/parts
```

---

### MENU UT / SUPPLIER

#### Readiness
```
1. Filter site: fetch dari GET /v1/sites (is_active=true) 
   bukan hardcode. Kalau hanya AGMR yang aktif, tampilkan AGMR saja.
2. Hapus filter "MAX" dari filter status
```

#### Incoming Inquiries
```
1. Tampilkan hanya inquiry dengan status PENDING
   (yang sudah direspond masuk ke Response History)

2. List view — judul per baris ganti dari "Part Number" menjadi:
   - Nama Mekanik
   - Site  
   - Total unique part number yang diminta (contoh: "3 part")

3. Form respond INVALID:
   - Field "Part Number Pengganti": maxLength 25, min width lebih lebar
   - Field "Kode Warehouse UT": maxLength 25, min width lebih lebar

4. Detail inquiry tampilkan semua items (list part + qty)
   bukan hanya satu part
```

#### Response History
```
Ubah tampilan:

List view — sisakan kolom:
- Site
- Tanggal Submit
- Total Qty (sum semua items)
- Tanggal Respond
- Status (valid/invalid)

Detail → buka via MODAL (bukan navigate ke halaman baru):
- Tampilkan semua items: PN, nama part, qty, replacement PN (jika invalid)
- Info mekanik, urgency, catatan UT
```

---

## Urutan pengerjaan yang disarankan

1. Backend: migration pisah readiness & master, hapus shift
2. Backend: update model & schema inquiry (multi-part)
3. Backend: update semua endpoint inquiry
4. Buat migration Alembic untuk semua perubahan schema
5. Frontend: update form inquiry mechanic (multi-part)
6. Frontend: update semua list/detail inquiry (admin + supplier)
7. Frontend: update dashboard (commodity, estimasi, rename FB→TOTAL)
8. Frontend: update employees (hapus shift)
9. Frontend: update readiness (hapus producer, tambah commodity)
10. Frontend: update supplier readiness (dynamic sites, hapus filter MAX)
