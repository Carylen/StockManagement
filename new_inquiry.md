# Spec: New Inquiry Flow — Planner / Non-Planner / Mechanic + Class Gating & Approval

> **Untuk Claude Code:** Spec ini dieksekusi di branch **`develop`**. Seluruh fondasi
> RBAC berbasis DB (`tb_m_role_permissions`), model permission, dan migrasi `0002`
> sudah ada di `develop`. **Tidak perlu rebase.** Buat branch fitur baru dari
> `develop` (mis. `feature/new-inquiry-flow`) sebelum mulai.
>
> **Langkah 0 — verifikasi dulu, jangan berasumsi.** Sebelum menulis kode, baca file
> aktual berikut karena nama field bisa berbeda dari spec ini:
> - `backend/app/models/inquiry.py` (cek apakah submitter pakai `submitted_by_user_id`
>   atau `submitted_by_nrp`/`submitted_by_name`)
> - `backend/app/routers/inquiries.py`
> - `backend/app/core/rbac.py`, `backend/app/models/permission.py`
> - `backend/app/core/auth.py` (helper `require_role` / `Principal` / cara cek permission)
> - `backend/app/models/part.py` (kolom `kelas` / `class`)
> - migrasi terakhir di `backend/alembic/versions/` (untuk menyambung rantai revisi)
>
> Sesuaikan implementasi dengan kode nyata, gunakan spec ini sebagai sumber kebenaran
> untuk **behavior**, bukan untuk nama field literal.

---

## 1. Tujuan

Mengubah flow inquiry agar mendukung 3 jenis requester dengan hak berbeda dan
menambahkan tahap **approval internal** sebelum inquiry diteruskan ke supplier/UT.
Flow supplier yang sudah ada **tidak berubah** — approval hanyalah gerbang baru di depannya.

## 2. Role & Permission

### Role
- `planner` — **role baru**. Request part kelas **G & V** langsung (tanpa approval),
  dan bisa meng-approve request orang lain.
- `group_leader` (non-planner) — request part kelas **G** saja, **butuh approval planner**.
- `mechanic` — **role baru**. Request part kelas **G** saja, **butuh approval planner**.

> `planner` dan `group_leader` dibuat sebagai **role terpisah** (bukan flag boolean),
> karena beda jabatan & tanggung jawab.

### Permission baru (tambahkan ke katalog di `rbac.py`)
| Code | Label (group: Inquiry) |
|---|---|
| `can_request_class_g` | Request part Class G |
| `can_request_class_v` | Request part Class V |
| `can_approve_inquiry` | Approve / reject inquiry |

### Mapping default role → permission
| Permission | planner | group_leader | mechanic |
|---|:--:|:--:|:--:|
| `can_request_class_g` | ✅ | ✅ | ✅ |
| `can_request_class_v` | ✅ | ❌ | ❌ |
| `can_approve_inquiry` | ✅ | ❌ | ❌ |

- Tambahkan `planner` dan `mechanic` ke `ALL_ROLES` / `ROLE_PERMISSIONS` di `rbac.py`.
- `super_admin` tetap dapat semua permission.
- Pertahankan `can_submit_inquiry` lama jika masih dipakai di tempat lain, tetapi
  gating kelas baru memakai `can_request_class_g` / `can_request_class_v`.

> Catatan: RBAC dibaca dari DB saat runtime. Selain update `rbac.py` (seed default),
> WAJIB ada migrasi yang menambahkan permission baru dan baris mapping role→permission
> ke tabel `tb_m_role_permissions` agar berlaku pada DB yang sudah ada.

## 3. Aturan Submit Inquiry

Di endpoint create inquiry (`POST /inquiries`):

1. **Sumber part = master.** Part dipilih lewat **dropdown autocomplete** dari
   `tb_m_parts` (master yang dikelola admin). Part di luar master **DITOLAK**
   (HTTP 400) — validasi di backend tetap wajib walau UI sudah membatasi.
2. **Gating kelas per item:**
   - Lookup `Part.kelas` untuk tiap `part_number`.
   - Jika ada item kelas `V` dan requester **tidak** punya `can_request_class_v`
     → tolak (HTTP 403) dengan pesan jelas item mana yang menyebabkannya.
   - Item kelas `G` butuh `can_request_class_g`.
3. **Penentuan approval:**
   - Jika requester punya `can_approve_inquiry` (planner) →
     `approval_status = "not_required"` (langsung lanjut ke flow supplier).
   - Jika tidak → `approval_status = "pending"` (masuk antrian approval).
4. Izinkan role yang boleh submit: `planner`, `group_leader`, `mechanic`
   (sesuaikan dependency `require_role` / cek permission `can_request_class_g`).

## 4. Perubahan Data Model

Tambahkan ke model `Inquiry` (level inquiry, **terpisah** dari status respon supplier per-item):

| Kolom | Tipe | Keterangan |
|---|---|---|
| `approval_status` | `String(20)` | `not_required` \| `pending` \| `approved` \| `rejected`. Default `pending`. |
| `approved_by_user_id` | `String(36)` FK `tb_m_users.id` nullable | Planner yang approve/reject. |
| `approved_at` | `DateTime(tz)` nullable | Waktu keputusan. |
| `reject_reason` | `Text` nullable | Alasan reject. |

