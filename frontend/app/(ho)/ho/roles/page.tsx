"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { Save, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Toast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";

interface PermissionRow {
  code: string;
  label: string;
  group_name: string;
  description: string | null;
}

interface RoleRow {
  role: string;
  permissions: string[];
}

const ALL_ROLES = ["user", "group_leader", "admin", "supplier", "super_admin"] as const;
type RoleName = typeof ALL_ROLES[number];

const ROLE_LABELS: Record<RoleName, string> = {
  user:         "User",
  group_leader: "GL",
  admin:        "Admin",
  supplier:     "Supplier",
  super_admin:  "Super",
};

export default function HORolesPage() {
  const t = useTranslations("ho");

  const { data: permissions } = useSWR<PermissionRow[]>(
    "/ho/permissions",
    (u: string) => api.get<PermissionRow[]>(u)
  );
  const { data: rolesData, mutate } = useSWR<RoleRow[]>(
    "/ho/roles",
    (u: string) => api.get<RoleRow[]>(u)
  );

  // Local state: role → Set of permissions (for optimistic editing)
  const [matrix, setMatrix] = useState<Record<string, Set<string>>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  // Sync matrix from server data
  useEffect(() => {
    if (!rolesData) return;
    const next: Record<string, Set<string>> = {};
    for (const row of rolesData) {
      next[row.role] = new Set(row.permissions);
    }
    setMatrix(next);
    setDirty(false);
  }, [rolesData]);

  const togglePermission = (role: string, permCode: string) => {
    setMatrix((prev) => {
      const copy: Record<string, Set<string>> = {};
      for (const r of Object.keys(prev)) {
        copy[r] = new Set(prev[r]);
      }
      if (!copy[role]) copy[role] = new Set();
      if (copy[role].has(permCode)) {
        copy[role].delete(permCode);
      } else {
        copy[role].add(permCode);
      }
      return copy;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        ALL_ROLES.map((role) =>
          api.put(`/ho/roles/${role}/permissions`, {
            permissions: Array.from(matrix[role] ?? []),
          })
        )
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

  // Group permissions by group_name
  const groups = permissions
    ? Array.from(new Set(permissions.map((p) => p.group_name))).sort()
    : [];

  const permsByGroup = (group: string) =>
    permissions?.filter((p) => p.group_name === group) ?? [];

  const isLoading = !permissions || !rolesData;

  return (
    <div className="min-h-full">
      <Topbar title={t("rolesTitle")} subtitle={t("rolesSubtitle")} />

      {toast && (
        <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} />
      )}

      <div className="p-6 flex flex-col gap-4">
        {/* JWT warning banner */}
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
                {permissions ? `${permissions.length} permissions × ${ALL_ROLES.length} roles` : "Loading…"}
              </h2>
            </div>
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

          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-surface-alt animate-pulse rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px] border-collapse">
                <thead>
                  <tr className="bg-bg">
                    <th className="text-left px-6 py-3 text-[11px] font-semibold text-ink-2 uppercase tracking-[0.6px] w-64 sticky left-0 bg-bg z-10">
                      Permission
                    </th>
                    {ALL_ROLES.map((role) => (
                      <th
                        key={role}
                        className="text-center px-4 py-3 text-[11px] font-semibold text-ink-2 uppercase tracking-[0.6px] min-w-[80px]"
                      >
                        {ROLE_LABELS[role]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <React.Fragment key={group}>
                      {/* Group header */}
                      <tr>
                        <td
                          colSpan={ALL_ROLES.length + 1}
                          className="px-6 py-2 text-[10px] font-bold uppercase tracking-[1.2px] text-ink-3 bg-surface-alt border-t border-border"
                        >
                          {group}
                        </td>
                      </tr>
                      {/* Permission rows */}
                      {permsByGroup(group).map((perm) => (
                        <tr
                          key={perm.code}
                          className="border-t border-border/60 hover:bg-surface-alt/30 transition-colors"
                        >
                          <td className="px-6 py-3 sticky left-0 bg-surface hover:bg-surface-alt/30">
                            <div className="font-semibold text-ink">{perm.label}</div>
                            <div className="font-mono text-[10px] text-ink-3 mt-0.5">{perm.code}</div>
                          </td>
                          {ALL_ROLES.map((role) => {
                            const checked = matrix[role]?.has(perm.code) ?? false;
                            return (
                              <td key={role} className="text-center px-4 py-3">
                                <label className="inline-flex items-center justify-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => togglePermission(role, perm.code)}
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
