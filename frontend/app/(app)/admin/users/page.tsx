"use client";

import { useState } from "react";
import useSWR from "swr";
import { UserPlus, Pencil, Trash2, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { SkeletonTable } from "@/components/ui/Skeleton";
import type { AppUser, Role } from "@/lib/types";

const ROLE_LABELS: Record<Role, string> = {
  mechanic: "Mekanik",
  group_leader: "Group Leader",
  admin: "Admin Site",
  supplier: "Supplier (UT)",
};

const ROLE_COLORS: Record<Role, string> = {
  mechanic: "#1B1814",
  group_leader: "#6366F1",
  admin: "#F5A623",
  supplier: "#22C55E",
};

interface UserFormData {
  name: string;
  email: string;
  password?: string;
  role: Role;
  site: string;
}

export default function AdminUsersPage() {
  const { data: users, isLoading, mutate } = useSWR<AppUser[]>(
    "/users",
    (u: string) => api.get<AppUser[]>(u)
  );

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [loading, setLoading] = useState(false);

  const createForm = useForm<UserFormData>({
    defaultValues: { role: "mechanic", site: "AGMR" },
  });

  const editForm = useForm<{ name: string; role: Role; is_active: boolean }>();

  const handleCreate = async (data: UserFormData) => {
    setLoading(true);
    try {
      await api.post("/users", data);
      setToast({ msg: `User "${data.name}" berhasil dibuat`, kind: "ok" });
      setShowCreate(false);
      createForm.reset({ role: "mechanic", site: "AGMR" });
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Gagal membuat user", kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (data: { name: string; role: Role; is_active: boolean }) => {
    if (!editing) return;
    setLoading(true);
    try {
      await api.patch(`/users/${editing.id}`, data);
      setToast({ msg: "User berhasil diperbarui", kind: "ok" });
      setEditing(null);
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Gagal update", kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (user: AppUser) => {
    if (!confirm(`Nonaktifkan akun "${user.name}"?`)) return;
    setLoading(true);
    try {
      await api.delete(`/users/${user.id}`);
      setToast({ msg: `Akun "${user.name}" dinonaktifkan`, kind: "ok" });
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Gagal", kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (user: AppUser) => {
    setEditing(user);
    editForm.reset({ name: user.name, role: user.role, is_active: user.is_active });
  };

  return (
    <div className="min-h-full">
      <Toast message={toast?.msg ?? null} kind={toast?.kind} onDismiss={() => setToast(null)} />
      <Topbar title="Kelola Users" subtitle="Admin · Manajemen akun sistem" />

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Buat User Baru">
        <form onSubmit={createForm.handleSubmit(handleCreate)} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1.5">Nama Lengkap</label>
            <input
              className="w-full px-3 py-2.5 border border-[rgba(27,24,20,0.12)] rounded-lg text-sm focus:outline-none focus:border-primary"
              {...createForm.register("name", { required: true })}
              placeholder="Nama lengkap"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1.5">Email</label>
            <input
              type="email"
              className="w-full px-3 py-2.5 border border-[rgba(27,24,20,0.12)] rounded-lg text-sm focus:outline-none focus:border-primary"
              {...createForm.register("email", { required: true })}
              placeholder="email@kpp.co.id"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1.5">Password</label>
            <input
              type="password"
              className="w-full px-3 py-2.5 border border-[rgba(27,24,20,0.12)] rounded-lg text-sm focus:outline-none focus:border-primary"
              {...createForm.register("password", { required: true, minLength: 8 })}
              placeholder="Min. 8 karakter"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1.5">Role</label>
              <select
                className="w-full px-3 py-2.5 border border-[rgba(27,24,20,0.12)] rounded-lg text-sm focus:outline-none focus:border-primary bg-white"
                {...createForm.register("role", { required: true })}
              >
                <option value="mechanic">Mekanik</option>
                <option value="group_leader">Group Leader</option>
                <option value="admin">Admin Site</option>
                <option value="supplier">Supplier (UT)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1.5">Site</label>
              <input
                className="w-full px-3 py-2.5 border border-[rgba(27,24,20,0.12)] rounded-lg text-sm focus:outline-none focus:border-primary"
                {...createForm.register("site", { required: true })}
                defaultValue="AGMR"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2.5 bg-[#F5EFE1] text-ink text-sm font-semibold rounded-lg">
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-ink text-white font-bold text-sm rounded-lg disabled:opacity-60"
            >
              {loading ? "Membuat..." : "Buat User"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit User">
        {editing && (
          <form onSubmit={editForm.handleSubmit(handleEdit)} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1.5">Nama Lengkap</label>
              <input
                className="w-full px-3 py-2.5 border border-[rgba(27,24,20,0.12)] rounded-lg text-sm focus:outline-none focus:border-primary"
                {...editForm.register("name", { required: true })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1.5">Email</label>
              <input
                type="email"
                value={editing.email}
                disabled
                className="w-full px-3 py-2.5 border border-[rgba(27,24,20,0.06)] rounded-lg text-sm bg-[#F5EFE1] text-ink-3"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">Role</label>
                <select
                  className="w-full px-3 py-2.5 border border-[rgba(27,24,20,0.12)] rounded-lg text-sm focus:outline-none focus:border-primary bg-white"
                  {...editForm.register("role")}
                >
                  <option value="mechanic">Mekanik</option>
                  <option value="group_leader">Group Leader</option>
                  <option value="admin">Admin Site</option>
                  <option value="supplier">Supplier (UT)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">Status Aktif</label>
                <select
                  className="w-full px-3 py-2.5 border border-[rgba(27,24,20,0.12)] rounded-lg text-sm focus:outline-none focus:border-primary bg-white"
                  {...editForm.register("is_active")}
                >
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2.5 bg-[#F5EFE1] text-ink text-sm font-semibold rounded-lg">
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-ink text-white font-bold text-sm rounded-lg disabled:opacity-60"
              >
                {loading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-2">
            <span className="font-bold text-ink">{users?.length ?? "—"}</span> user terdaftar
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => mutate()} className="p-1.5 text-ink-3 hover:text-ink transition-colors">
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-ink text-white text-xs font-semibold rounded-lg hover:bg-ink/80 transition-colors"
            >
              <UserPlus size={13} /> Tambah User
            </button>
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-[rgba(27,24,20,0.08)] overflow-hidden">
          {isLoading ? (
            <SkeletonTable rows={6} />
          ) : !users || users.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-ink-3 text-sm">Belum ada user</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F5EFE1]">
                  <tr>
                    {["Nama", "Email", "Role", "Site", "Status", "Bergabung", "Aksi"].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-ink-2 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t border-[rgba(27,24,20,0.05)] hover:bg-[#FBF7EE] transition-colors">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: ROLE_COLORS[user.role] }}
                          >
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-ink text-sm">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-2">{user.email}</td>
                      <td className="px-3 py-3">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: ROLE_COLORS[user.role] + "20",
                            color: ROLE_COLORS[user.role],
                          }}
                        >
                          {ROLE_LABELS[user.role]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-ink-2">{user.site}</td>
                      <td className="px-3 py-3">
                        {user.is_active ? (
                          <div className="flex items-center gap-1 text-aman-text">
                            <CheckCircle size={13} />
                            <span className="text-xs font-semibold">Aktif</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-ink-3">
                            <XCircle size={13} />
                            <span className="text-xs">Nonaktif</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-3">
                        {new Date(user.created_at).toLocaleDateString("id")}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(user)}
                            className="p-1.5 text-ink-3 hover:text-ink hover:bg-[#F5EFE1] rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          {user.is_active && (
                            <button
                              onClick={() => handleDeactivate(user)}
                              className="p-1.5 text-ink-3 hover:text-warning hover:bg-warning-bg rounded-lg transition-colors"
                              title="Nonaktifkan"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
