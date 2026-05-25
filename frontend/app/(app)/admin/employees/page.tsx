"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { AlertTriangle, MoreHorizontal, RefreshCw, Search, Upload, UserPlus, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Topbar } from "@/components/layout/Topbar";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { SkeletonTable } from "@/components/ui/Skeleton";
import type { Employee, EmployeeRole, PaginatedEmployees, BulkEmployeeResult } from "@/lib/types";

type BulkState = "idle" | "uploading" | "done" | "error";

interface CreateForm {
  nrp: string;
  name: string;
  role: EmployeeRole;
  shift: string;
}

interface EditForm {
  name: string;
  role: EmployeeRole;
  shift: string;
  is_active: boolean;
}

const ROLE_COLOR: Record<EmployeeRole, string> = {
  mechanic: "#FF7A59",
  group_leader: "#5B5BD6",
};
const ROLE_COLOR_BG: Record<EmployeeRole, string> = {
  mechanic: "#FFE5DC",
  group_leader: "#E6E6F9",
};
const ROLE_LABEL: Record<EmployeeRole, string> = {
  mechanic: "Mekanik",
  group_leader: "GL",
};

const SITE_COLORS: Record<string, { bg: string; text: string }> = {
  AGMR: { bg: "#DCEEE3", text: "#1F6F4C" },
  RANT: { bg: "#E6E6F9", text: "#5B5BD6" },
  SPUT: { bg: "#FFE5DC", text: "#FF7A59" },
};

function SiteBadge({ site }: { site: string }) {
  const c = SITE_COLORS[site] ?? { bg: "#EDE9E0", text: "#6B6256" };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide font-mono uppercase"
      style={{ background: c.bg, color: c.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.text }} />
      {site}
    </span>
  );
}

