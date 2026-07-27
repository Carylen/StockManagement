"use client";

import { Fragment, useRef, useState } from "react";
import useSWR from "swr";
import { format, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import {
  AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Download, RefreshCw, Upload, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { downloadTemplate } from "@/lib/downloadTemplate";
import { useAuth } from "@/lib/auth";
import { Topbar } from "@/components/layout/Topbar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toast } from "@/components/ui/Toast";
import type { AdminStockValidateResponse, AdminStockPublishResult, UploadLogsResponse } from "@/lib/types";

type Step = "idle" | "validating" | "preview" | "publishing" | "done";

export default function AdminUploadPage() {
  const t = useTranslations("upload");
  const { user } = useAuth();
  const site = user?.site ?? "";

  const [step, setStep] = useState<Step>("idle");
  const [preview, setPreview] = useState<AdminStockValidateResponse | null>(null);
  const [result, setResult] = useState<AdminStockPublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const { data: logsData, isLoading: logsLoading, mutate: mutateLogs } = useSWR<UploadLogsResponse>(
    "/upload/logs?limit=10",
    (u: string) => api.get<UploadLogsResponse>(u)
  );

  const handleFile = async (file: File) => {
    setError(null);
    setCurrentFile(file);
    setStep("validating");
    try {
      const res = await api.uploadFile<AdminStockValidateResponse>("/upload/admin-stock/validate", file);
      setPreview(res);
      setStep("preview");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to validate file");
      setStep("idle");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handlePublish = async () => {
    if (!currentFile) return;
    setStep("publishing");
    try {
      const res = await api.uploadFile<AdminStockPublishResult>("/upload/admin-stock/publish", currentFile);
      setResult(res);
      setStep("done");
      setToast({ msg: t("publishRows", { count: res.rows_processed }), kind: "ok" });
      mutateLogs();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to publish");
      setStep("preview");
    }
  };

  const reset = () => {
    setStep("idle");
    setPreview(null);
    setResult(null);
    setError(null);
    setCurrentFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="min-h-full">
      <Toast message={toast?.msg ?? null} kind={toast?.kind} onDismiss={() => setToast(null)} />
      <Topbar title={t("title")} subtitle={t("subtitle")} />

      <div className="p-6 pb-24 flex flex-col gap-5">

        {/* Info banner */}
        <div className="bg-kpp-soft rounded-2xl px-5 py-4 flex gap-4 items-center flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-kpp flex items-center justify-center text-white font-bold text-base flex-shrink-0">
            i
          </div>
          <p className="text-sm text-ink leading-relaxed flex-1 min-w-[240px]">
            <strong className="text-kpp-deep font-bold">{t("infoBold")}</strong>{" "}
            {t("infoDesc")}{" "}
            {t("acceptedFormat")}{" "}
            <code className="font-mono text-[11px] bg-surface px-1.5 py-0.5 rounded border border-border">
              {t("infoColumns")}
            </code>
          </p>
          <button
            type="button"
            onClick={() => downloadTemplate("readiness").catch(() => setToast({ msg: t("downloadError"), kind: "err" }))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface text-xs font-semibold text-ink-2 hover:bg-surface-alt transition-colors flex-shrink-0"
          >
            <Download size={13} />
            {t("downloadTemplate")}
          </button>
        </div>

        {/* Dropzone */}
        {(step === "idle" || step === "validating") && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`bg-surface rounded-2xl border-[1.5px] border-dashed px-8 py-7 transition-colors ${
              dragging ? "border-kpp bg-kpp-soft/40" : "border-kpp"
            }`}
          >
            <div className="flex items-center gap-8 flex-wrap">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-kpp to-kpp-deep flex items-center justify-center text-white flex-shrink-0 shadow-lg">
                <Upload size={32} />
              </div>
              <div className="flex-1 min-w-[260px]">
                <p className="text-xl font-bold text-ink tracking-tight">
                  {step === "validating" ? t("validating") : t("dropZoneTitle", { site })}
                </p>
                <p className="text-sm text-ink-2 mt-1.5">
                  {t("dropZoneFormat", { site })}
                </p>
                {step === "idle" && (
                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="px-5 py-2.5 bg-ink text-white text-sm font-bold rounded-xl hover:bg-ink/80 transition-colors"
                    >
                      {t("chooseFile")}
                    </button>
                    <span className="text-xs text-ink-3">{t("dropOrClick")}</span>
                  </div>
                )}
                {step === "validating" && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-ink-2">
                    <RefreshCw size={14} className="animate-spin text-kpp" />
                    {t("validatingDesc")}
                  </div>
                )}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-warning-bg rounded-xl border border-warning/20">
            <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-warning">{t("errorLabel")} {error}</p>
              <button onClick={reset} className="text-xs underline text-warning mt-1">{t("tryAgain")}</button>
            </div>
          </div>
        )}

        {/* Preview + Publish */}
        {(step === "preview" || step === "publishing") && preview && (
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-bold text-ink-2 uppercase tracking-widest">{t("previewRows")}</p>
                <p className="text-lg font-bold text-ink mt-0.5">{preview.filename}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={reset}
                  className="px-4 py-2.5 rounded-xl border border-border text-ink text-sm font-semibold hover:bg-surface-alt transition-colors flex items-center gap-1.5"
                >
                  <X size={14} />
                  {t("changeFile")}
                </button>
                {preview.accepted_rows > 0 && (
                  <button
                    onClick={handlePublish}
                    disabled={step === "publishing"}
                    className="px-5 py-2.5 rounded-xl bg-aman text-white text-sm font-bold hover:bg-aman/90 transition-colors disabled:opacity-60 flex items-center gap-2"
                  >
                    {step === "publishing"
                      ? <><RefreshCw size={14} className="animate-spin" /> {t("publishing")}</>
                      : <><CheckCircle size={14} /> {t("publishRows", { count: preview.accepted_rows })}</>}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
              <div className="px-6 py-5">
                <p className="text-[38px] font-bold leading-none tracking-tight font-mono tnum text-aman">{preview.accepted_rows}</p>
                <p className="text-xs text-ink-2 font-semibold mt-1.5">{t("validRows")}</p>
              </div>
              <div className="px-6 py-5">
                <p className="text-[38px] font-bold leading-none tracking-tight font-mono tnum text-warning">{preview.rejected_rows}</p>
                <p className="text-xs text-ink-2 font-semibold mt-1.5">{t("rejectedRows")}</p>
              </div>
              <div className="px-6 py-5">
                <p className="text-[38px] font-bold leading-none tracking-tight font-mono tnum text-ink">{preview.total_rows}</p>
                <p className="text-xs text-ink-2 font-semibold mt-1.5">Total</p>
              </div>
            </div>

            {preview.rejected_detail.length > 0 && (
              <div className="px-6 py-4 bg-warning-bg border-b border-warning/10">
                <p className="text-xs font-bold text-warning mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> {t("rejectedRows")}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px] border-collapse">
                    <thead>
                      <tr className="text-ink-2 text-[10px] uppercase tracking-wide font-semibold">
                        <th className="text-left pr-4 py-1">{t("colRow")}</th>
                        <th className="text-left pr-4 py-1">Part Number</th>
                        <th className="text-left py-1">{t("rejectedReason")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rejected_detail.map((r, i) => (
                        <tr key={i} className="border-t border-warning/10">
                          <td className="pr-4 py-1 font-mono text-ink-2">{r.row}</td>
                          <td className="pr-4 py-1 font-mono font-bold text-ink">{r.part_number ?? "—"}</td>
                          <td className="py-1 text-ink-2">{r.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="bg-bg text-ink-2 text-[11px] uppercase tracking-wide font-semibold">
                    <th className="text-left px-6 py-3">Part Number</th>
                    <th className="text-left px-4 py-3">Description</th>
                    <th className="text-right px-4 py-3">MIN</th>
                    <th className="text-right px-4 py-3">MAX</th>
                    <th className="text-right px-4 py-3">RTT</th>
                    <th className="text-right px-4 py-3">TBD</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-right px-4 py-3">Estimasi</th>
                    <th className="text-right px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row, i) => (
                    <tr key={i} className="border-t border-border/60 hover:bg-surface-alt/40">
                      <td className="px-6 py-3 font-mono font-bold text-ink whitespace-nowrap">
                        {row.part_number}
                      </td>
                      <td className="px-4 py-3 text-ink font-medium max-w-[220px] truncate">
                        {row.description ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-ink-2 tnum">{row.min_qty}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-2 tnum">{row.max_qty}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-ink tnum">{row.rtt_qty}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-2 tnum">{row.tbd_qty}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-ink tnum">{row.total_qty}</td>
                      <td className="px-4 py-3 text-right font-mono tnum text-[11px]">
                        {row.estimated_date
                          ? <span className="text-[#5B5BD6] font-semibold">{format(new Date(row.estimated_date), "d MMM yy")}</span>
                          : <span className="text-ink-3">—</span>}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <StatusBadge status={row.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Done */}
        {step === "done" && result && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-aman-bg rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-aman" />
            </div>
            <p className="text-lg font-bold text-ink">{t("successTitle")}</p>
            <button onClick={reset} className="mt-4 px-5 py-2.5 bg-ink text-white text-sm font-bold rounded-xl hover:opacity-80 transition-opacity">
              {t("chooseFile")}
            </button>
          </div>
        )}

        {/* Upload History */}
        <div>
          <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-widest mb-3">{t("viewLog")}</h2>
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            {logsLoading ? (
              <div className="px-6 py-10 text-center text-sm text-ink-3 flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin" /> {t("validating")}
              </div>
            ) : !logsData || logsData.items.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-ink-3">{t("noLastUpload")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-bg text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                      <th className="text-left px-5 py-3">Tanggal</th>
                      <th className="text-left px-4 py-3">File</th>
                      <th className="text-right px-4 py-3">{t("validRows")}</th>
                      <th className="text-right px-4 py-3">{t("rejectedRows")}</th>
                      <th className="text-left px-4 py-3">Uploaded by</th>
                      <th className="text-left px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsData.items.map((log) => {
                      const rejected = log.error_detail?.rejected ?? [];
                      const expanded = expandedLog === log.id;
                      return (
                        <Fragment key={log.id}>
                          <tr className="border-t border-border/60 hover:bg-surface-alt/40">
                            <td className="px-5 py-3 font-mono text-[12px] text-ink-2 whitespace-nowrap">
                              {format(parseISO(log.created_at), "d MMM yyyy · HH:mm")}
                            </td>
                            <td className="px-4 py-3 text-ink max-w-[200px] truncate font-medium">
                              {log.filename}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-aman tabular-nums">
                              {log.rows_processed}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-warning tabular-nums">
                              {log.rows_skipped}
                            </td>
                            <td className="px-4 py-3 text-ink-2 text-[12px]">
                              {log.uploader_name ?? "—"}
                            </td>
                            <td className="px-5 py-3 text-right">
                              {rejected.length > 0 && (
                                <button
                                  onClick={() => setExpandedLog(expanded ? null : log.id)}
                                  className="text-xs text-ink-2 hover:text-ink flex items-center gap-1 ml-auto"
                                >
                                  {t("rejectedReason")}
                                  {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                              )}
                            </td>
                          </tr>
                          {expanded && rejected.length > 0 && (
                            <tr className="bg-warning-bg/40">
                              <td colSpan={6} className="px-5 py-3">
                                <ul className="text-xs text-ink-2 space-y-1">
                                  {rejected.map((r, i) => (
                                    <li key={i} className="font-mono">
                                      Row {r.row} · {r.part_number ?? "—"} — {r.reason}
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
