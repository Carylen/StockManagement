"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { Upload, CalendarClock, RefreshCw, Save } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Toast } from "@/components/ui/Toast";
import { SkeletonTable } from "@/components/ui/Skeleton";
import type { PlanPeriod, PaginatedPlanLines, PlanUploadResult } from "@/lib/types";

export default function ScheduledPlanInquiryPage() {
  const t = useTranslations("scheduledPlan");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [aplFilter, setAplFilter] = useState<string>("");
  const [reqDrafts, setReqDrafts] = useState<Record<string, string>>({});
  const [savingReq, setSavingReq] = useState<string | null>(null);

  const { data: periods, isLoading: loadingPeriods, mutate: mutatePeriods } =
    useSWR<PlanPeriod[]>("/scheduled-plans/periods", (u: string) => api.get<PlanPeriod[]>(u));

  const activePeriod = selected ?? periods?.[0]?.period_id ?? null;
  const activeMeta = (periods ?? []).find((p) => p.period_id === activePeriod) ?? null;
  const locked = activeMeta?.state === "LOCKED";

  const { data: lines, isLoading: loadingLines, mutate: mutateLines } = useSWR<PaginatedPlanLines>(
    activePeriod ? `/scheduled-plans/periods/${activePeriod}/lines?limit=500` : null,
    (u: string) => api.get<PaginatedPlanLines>(u)
  );

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const l of lines?.items ?? []) init[l.id] = l.req_date ?? "";
    setReqDrafts(init);
  }, [lines]);

  const saveReqDate = async (id: string) => {
    setSavingReq(id);
    try {
      await api.patch(`/scheduled-plans/lines/${id}`, { req_date: reqDrafts[id] || null });
      setToast({ msg: t("reqSaved"), kind: "ok" });
      mutateLines();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("reqFailed"), kind: "err" });
    } finally {
      setSavingReq(null);
    }
  };

  const aplOptions = useMemo(
    () => Array.from(new Set((lines?.items ?? []).map((l) => l.apl_activity))).sort(),
    [lines]
  );
  const shownLines = useMemo(
    () => (lines?.items ?? []).filter((l) => !aplFilter || l.apl_activity === aplFilter),
    [lines, aplFilter]
  );

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const r = await api.uploadFile<PlanUploadResult>("/scheduled-plans/upload", file);
      const lockedNote = r.skipped_periods.length
        ? " " + t("uploadSkipped", {
            activities: r.skipped_periods.map((s) => s.activity).join(", "),
          })
        : "";
      setToast({
        msg: t("uploadSuccess", {
          inserted: r.rows_inserted, updated: r.rows_updated,
          merged: r.rows_merged, skipped: r.rows_skipped,
        }) + lockedNote,
        kind: r.periods.length === 0 ? "err" : "ok",
      });
      if (r.periods.length) setSelected(r.periods[0].period_id);
      mutatePeriods();
      mutateLines();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("uploadFailed"), kind: "err" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="min-h-full">
      <Toast message={toast?.msg ?? null} kind={toast?.kind} onDismiss={() => setToast(null)} />
      <Topbar title={t("title")} subtitle={t("subtitle")} />

      <div className="p-6 pb-20 flex flex-col gap-5">
        {/* Upload zone */}
        <div className="bg-surface rounded-2xl border-[1.5px] border-dashed border-kpp px-7 py-6 flex items-center gap-6 flex-wrap">
          <div className="w-[60px] h-[60px] rounded-[14px] bg-kpp-soft text-kpp-deep flex items-center justify-center flex-shrink-0">
            <CalendarClock size={28} />
          </div>
          <div className="flex-1 min-w-[280px]">
            <p className="text-[17px] font-bold text-ink tracking-tight">{t("uploadTitle")}</p>
            <p className="text-[12px] text-ink-2 mt-1 leading-relaxed">{t("uploadHint")}</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-5 py-2.5 bg-kpp text-white text-sm font-bold rounded-xl hover:brightness-110 transition-all disabled:opacity-60"
          >
            <Upload size={15} /> {uploading ? t("uploading") : t("chooseFile")}
          </button>
        </div>

        {/* Periods */}
        <div className="flex flex-wrap gap-3">
          {loadingPeriods ? (
            <span className="text-sm text-ink-3">…</span>
          ) : (periods ?? []).length === 0 ? (
            <p className="text-sm text-ink-3">{t("noPeriods")}</p>
          ) : (
            (periods ?? []).map((p) => {
              const isActive = p.period_id === activePeriod;
              return (
                <button
                  key={p.period_id}
                  onClick={() => { setSelected(p.period_id); setAplFilter(""); }}
                  className={`text-left px-4 py-3 rounded-xl border transition-colors min-w-[200px] ${
                    isActive ? "bg-kpp-soft border-kpp" : "bg-surface border-border hover:bg-surface-alt"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-ink">{p.activity} · {p.site}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      p.state === "OPEN" ? "bg-aman-bg text-aman" : "bg-surface-alt text-ink-3"
                    }`}>
                      {p.state === "OPEN" ? t("stateOpen") : t("stateLocked")}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-3 mt-1">{p.start_date} → {p.due_date}</div>
                  <div className="text-[11px] mt-1">
                    <span className="font-bold text-kpp-deep font-mono">{p.readiness_pct}%</span>
                    <span className="text-ink-3"> · {p.total_lines} {t("linesWord")}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Lines */}
        {activePeriod && (
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-3 border-b border-border flex-wrap">
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setAplFilter("")}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                    aplFilter === "" ? "bg-ink text-white" : "bg-bg text-ink-2 border border-border hover:bg-surface-alt"
                  }`}
                >
                  {t("filterAllApl")}
                </button>
                {aplOptions.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAplFilter(a)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                      aplFilter === a ? "bg-ink text-white" : "bg-bg text-ink-2 border border-border hover:bg-surface-alt"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <button onClick={() => mutateLines()} className="ml-auto p-1.5 text-ink-3 hover:text-ink" title="Refresh">
                <RefreshCw size={13} />
              </button>
            </div>

            {loadingLines ? (
              <SkeletonTable rows={6} />
            ) : shownLines.length === 0 ? (
              <div className="py-16 text-center text-sm text-ink-3">{t("noLines")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-bg text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                      <th className="text-left px-4 py-2.5">{t("colApl")}</th>
                      <th className="text-left px-4 py-2.5">{t("colUnit")}</th>
                      <th className="text-left px-4 py-2.5">{t("colNpn")}</th>
                      <th className="text-left px-4 py-2.5">{t("colDesc")}</th>
                      <th className="text-right px-4 py-2.5">{t("colQty")}</th>
                      <th className="text-left px-4 py-2.5">{t("colStatus")}</th>
                      <th className="text-left px-4 py-2.5">{t("colLocation")}</th>
                      <th className="text-left px-4 py-2.5">{t("colReqDate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownLines.map((l) => (
                      <tr key={l.id} className="border-t border-border hover:bg-surface-alt/50">
                        <td className="px-4 py-2.5 text-[11px] text-ink-2">{l.apl_activity}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-ink">{l.egi} · {l.cn}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-[12px] text-ink">{l.npn}</td>
                        <td className="px-4 py-2.5 text-ink-2 text-[12px]">{l.description ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{l.req_qty}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            l.is_ready ? "bg-aman-bg text-aman" : "bg-warning-bg text-warning"
                          }`}>
                            {l.is_ready ? t("statusReady") : t("statusNotReady")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-ink-2">{l.ut_location ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="date"
                              disabled={locked}
                              value={reqDrafts[l.id] ?? ""}
                              onChange={(e) => setReqDrafts((d) => ({ ...d, [l.id]: e.target.value }))}
                              className="px-2 py-1 border border-border rounded-lg text-[12px] bg-bg disabled:opacity-60"
                            />
                            {!locked && (reqDrafts[l.id] ?? "") !== (l.req_date ?? "") && (
                              <button
                                onClick={() => saveReqDate(l.id)}
                                disabled={savingReq === l.id}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-kpp text-white text-[11px] font-bold rounded-lg hover:brightness-110 disabled:opacity-50"
                                title={t("save")}
                              >
                                <Save size={12} />
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
        )}
      </div>
    </div>
  );
}