export default function AdminEmployeesPage() {
  const t = useTranslations("employees");
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [bulkState, setBulkState] = useState<BulkState>("idle");
  const [bulkResult, setBulkResult] = useState<BulkEmployeeResult | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data, isLoading, mutate } = useSWR<PaginatedEmployees>(
    "/employees?limit=500",
    (u: string) => api.get<PaginatedEmployees>(u)
  );

  const employees = data?.items ?? [];
  const glCount = employees.filter((e) => e.role === "group_leader").length;
  const mekanikCount = employees.filter((e) => e.role === "mechanic").length;

  const filtered = useMemo(() => {
    let list = employees;
    if (roleFilter !== "all") list = list.filter((e) => e.role === roleFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) => e.nrp.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [employees, roleFilter, search]);

  const createForm = useForm<CreateForm>({ defaultValues: { role: "mechanic", shift: "" } });
  const editForm = useForm<EditForm>();

  const handleCreate = async (data: CreateForm) => {
    setSubmitting(true);
    try {
      await api.post("/employees", { nrp: data.nrp, name: data.name, role: data.role, shift: data.shift || null });
      setToast({ msg: t("created", { name: data.name }), kind: "ok" });
      setShowCreate(false);
      createForm.reset({ role: "mechanic", shift: "" });
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedCreate"), kind: "err" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (data: EditForm) => {
    if (!editing) return;
    setSubmitting(true);
    try {
      await api.patch(`/employees/${editing.id}`, {
        name: data.name,
        role: data.role,
        shift: data.shift || null,
        is_active: data.is_active,
      });
      setToast({ msg: t("updated"), kind: "ok" });
      setEditing(null);
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedUpdate"), kind: "err" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (emp: Employee) => {
    if (!confirm(t("deactivateConfirm", { name: emp.name }))) return;
    setSubmitting(true);
    try {
      await api.delete(`/employees/${emp.id}`);
      setToast({ msg: t("deactivated", { name: emp.name }), kind: "ok" });
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedDeactivate"), kind: "err" });
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    editForm.reset({ name: emp.name, role: emp.role, shift: emp.shift ?? "", is_active: emp.is_active });
  };

  const handleBulkFile = async (file: File) => {
    setBulkState("uploading");
    setBulkError(null);
    setBulkResult(null);
    try {
      const result = await api.uploadFile<BulkEmployeeResult>("/employees/bulk-upload", file);
      setBulkResult(result);
      setBulkState("done");
      setToast({ msg: t("created", { name: `${result.inserted} karyawan baru` }), kind: "ok" });
      mutate();
    } catch (e: unknown) {
      setBulkError(e instanceof Error ? e.message : t("bulkError"));
      setBulkState("error");
    }
  };

  const resetBulk = () => {
    setBulkState("idle");
    setBulkResult(null);
    setBulkError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const site = user?.site ?? "—";

  return (
    <div className="min-h-full">
      <Toast message={toast?.msg ?? null} kind={toast?.kind} onDismiss={() => setToast(null)} />

      <Topbar
        title={t("title")}
        subtitle={`Admin ${site} · ${employees.length} ${t("count")}`}
      />

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t("createTitle")}>
        <form onSubmit={createForm.handleSubmit(handleCreate)} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-[0.6px] mb-1.5">
              {t("nrp")}
            </label>
            <input
              className="w-full px-3 py-3 border border-border rounded-xl text-sm font-mono focus:outline-none focus:border-kpp bg-bg"
              placeholder="KM23119"
              {...createForm.register("nrp", { required: true })}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-[0.6px] mb-1.5">
              {t("fullName")}
            </label>
            <input
              className="w-full px-3 py-3 border border-border rounded-xl text-sm focus:outline-none focus:border-kpp bg-bg"
              placeholder="Cahya Pratama"
              {...createForm.register("name", { required: true })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-[0.6px] mb-1.5">
                {t("role")}
              </label>
              <select
                className="w-full px-3 py-3 border border-border rounded-xl text-sm focus:outline-none focus:border-kpp bg-bg font-semibold"
                {...createForm.register("role", { required: true })}
              >
                <option value="mechanic">{t("roleMechanic")}</option>
                <option value="group_leader">{t("roleGL")}</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-[0.6px] mb-1.5">
                {t("shiftOptional")}
              </label>
              <select
                className="w-full px-3 py-3 border border-border rounded-xl text-sm focus:outline-none focus:border-kpp bg-bg font-semibold"
                {...createForm.register("shift")}
              >
                <option value="">{t("shiftNone")}</option>
                <option value="Pagi">{t("shiftPagi")}</option>
                <option value="Sore">{t("shiftSore")}</option>
                <option value="Malam">{t("shiftMalam")}</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2.5 text-sm font-semibold text-ink rounded-xl hover:bg-surface-alt transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-kpp text-white font-bold text-sm rounded-xl disabled:opacity-60 hover:brightness-110 transition-all"
            >
              <UserPlus size={14} />
              {submitting ? t("creating") : t("createBtn")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={t("editTitle")}>
        {editing && (
          <form onSubmit={editForm.handleSubmit(handleEdit)} className="p-6 space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-[0.6px] mb-1.5">
                {t("nrp")}
              </label>
              <input
                value={editing.nrp}
                disabled
                className="w-full px-3 py-3 border border-border/40 rounded-xl text-sm font-mono bg-surface-alt text-ink-3"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-[0.6px] mb-1.5">
                {t("fullName")}
              </label>
              <input
                className="w-full px-3 py-3 border border-border rounded-xl text-sm focus:outline-none focus:border-kpp bg-bg"
                {...editForm.register("name", { required: true })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-[0.6px] mb-1.5">
                  {t("role")}
                </label>
                <select
                  className="w-full px-3 py-3 border border-border rounded-xl text-sm focus:outline-none focus:border-kpp bg-bg font-semibold"
                  {...editForm.register("role")}
                >
                  <option value="mechanic">{t("roleMechanic")}</option>
                  <option value="group_leader">{t("roleGL")}</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-[0.6px] mb-1.5">
                  {t("shiftLabel")}
                </label>
                <select
                  className="w-full px-3 py-3 border border-border rounded-xl text-sm focus:outline-none focus:border-kpp bg-bg font-semibold"
                  {...editForm.register("shift")}
                >
                  <option value="">{t("shiftNone")}</option>
                  <option value="Pagi">{t("shiftPagi")}</option>
                  <option value="Sore">{t("shiftSore")}</option>
                  <option value="Malam">{t("shiftMalam")}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-[0.6px] mb-1.5">
                {t("activeStatus")}
              </label>
              <select
                className="w-full px-3 py-3 border border-border rounded-xl text-sm focus:outline-none focus:border-kpp bg-bg font-semibold"
                {...editForm.register("is_active", { setValueAs: (v) => v === "true" || v === true })}
              >
                <option value="true">{t("active")}</option>
                <option value="false">{t("inactive")}</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2.5 text-sm font-semibold text-ink rounded-xl hover:bg-surface-alt transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-kpp text-white font-bold text-sm rounded-xl disabled:opacity-60 hover:brightness-110 transition-all"
              >
                {submitting ? t("saving") : t("saveBtn")}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <div className="p-6 pb-20 flex flex-col gap-5">

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-4 gap-3.5">
          {[
            { label: t("title"),          value: employees.length, accent: "var(--c-kpp)",     sub: "GL + Mekanik" },
            { label: "Group Leader",       value: glCount,          accent: "#5B5BD6",           sub: "roster shift" },
            { label: "Mekanik",            value: mekanikCount,     accent: "#FF7A59",           sub: "aktif lapangan" },
            { label: t("lastBulkUpload"), value: "—",              accent: "#E8A323",           sub: `Site ${site}` },
          ].map((c, i) => (
            <div
              key={i}
              className="bg-surface rounded-2xl border border-border relative overflow-hidden px-5 py-4"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: c.accent }} />
              <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.6px] mt-1">{c.label}</p>
              <p className="text-[32px] font-bold tracking-tight leading-none mt-2 font-mono tnum text-ink">
                {c.value}
              </p>
              <p className="text-[11px] text-ink-3 mt-1">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Bulk upload zone ── */}
        <div className="bg-surface rounded-2xl border-[1.5px] border-dashed border-kpp px-7 py-6 flex items-center gap-6 flex-wrap">
          {/* icon — person silhouette, matches prototype */}
          <div className="w-[60px] h-[60px] rounded-[14px] bg-kpp-soft text-kpp-deep flex items-center justify-center flex-shrink-0">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
            </svg>
          </div>

          {/* description */}
          <div className="flex-1 min-w-[280px]">
            <p className="text-[17px] font-bold text-ink tracking-tight">{t("bulkTitle")}</p>
            <p className="text-[12px] text-ink-2 mt-1 leading-relaxed">
              {t("bulkDesc")}{" "}
              <code className="font-mono text-[11px] bg-surface-alt px-1.5 py-0.5 rounded">
                NO, NRP, NAMA, POSISI
              </code>{" "}
              · semua yang di-upload otomatis terikat ke site{" "}
              <strong className="text-kpp-deep">{site}</strong>.
            </p>
          </div>

          {/* actions */}
          <div className="flex gap-2 flex-wrap">
            {bulkState === "uploading" ? (
              <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-2 font-semibold">
                <div className="w-4 h-4 border-2 border-kpp border-t-transparent rounded-full animate-spin" />
                {t("uploading")}
              </div>
            ) : bulkState === "done" && bulkResult ? (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-aman bg-aman-bg px-3 py-1.5 rounded-lg">
                  +{bulkResult.inserted} {t("resultInserted")}
                </span>
                <span className="text-sm font-semibold text-ink-2 bg-surface-alt px-3 py-1.5 rounded-lg">
                  {bulkResult.updated} {t("resultUpdated")}
                </span>
                {bulkResult.skipped > 0 && (
                  <span className="text-sm font-semibold text-over bg-over-bg px-3 py-1.5 rounded-lg">
                    {bulkResult.skipped} skip
                  </span>
                )}
                <button
                  onClick={resetBulk}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-ink-3 hover:text-ink text-sm font-semibold rounded-lg hover:bg-surface-alt transition-colors"
                >
                  <X size={13} /> Reset
                </button>
              </div>
            ) : bulkState === "error" ? (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-warning-bg rounded-lg">
                  <AlertTriangle size={14} className="text-warning" />
                  <span className="text-sm text-warning font-semibold">{bulkError}</span>
                </div>
                <button
                  onClick={resetBulk}
                  className="px-3 py-1.5 text-sm font-semibold text-ink-2 hover:text-ink rounded-lg hover:bg-surface-alt transition-colors"
                >
                  {t("tryAgain")}
                </button>
              </div>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleBulkFile(f);
                    e.target.value = "";
                  }}
                />
                <button className="flex items-center gap-1.5 px-4 py-2.5 bg-surface-alt text-ink text-sm font-semibold rounded-xl hover:bg-surface-alt/80 transition-colors">
                  Download template
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-ink text-white text-sm font-bold rounded-xl hover:bg-ink/80 transition-colors"
                >
                  <Upload size={14} /> Pilih file Excel
                </button>
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-kpp text-white text-sm font-bold rounded-xl hover:brightness-110 transition-all"
                >
                  <UserPlus size={14} /> {t("addEmployee")}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Filter + table ── */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          {/* filter bar */}
          <div className="px-5 py-4 flex items-center gap-3 border-b border-border flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 bg-bg border border-border rounded-xl w-[280px]">
              <Search size={14} className="text-ink-3 flex-shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="bg-transparent border-none outline-none flex-1 text-[12.5px] text-ink"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-ink-3 flex items-center">
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex gap-1.5">
              {([
                ["all", t("allRoles")],
                ["group_leader", t("roleGL")],
                ["mechanic", t("roleMechanic")],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setRoleFilter(k)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                    roleFilter === k
                      ? "bg-ink text-white"
                      : "bg-bg text-ink-2 border border-border hover:bg-surface-alt"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2 text-[12px] text-ink-2">
              <span>
                <strong className="text-ink font-mono">{filtered.length}</strong> dari {employees.length}
              </span>
              <button onClick={() => mutate()} className="p-1.5 text-ink-3 hover:text-ink transition-colors" title="Refresh">
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* table */}
          {isLoading ? (
            <SkeletonTable rows={6} />
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-ink-3">
                {employees.length === 0 ? t("noEmployees") : t("noResults")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-bg text-ink-2 text-[11px] uppercase tracking-[0.6px] font-semibold">
                    <th className="text-left px-6 py-2.5">{t("colNrp")}</th>
                    <th className="text-left px-4 py-2.5">{t("colName")}</th>
                    <th className="text-left px-4 py-2.5">{t("colRole")}</th>
                    <th className="text-left px-4 py-2.5">{t("colShift")}</th>
                    <th className="text-left px-4 py-2.5">Site</th>
                    <th className="text-right px-6 py-2.5">{t("colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => (
                    <tr
                      key={emp.id}
                      className="border-t border-border hover:bg-surface-alt/50 transition-colors"
                    >
                      <td className="px-6 py-3 font-mono font-bold text-[12.5px] text-ink">
                        {emp.nrp}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                            style={{ background: ROLE_COLOR_BG[emp.role], color: ROLE_COLOR[emp.role] }}
                          >
                            {emp.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                          </div>
                          <span className="font-semibold text-ink">{emp.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide"
                          style={{
                            background: ROLE_COLOR_BG[emp.role],
                            color: ROLE_COLOR[emp.role],
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: ROLE_COLOR[emp.role] }} />
                          {ROLE_LABEL[emp.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-ink-2">
                        {emp.shift ?? <span className="text-ink-3">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <SiteBadge site={emp.site} />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="relative inline-block" ref={openMenu === emp.id ? menuRef : undefined}>
                          <button
                            onClick={() => setOpenMenu(openMenu === emp.id ? null : emp.id)}
                            className="p-1.5 text-ink-3 hover:text-ink hover:bg-surface-alt rounded-lg transition-colors"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {openMenu === emp.id && (
                            <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[130px]">
                              <button
                                onClick={() => { openEdit(emp); setOpenMenu(null); }}
                                className="w-full text-left px-4 py-2 text-[12.5px] font-semibold text-ink hover:bg-surface-alt transition-colors"
                              >
                                Edit
                              </button>
                              {emp.is_active && (
                                <button
                                  onClick={() => { handleDeactivate(emp); setOpenMenu(null); }}
                                  className="w-full text-left px-4 py-2 text-[12.5px] font-semibold text-warning hover:bg-warning-bg transition-colors"
                                >
                                  {t("deactivate")}
                                </button>
                              )}
                            </div>
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
