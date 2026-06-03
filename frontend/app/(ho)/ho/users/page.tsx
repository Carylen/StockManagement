"use client";

import { useState } from "react";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { Plus, Pencil, UserX, CheckCircle, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import type { Role } from "@/lib/types";

interface HOUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  site: string;
  is_active: boolean;
  created_at: string | null;
}

interface SiteRow {
  code: string;
  name: string;
  is_active: boolean;
}

interface CreateForm {
  name: string;
  email: string;
  password: string;
  role: Role;
  site: string;
}

interface EditForm {
  name: string;
  role: Role;
  site: string;
  is_active: string;
}

const ALL_ROLES: Role[] = ["user", "group_leader", "admin", "supplier", "super_admin"];

const ROLE_COLORS: Record<Role, string> = {
  user:         "#6B7280",
  group_leader: "#5B5BD6",
  admin:        "#D97706",
  supplier:     "#16A34A",
  super_admin:  "#1B1814",
};

export default function HOUsersPage() {
  const t = useTranslations("ho");
  const tr = useTranslations("roles");

  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<HOUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const params = new URLSearchParams();
  if (roleFilter !== "all") params.set("role", roleFilter);
  if (siteFilter !== "all") params.set("site", siteFilter);
  const queryKey = `/ho/users${params.toString() ? "?" + params.toString() : ""}`;

  const { data: users, isLoading, mutate } = useSWR<HOUser[]>(
    queryKey,
    (u: string) => api.get<HOUser[]>(u)
  );
  const { data: sites } = useSWR<SiteRow[]>("/ho/sites", (u: string) => api.get<SiteRow[]>(u));

  const createForm = useForm<CreateForm>({
    defaultValues: { role: "user", site: "AGMR" },
  });
  const editForm = useForm<EditForm>();

  const handleCreate = async (data: CreateForm) => {
    setLoading(true);
    try {
      await api.post("/ho/users", data);
      setToast({ msg: t("userCreated", { name: data.name }), kind: "ok" });
      setShowCreate(false);
      createForm.reset({ role: "user", site: "AGMR" });
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedCreateUser"), kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (data: EditForm) => {
    if (!editing) return;
    setLoading(true);
    try {
      await api.patch(`/ho/users/${editing.id}`, {
        ...data,
        is_active: data.is_active === "true",
      });
      setToast({ msg: t("userUpdated"), kind: "ok" });
      setEditing(null);
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedUpdateUser"), kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (user: HOUser) => {
    if (!confirm(t("deactivateUserConfirm", { name: user.name }))) return;
    setLoading(true);
    try {
      await api.delete(`/ho/users/${user.id}`);
      setToast({ msg: t("userDeactivated", { name: user.name }), kind: "ok" });
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedDeactivate"), kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (user: HOUser) => {
    setEditing(user);
    editForm.reset({ name: user.name, role: user.role, site: user.site, is_active: String(user.is_active) });
  };

  const siteOptions = sites?.filter((s) => s.is_active) ?? [];

  return (
    <div className="min-h-full">
      <Topbar title={t("usersTitle")} subtitle={t("usersSubtitle")} />

      {toast && (
        <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} />
      )}

      <div className="p-6">
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Role filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-bg text-ink text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">{t("allRoles")}</option>
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>{tr(r)}</option>
                ))}
              </select>
              {/* Site filter */}
              <select
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-bg text-ink text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">{t("allSites")}</option>
                {siteOptions.map((s) => (
                  <option key={s.code} value={s.code}>{s.code}</option>
                ))}
              </select>
              <span className="text-[12px] text-ink-3 font-medium">
                {users ? `${users.length} users` : "—"}
              </span>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-85"
              style={{ background: "#1B1814" }}
            >
              <Plus size={15} /> {t("addUser")}
            </button>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="divide-y divide-border/60">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="px-6 py-4 flex gap-4">
                  <div className="h-4 w-32 bg-surface-alt animate-pulse rounded" />
                  <div className="h-4 flex-1 bg-surface-alt animate-pulse rounded" />
                  <div className="h-4 w-20 bg-surface-alt animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : !users || users.length === 0 ? (
            <div className="py-16 text-center text-ink-3 text-sm">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-bg text-ink-2 text-[11px] uppercase tracking-[0.6px] font-semibold">
                    <th className="text-left px-6 py-3">{t("colName")}</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">{t("colEmail")}</th>
                    <th className="text-left px-4 py-3">{t("colRole")}</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">{t("colSite")}</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">{t("colStatus")}</th>
                    <th className="text-left px-4 py-3 hidden xl:table-cell">{t("colJoined")}</th>
                    <th className="text-right px-6 py-3">{t("colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-t border-border/60 hover:bg-surface-alt/40 transition-colors"
                    >
                      <td className="px-6 py-3 font-semibold text-ink">{user.name}</td>
                      <td className="px-4 py-3 text-ink-2 text-[12px] hidden sm:table-cell max-w-[180px] truncate">
                        {user.email || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold text-white"
                          style={{ background: ROLE_COLORS[user.role] }}
                        >
                          {tr(user.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-ink-2 hidden md:table-cell">
                        {user.site || "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1F6F4C]">
                            <CheckCircle size={11} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-3">
                            <XCircle size={11} /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-3 text-[12px] hidden xl:table-cell">
                        {user.created_at ? format(new Date(user.created_at), "d MMM yy") : "—"}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(user)}
                            className="p-1.5 rounded-lg text-ink-3 hover:bg-surface-alt hover:text-ink transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          {user.is_active && (
                            <button
                              onClick={() => handleDeactivate(user)}
                              disabled={loading}
                              className="p-1.5 rounded-lg text-ink-3 hover:bg-[#FEE2E2] hover:text-[#EF4444] transition-colors disabled:opacity-50"
                              title="Deactivate"
                            >
                              <UserX size={14} />
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

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t("createUserTitle")} width={480}>
        <form onSubmit={createForm.handleSubmit(handleCreate)} className="p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t("fullName")}</label>
            <input
              {...createForm.register("name", { required: true })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t("email")}</label>
            <input
              {...createForm.register("email", { required: true })}
              type="email"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t("password")}</label>
            <input
              {...createForm.register("password", { required: true, minLength: 8 })}
              type="password"
              placeholder="Min. 8 characters"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t("role")}</label>
              <select
                {...createForm.register("role")}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>{tr(r)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t("site")}</label>
              <select
                {...createForm.register("site")}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {siteOptions.map((s) => (
                  <option key={s.code} value={s.code}>{s.code} – {s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2.5 rounded-xl border border-border text-ink-2 text-sm font-semibold hover:bg-surface-alt transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
              style={{ background: "#1B1814" }}
            >
              {loading ? t("saving") : t("createBtn")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={t("editUserTitle")} width={420}>
        <form onSubmit={editForm.handleSubmit(handleEdit)} className="p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t("fullName")}</label>
            <input
              {...editForm.register("name", { required: true })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t("role")}</label>
              <select
                {...editForm.register("role")}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>{tr(r)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t("site")}</label>
              <select
                {...editForm.register("site")}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {siteOptions.map((s) => (
                  <option key={s.code} value={s.code}>{s.code}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t("activeStatus")}</label>
            <select
              {...editForm.register("is_active")}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-4 py-2.5 rounded-xl border border-border text-ink-2 text-sm font-semibold hover:bg-surface-alt transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
              style={{ background: "#1B1814" }}
            >
              {loading ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
