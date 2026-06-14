"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { Save, AlertTriangle, Plus, Trash2, Loader2, X } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Toast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { useTranslations } from "next-intl";

interface PermissionRow {
  code: string;
  label: string;
  group_name: string;
  description: string | null;
}

interface RoleRow {
  code: string;
  label: string;
  description: string | null;
  is_system: boolean;
  permissions: string[];
}

export default function HORolesPage() {
  const t = useTranslations("ho");

  const { data: permissions } = useSWR<PermissionRow[]>(
    "/ho/permissions",
    (u: string) => api.get<PermissionRow[]>(u),
  );
  const { data: rolesData, mutate } = useSWR<RoleRow[]>(
    "/ho/roles",
    (u: string) => api.get<RoleRow[]>(u),
  );

  const [matrix, setMatrix] = useState<Record<string, Set<string>>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  // Add role modal
  const [addOpen, setAddOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!rolesData) return;
    const next: Record<string, Set<string>> = {};
    for (const row of rolesData) {
      next[row.code] = new Set(row.permissions);
    }
    setMatrix(next);
    setDirty(false);
  }, [rolesData]);

  const togglePermission = (roleCode: string, permCode: string) => {
    setMatrix((prev) => {
      const copy: Record<string, Set<string>> = {};
      for (const r of Object.keys(prev)) copy[r] = new Set(prev[r]);
      if (!copy[roleCode]) copy[roleCode] = new Set();
      if (copy[roleCode].has(permCode)) copy[roleCode].delete(permCode);
      else copy[roleCode].add(permCode);
      return copy;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!rolesData) return;
    setSaving(true);
    try {
      await Promise.all(
        rolesData.map((role) =>
          api.put(`/ho/roles/${role.code}/permissions`, {
            permissions: Array.from(matrix[role.code] ?? []),
          }),
        ),
      );
      setToast({ msg: t("saved"), kind: "ok" });
      setDirty(false);
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedSave"), kind: "err" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddRole = async () => {
    const code = newCode.trim().toLowerCase().replace(/\s+/g, "_");
    const label = newLabel.trim();
    if (!code || !label) return;
    setAddLoading(true);
    try {
      await api.post("/ho/roles", { code, label });
      setToast({ msg: t("addRoleSuccess", { label }), kind: "ok" });
      setAddOpen(false);
      setNewCode("");
      setNewLabel("");
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("addRoleFailed"), kind: "err" });
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/ho/roles/${deleteTarget.code}`);
      setToast({ msg: t("deleteRoleSuccess", { label: deleteTarget.label }), kind: "ok" });
      setDeleteTarget(null);
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("deleteRoleFailed"), kind: "err" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const groups = permissions
    ? Array.from(new Set(permissions.map((p) => p.group_name))).sort()
    : [];
  const permsByGroup = (group: string) =>
    permissions?.filter((p) => p.group_name === group) ?? [];

  const roles = rolesData ?? [];
  const isLoading = !permissions || !rolesData;

  return (
    <div className="min-h-full">
      <Topbar title={t("rolesTitle")} subtitle={t("rolesSubtitle")} />

      {toast && <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} />}

      {/* Add Role Modal */}
      <Modal open={addOpen} onClose={() => { setAddOpen(false); setNewCode(""); setNewLabel(""); }} title={t("addRoleTitle")}>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
              {t("addRoleCode")} <span className="text-warning-text">*</span>
            </label>
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder={t("addRoleCodePlaceholder")}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30 font-mono"
            />
            <p className="text-[10px] text-ink-3 mt-1">{t("addRoleCodeHint")}</p>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
              {t("addRoleLabel")} <span className="text-warning-text">*</span>
            </label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={t("addRoleLabelPlaceholder")}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setAddOpen(false); setNewCode(""); setNewLabel(""); }}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold text-ink-2"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleAddRole}
              disabled={!newCode.trim() || !newLabel.trim() || addLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-40"
              style={{ background: "#1B1814" }}
            >
              {addLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {addLoading ? t("adding") : t("add")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("deleteRoleTitle")}
      >
        <div className="p-5 space-y-4">
          <p className="text-sm text-ink-2">
            {t("deleteRoleConfirm", { label: deleteTarget?.label ?? "" })}
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold text-ink-2"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleDeleteRole}
              disabled={deleteLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-bold disabled:opacity-40"
            >
              {deleteLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {deleteLoading ? t("deleting") : t("delete")}
            </button>
          </div>
        </div>
      </Modal>

      <div className="p-6 flex flex-col gap-4">
        {/* JWT warning */}
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-warning/30 bg-[#FEF3C7]">
          <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-ink font-medium">{t("jwtWarning")}</p>
        </div>

        {/* Matrix card */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.8px]">
                {t("rolesSubtitle")}
              </p>
              <h2 className="text-[16px] font-bold text-ink mt-0.5">
                {permissions
                  ? `${permissions.length} permissions × ${roles.length} roles`
                  : "Loading…"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold border border-border text-ink-2 hover:text-ink transition-colors"
              >
                <Plus size={13} />
                {t("newRole")}
              </button>
              <button
                onClick={handleSave}
                disabled={!dirty || saving || isLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-40"
                style={{ background: "#1B1814" }}
              >
                <Save size={14} />
                {saving ? t("saving") : t("save")}
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-surface-alt animate-pulse rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-[12.5px] border-collapse">
                <thead>
                  <tr className="bg-bg">
                    <th className="text-left px-6 py-3 text-[11px] font-semibold text-ink-2 uppercase tracking-[0.6px] w-64 sticky left-0 bg-bg z-10">
                      Permission
                    </th>
                    {roles.map((role) => (
                      <th
                        key={role.code}
                        className="text-center px-3 py-3 text-[11px] font-semibold text-ink-2 uppercase tracking-[0.6px] min-w-[80px]"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span>{role.label}</span>
                          {!role.is_system && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(role)}
                              className="text-ink-3 hover:text-red-500 transition-colors"
                              title={t("deleteRoleHint", { label: role.label })}
                            >
                              <X size={11} />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <React.Fragment key={group}>
                      <tr>
                        <td
                          colSpan={roles.length + 1}
                          className="px-6 py-2 text-[10px] font-bold uppercase tracking-[1.2px] text-ink-3 bg-surface-alt border-t border-border"
                        >
                          {group}
                        </td>
                      </tr>
                      {permsByGroup(group).map((perm) => (
                        <tr
                          key={perm.code}
                          className="border-t border-border/60 hover:bg-surface-alt/30 transition-colors"
                        >
                          <td className="px-6 py-3 sticky left-0 bg-surface hover:bg-surface-alt/30">
                            <div className="font-semibold text-ink">{perm.label}</div>
                            <div className="font-mono text-[10px] text-ink-3 mt-0.5">{perm.code}</div>
                          </td>
                          {roles.map((role) => {
                            const checked = matrix[role.code]?.has(perm.code) ?? false;
                            return (
                              <td key={role.code} className="text-center px-3 py-3">
                                <label className="inline-flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => togglePermission(role.code, perm.code)}
                                    className="sr-only"
                                  />
                                  <span
                                    className="w-5 h-5 rounded flex items-center justify-center transition-colors border"
                                    style={{
                                      background: checked ? "#1B1814" : "transparent",
                                      borderColor: checked ? "#1B1814" : "#D4CCBE",
                                    }}
                                  >
                                    {checked && (
                                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                        <path
                                          d="M1 4L4 7L9 1"
                                          stroke="#fff"
                                          strokeWidth="1.8"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    )}
                                  </span>
                                </label>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
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
