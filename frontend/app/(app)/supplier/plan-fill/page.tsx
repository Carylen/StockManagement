"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { Save, RefreshCw, Download, Upload, Loader2, FileSpreadsheet } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Toast } from "@/components/ui/Toast";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { PeriodCountdownBanner } from "@/components/plan/PeriodCountdownBanner";
import type { PlanPeriod, PaginatedPlanLines, PlanLine, FillImportResult, CoordinationItem } from "@/lib/types";

const COORD_COLOR: Record<string, string> = {
  READY: "#16A34A",
  NEEDS_PLANNER_REVISION: "#DC2626",
  SUPPLIER_RESPONDED: "#D97706",
  AWAITING_SUPPLIER: "#9CA3AF",
};

interface Draft {
  ut_location: string;
  est_date: string;
}

export default function PlanFillPage() {
  const t = useTranslations("planFill");
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, { location?: boolean; date?: boolean }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filterSite, setFilterSite] = useState<string>("");
  const [filterApl, setFilterApl] = useState<string>("");
  const [filterEgi, setFilterEgi] = useState<string>("");
  const [filterCn, setFilterCn] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: periods, isLoading: loadingPeriods } =
    useSWR<PlanPeriod[]>("/scheduled-plans/periods", (u: string) => api.get<PlanPeriod[]>(u));

  const siteOptions = useMemo(
    () => Array.from(new Set((periods ?? []).map((p) => p.site))).sort(),
    [periods]
  );

  const filteredPeriods = useMemo(
    () => filterSite ? (periods ?? []).filter((p) => p.site === filterSite) : (periods ?? []),
    [periods, filterSite]
  );

  const activePeriod = selected ?? filteredPeriods[0]?.period_id ?? null;
  const activeMeta = (periods ?? []).find((p) => p.period_id === activePeriod) ?? null;

  const { data: lines, isLoading: loadingLines, mutate } = useSWR<PaginatedPlanLines>(
    activePeriod ? `/scheduled-plans/fill?period_id=${activePeriod}` : null,
    (u: string) => api.get<PaginatedPlanLines>(u)
  );

  useEffect(() => {
    const init: Record<string, Draft> = {};
    for (const l of lines?.items ?? []) {
      init[l.id] = {
        ut_location: l.ut_location ?? "",
        est_date: l.est_date ?? l.req_date ?? "",
      };
    }
    setDrafts(init);
  }, [lines]);

  // Reset all filters when period changes.
  useEffect(() => {
    setFilterApl("");
    setFilterEgi("");
    setFilterCn("");
  }, [activePeriod]);

  // Clear period selection when site filter changes so activePeriod auto-picks first of filtered.
  useEffect(() => {
    setSelected(null);
  }, [filterSite]);

  const locked = activeMeta?.state === "LOCKED";

  // ── Collaboration: coordination status per apl_activity (supplier scope) ──
  const { data: coordination, mutate: mutateCoord } = useSWR<CoordinationItem[]>(
    activePeriod ? `/scheduled-plans/periods/${activePeriod}/coordination` : null,
    (u: string) => api.get<CoordinationItem[]>(u)
  );

  // APL options from coordination (all APL activities in the period, not paginated)
  // rather than lines?.items which is limited to 200 rows from the backend.
  const aplOptions = useMemo(
    () => (coordination ?? []).map((c) => c.apl_activity).sort(),
    [coordination]
  );

  const egiOptions = useMemo(
    () => Array.from(new Set((lines?.items ?? []).map((l) => l.egi))).sort(),
    [lines]
  );

  const cnOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (lines?.items ?? [])
            .filter((l) => !filterEgi || l.egi === filterEgi)
            .map((l) => l.cn)
        )
      ).sort(),
    [lines, filterEgi]
  );

  const displayedLines = useMemo(
    () =>
      (lines?.items ?? []).filter(
        (l) =>
          (!filterApl || l.apl_activity === filterApl) &&
          (!filterEgi || l.egi === filterEgi) &&
          (!filterCn || l.cn === filterCn)
      ),
    [lines, filterApl, filterEgi, filterCn]
  );

  const hasFilter = filterApl !== "" || filterEgi !== "" || filterCn !== "";

  // Clicking an apl chip marks that scope seen → clears its unread badge.
  const markSeen = async (apl: string) => {
    if (!activePeriod) return;
    try {
      await api.post(`/scheduled-plans/periods/${activePeriod}/seen`, { apl_activity: apl });
      mutateCoord();
    } catch { /* non-blocking */ }
  };

  const handleDownload = async () => {
    if (!activePeriod) return;
    setDownloading(true);
    try {
      const blob = await api.download(`/scheduled-plans/fill/export?period_id=${activePeriod}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fill_${activeMeta?.name ?? "plan"}_${activeMeta?.site ?? ""}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("downloadFailed"), kind: "err" });
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!activePeriod) return;
    setImporting(true);
    try {
      const res = await api.uploadFile<FillImportResult>(
        `/scheduled-plans/fill/import?period_id=${activePeriod}`,
        file,
      );
      setToast({
        msg: res.days_remaining != null
          ? t("importSuccessWithDays", { updated: res.updated, skipped: res.skipped, days: res.days_remaining })
          : t("importSuccess", { updated: res.updated, skipped: res.skipped }),
        kind: "ok",
      });
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("importFailed"), kind: "err" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await api.download("/scheduled-plans/template?role=supplier");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scheduled_plan_template_supplier.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("downloadFailed"), kind: "err" });
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const setDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
    setFieldErrors((fe) => {
      const cur = fe[id];
      if (!cur) return fe;
      const next = { ...cur };
      if ("ut_location" in patch) delete next.location;
      if ("est_date" in patch) delete next.date;
      return { ...fe, [id]: next };
    });
  };

  const save = async (l: PlanLine) => {
    const d = drafts[l.id];
    if (!d) return;
    const locationMissing = !d.ut_location.trim();
    const dateMissing = !d.est_date;
    if (locationMissing || dateMissing) {
      setFieldErrors((fe) => ({ ...fe, [l.id]: { location: locationMissing, date: dateMissing } }));
      setToast({ msg: t("validationRequired"), kind: "err" });
      return;
    }
    setSavingId(l.id);
    try {
      await api.patch(`/scheduled-plans/lines/${l.id}/fill`, {
        ut_location: d.ut_location || null,
        est_date: d.est_date || null,
      });
      setFieldErrors((fe) => ({ ...fe, [l.id]: {} }));
      setToast({ msg: t("saved"), kind: "ok" });
      mutate();
      mutateCoord();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedSave"), kind: "err" });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-full">
      <Toast message={toast?.msg ?? null} kind={toast?.kind} onDismiss={() => setToast(null)} />
      <Topbar title={t("title")} subtitle={t("subtitle")} />

      <div className="p-6 pb-20 flex flex-col gap-5">
        {/* Site filter — only shown when the supplier serves multiple sites */}
        {!loadingPeriods && siteOptions.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">{t("filterSiteLabel")}</span>
            <button
              onClick={() => setFilterSite("")}
              className={`px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-colors ${
                filterSite === ""
                  ? "bg-[#FFF1D0] border-[#E8A323] text-ink"
                  : "bg-surface border-border text-ink-2 hover:bg-surface-alt"
              }`}
            >
              {t("allSites")}
            </button>
            {siteOptions.map((s) => (
              <button
                key={s}
                onClick={() => setFilterSite(s)}
                className={`px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-colors ${
                  filterSite === s
                    ? "bg-[#FFF1D0] border-[#E8A323] text-ink"
                    : "bg-surface border-border text-ink-2 hover:bg-surface-alt"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Period picker */}
        <div className="flex flex-wrap gap-3">
          {loadingPeriods ? (
            <span className="text-sm text-ink-3">…</span>
          ) : filteredPeriods.length === 0 ? (
            <p className="text-sm text-ink-3">{t("noPeriods")}</p>
          ) : (
            filteredPeriods.map((p) => {
              const isActive = p.period_id === activePeriod;
              return (
                <button
                  key={p.period_id}
                  onClick={() => setSelected(p.period_id)}
                  className={`text-left px-4 py-3 rounded-xl border transition-colors min-w-[200px] ${
                    isActive ? "bg-[#FFF1D0] border-[#E8A323]" : "bg-surface border-border hover:bg-surface-alt"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-ink">{p.name} · {p.site}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      p.state === "OPEN" ? "bg-aman-bg text-aman" : "bg-surface-alt text-ink-3"
                    }`}>
                      {p.state === "OPEN" ? t("stateOpen") : t("stateLocked")}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-3 mt-1">{p.start_date} → {p.due_date}</div>
                </button>
              );
            })
          )}
        </div>

        {/* Site + countdown-to-LOCKED banner (DELTA3 D.4 + explicit site ask) */}
        {activeMeta && <PeriodCountdownBanner period={activeMeta} />}

        {locked && (
          <div className="px-4 py-3 rounded-xl bg-surface-alt text-ink-2 text-sm">{t("lockedNotice")}</div>
        )}

        {/* Coordination summary per apl_activity */}
        {activePeriod && (coordination ?? []).length > 0 && (
          <div className="bg-surface rounded-2xl border border-border px-5 py-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3 mr-1">{t("coordTitle")}</span>
            {(coordination ?? []).map((c) => (
              <button
                key={c.apl_activity}
                onClick={() => markSeen(c.apl_activity)}
                title={t(`coord_${c.coordination_status}`)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-bg border border-border hover:bg-surface-alt transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: COORD_COLOR[c.coordination_status] }} />
                <span className="truncate max-w-[160px]">{c.apl_activity}</span>
                <span className="font-mono text-ink-3">{c.readiness_pct.toFixed(0)}%</span>
                {c.unread_for_me > 0 && (
                  <span className="text-[9px] font-bold leading-none px-1 py-0.5 rounded-full bg-coral text-white">{c.unread_for_me}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* APL Activity / EGI / CN filter row */}
        {activePeriod && (lines?.items ?? []).length > 0 && (
          <div className="bg-surface rounded-2xl border border-border px-5 py-3 flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">{t("filterAplLabel")}</span>
              <select
                value={filterApl}
                onChange={(e) => setFilterApl(e.target.value)}
                className="px-3 py-1.5 text-[12.5px] font-semibold border border-border rounded-lg bg-bg text-ink outline-none focus:ring-2 focus:ring-kpp/30"
              >
                <option value="">{t("allApl")}</option>
                {aplOptions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">EGI</span>
              <select
                value={filterEgi}
                onChange={(e) => { setFilterEgi(e.target.value); setFilterCn(""); }}
                className="px-3 py-1.5 text-[12.5px] font-semibold border border-border rounded-lg bg-bg text-ink outline-none focus:ring-2 focus:ring-kpp/30"
              >
                <option value="">{t("allEgi")}</option>
                {egiOptions.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">CN</span>
              <select
                value={filterCn}
                onChange={(e) => setFilterCn(e.target.value)}
                className="px-3 py-1.5 text-[12.5px] font-semibold border border-border rounded-lg bg-bg text-ink outline-none focus:ring-2 focus:ring-kpp/30"
              >
                <option value="">{t("allCn")}</option>
                {cnOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {hasFilter && (
              <button
                onClick={() => { setFilterApl(""); setFilterEgi(""); setFilterCn(""); }}
                className="ml-auto text-[12px] font-semibold text-ink-3 hover:text-ink transition-colors"
              >
                {t("clearFilters")}
              </button>
            )}
          </div>
        )}

        {/* Lines */}
        {activePeriod && (
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-2.5 bg-[#FFF8E8] text-[#8A6116] text-[11.5px] border-b border-border">
              {t("readyHint")}
            </div>
            <div className="px-5 py-3 flex items-center gap-2 border-b border-border">
              <span className="text-[12px] text-ink-3">
                {displayedLines.length}{displayedLines.length !== (lines?.total ?? 0) && ` / ${lines?.total ?? 0}`} {t("linesWord")}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={downloadTemplate}
                  disabled={downloadingTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] font-semibold text-ink-2 hover:text-ink hover:border-ink-3 transition-colors disabled:opacity-50"
                >
                  {downloadingTemplate ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
                  {t("downloadTemplate")}
                </button>
                <button
                  onClick={handleDownload}
                  disabled={downloading || (lines?.total ?? 0) === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] font-semibold text-ink-2 hover:text-ink hover:border-ink-3 transition-colors disabled:opacity-50"
                >
                  {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {t("downloadExcel")}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing || locked}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E8A323] text-ink text-[12px] font-bold hover:brightness-105 transition-all disabled:opacity-50"
                >
                  {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {t("uploadExcel")}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
                <button onClick={() => mutate()} className="p-1.5 text-ink-3 hover:text-ink" title="Refresh">
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            {loadingLines ? (
              <SkeletonTable rows={6} />
            ) : (lines?.items ?? []).length === 0 ? (
              <div className="py-16 text-center text-sm text-ink-3">{t("noLines")}</div>
            ) : displayedLines.length === 0 ? (
              <div className="py-16 text-center text-sm text-ink-3">{t("noMatch")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-bg text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                      <th className="text-left px-4 py-2.5">{t("colNpn")}</th>
                      <th className="text-left px-4 py-2.5">{t("colDesc")}</th>
                      <th className="text-right px-3 py-2.5">{t("colQty")}</th>
                      <th className="text-left px-3 py-2.5">{t("locationLabel")}</th>
                      <th className="text-left px-3 py-2.5">{t("statusLabel")}</th>
                      <th className="text-left px-3 py-2.5">{t("estDateLabel")}</th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedLines.map((l) => {
                      const d = drafts[l.id] ?? { ut_location: "", est_date: "" };
                      const err = fieldErrors[l.id];
                      return (
                        <tr key={l.id} className="border-t border-border">
                          <td className="px-4 py-2 font-mono font-bold text-[12px] text-ink">{l.npn}</td>
                          <td className="px-4 py-2 text-ink-2 text-[12px]">{l.description ?? "—"}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">{l.req_qty}</td>
                          <td className="px-3 py-2">
                            <input
                              disabled={locked}
                              value={d.ut_location}
                              onChange={(e) => setDraft(l.id, { ut_location: e.target.value.toUpperCase() })}
                              placeholder={t("locationPlaceholder")}
                              className={`px-2 py-1.5 border rounded-lg text-[12px] bg-bg w-[140px] disabled:opacity-60 ${
                                err?.location ? "border-coral" : "border-border"
                              }`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              l.is_ready ? "bg-aman-bg text-aman" : "bg-surface-alt text-ink-3"
                            }`}>
                              {l.is_ready ? t("statusReady") : t("statusNotReady")}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {l.req_date && (
                              <div className="text-[10px] text-ink-3 mb-1">
                                {t("reqDateRef")}: {l.req_date.split("-").reverse().join("/")}
                              </div>
                            )}
                            <input
                              type="date"
                              disabled={locked}
                              value={d.est_date}
                              onChange={(e) => setDraft(l.id, { est_date: e.target.value })}
                              className={`px-2 py-1.5 border rounded-lg text-[12px] bg-bg disabled:opacity-60 ${
                                err?.date ? "border-coral" : "border-border"
                              }`}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => save(l)}
                              disabled={locked || savingId === l.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E8A323] text-ink text-[12px] font-bold rounded-lg hover:brightness-105 transition-all disabled:opacity-50"
                            >
                              <Save size={13} /> {savingId === l.id ? t("saving") : t("save")}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