- Jangan ubah status respon supplier per-item (`pending`/`valid`/`invalid`) yang sudah ada.
- Pertimbangkan index pada `approval_status` untuk query antrian.

## 5. Approval Workflow (Backend)

Endpoint baru, butuh permission `can_approve_inquiry`, **di-scope ke site yang sama**
dengan inquiry (planner mana saja di site itu boleh approve):

- `PATCH /inquiries/{id}/approve`
  - Hanya jika `approval_status == "pending"` dan `inquiry.site == principal.site`.
  - Set `approval_status="approved"`, `approved_by_user_id`, `approved_at`.
- `PATCH /inquiries/{id}/reject`
  - Body: `{ "reject_reason": str }` (wajib).
  - Set `approval_status="rejected"`, isi `reject_reason`, `approved_by_user_id`, `approved_at`.
- Endpoint list (untuk antrian planner): filter `approval_status=pending` + site sendiri.
  Bisa reuse endpoint list inquiry dengan query param `approval_status`.

### Gerbang ke supplier
- Item hanya boleh direspon supplier (`PATCH /inquiries/{id}/respond`) jika
  `approval_status ∈ {"approved", "not_required"}`. Jika `pending`/`rejected` → tolak.
- Endpoint list inquiry untuk **supplier** hanya menampilkan inquiry dengan
  `approval_status ∈ {"approved","not_required"}`.

## 6. Frontend

1. **Form request (autocomplete):** dropdown search part-number berbasis master
   (endpoint pencarian part yang sudah ada di `tb_m_parts`). User tidak bisa mengetik
   part bebas di luar master. Tampilkan kelas part; sembunyikan/disable item kelas V
   untuk requester tanpa `can_request_class_v`.
2. **Halaman antrian approval (planner):** daftar inquiry `approval_status=pending` di
   site planner, dengan aksi **Approve** dan **Reject (wajib alasan)**. Guard dengan
   permission `can_approve_inquiry` (lihat `usePermissionGuard`).
3. **Status request milik requester:** tampilkan badge approval
   (`Menunggu approval` / `Disetujui` / `Ditolak` + alasan) di halaman "request saya".
4. **Navigasi & RBAC UI:** tambahkan menu antrian approval untuk planner di sidebar
   (lihat `lib/nav.ts`, `Sidebar.tsx`). Tambahkan role `planner` & `mechanic` ke UI
   manajemen user/role (menu HO).

## 7. Migrasi & Seed

- Buat 1 migrasi Alembic baru yang **menyambung revisi terakhir di `develop`**
  (cek `down_revision` ke revisi paling akhir, jangan bercabang):
  - tambah kolom approval di `tb_t_inquiries`,
  - insert permission baru ke tabel permission,
  - insert mapping role→permission untuk `planner` / `group_leader` / `mechanic`,
  - (jika role disimpan sebagai data) seed role `planner` & `mechanic`.
- Update `rbac.py` agar re-seed/reset menghasilkan state yang sama dengan migrasi.
- Update script seed terkait bila perlu (`backend/scripts/seed_*.py`).

## 8. i18n

Tambahkan key untuk label baru (approval status, tombol approve/reject, pesan error
gating kelas, nama role planner/mechanic) di `frontend/messages/en.json` dan
`frontend/messages/id.json`.

## 9. Edge Cases & Keputusan (sudah difinalkan)

- Planner mana saja **di site yang sama** boleh approve. (Bukan planner spesifik.)
- Part di luar master → **ditolak**, karena input berupa autocomplete dari master.
- Planner & mechanic adalah role terpisah dari group_leader.
- Setelah approved, flow ke supplier **persis seperti sekarang** (tidak diubah).
- Inquiry campuran G+V oleh non-planner: tolak seluruh request jika ada item V
  yang tidak diizinkan (jangan submit sebagian) — beri pesan item penyebabnya.
- Requester tidak boleh approve request-nya sendiri lewat jalur normal; namun planner
  yang submit otomatis `not_required` (tidak masuk antrian sama sekali).

## 10. Acceptance Criteria

- [ ] `planner` bisa request G & V, langsung `not_required`, tampil ke supplier tanpa approval.
- [ ] `group_leader` & `mechanic` bisa request G saja; request V ditolak 403.
- [ ] Request G oleh `group_leader`/`mechanic` masuk `approval_status=pending` dan
      TIDAK tampil ke supplier sebelum di-approve.
- [ ] Planner di site sama bisa approve/reject; planner site lain tidak bisa (403/404).
- [ ] Setelah approve, inquiry mengikuti flow supplier yang lama tanpa perubahan perilaku.
- [ ] Reject menyimpan alasan dan inquiry tidak pernah sampai ke supplier.
- [ ] Part di luar master ditolak di backend.
- [ ] Migrasi jalan bersih di atas `develop` (rantai revisi nyambung) dan permission
      baru berlaku pada DB existing.
- [ ] i18n EN/ID lengkap untuk semua label baru.

## 11. Out of Scope

- Perubahan apa pun pada flow respon supplier/UT yang sudah ada.
- Perubahan pada flow readiness.
- Notifikasi/email approval (kecuali diminta terpisah).
