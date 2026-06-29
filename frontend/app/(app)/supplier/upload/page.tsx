"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import { format, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import {
  AlertTriangle, CheckCircle, RefreshCw, Upload, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Toast } from "@/components/ui/Toast";
import type { UTValidateResponse, UTPublishResult, UTUploadLogsResponse } from "@/lib/types";

type Step = "idle" | "validating" | "preview" | "publishing" | "done";

const SITE_COLORS: Record<string, string> = {
  AGMR: "#1F6F4C",
  RANT: "#5B5BD6",
  SPUT: "#FF7A59",
};

function SiteBadge({ code }: { code: string }) {
  const color = SITE_COLORS[code] ?? "#6B6256";
  return (
    <span
      className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full"
      style={{ background: `${color}18`, color }}
    >
      {code}
    </span>
  );
}

export default function SupplierUploadPage() {
  const t = useTranslations("utUpload");
  const [step, setStep] = useState<Step>("idle");
  const [preview, setPreview] = useState<UTValidateResponse | null>(null);
  const [result, setResult] = useState<UTPublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const { data: logsData, isLoading: logsLoading, mutate: mutateLogs } = useSWR<UTUploadLogsResponse>(
    "/upload/ut-stock/logs?limit=10",
    (u: string) => api.get<UTUploadLogsResponse>(u)
  );

  const handleFile = async (file: File) => {
    setError(null);
    setCurrentFile(file);
    setStep("validating");
    try {
      const res = await api.uploadFile<UTValidateResponse>("/upload/ut-stock/validate", file);
      setPreview(res);
      setStep("preview");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("failedValidate"));
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
      const res = await api.uploadFile<UTPublishResult>("/upload/ut-stock/publish", currentFile);
      setResult(res);
      setStep("done");
      setToast({ msg: t("uploadSuccessToast", { rows: res.matched_rows, sites: res.sites_affected.join(", ") }), kind: "ok" });
      mutateLogs();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("failedPublish"));
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
        <div className="bg-[#FFF8EC] rounded-2xl px-5 py-4 flex gap-4 items-start">
          <div className="w-9 h-9 rounded-xl bg-[#E8A323] flex items-center justify-center text-ink font-bold text-base flex-shrink-0">
            i
          </div>
          <div className="flex-1 text-sm text-ink leading-relaxed">
            <strong className="text-[#B07410] font-bold">{t("infoBold")}</strong>{" "}
            {t("infoColsRead")} <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-[rgba(27,24,20,0.1)]">Material</code>{" "}
            <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-[rgba(27,24,20,0.1)]">Plnt</code>{" "}
            <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-[rgba(27,24,20,0.1)]">Avail Stock</code>.{" "}
            {t("infoIgnore")}
            {" "}Accepted: <strong>.xlsx, .xls, .csv</strong> · Max 20MB.
          </div>
        </div>

        {/* Step 1 & 2 — File picker */}
        {(step === "idle" || step === "validating") && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`bg-surface rounded-2xl border-[1.5px] border-dashed px-8 py-8 transition-colors ${
              dragging ? "border-[#E8A323] bg-[#FFF8EC]/40" : "border-[#E8A323]/60"
            }`}
          >
            <div className="flex items-center gap-8 flex-wrap">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#E8A323] to-[#B07410] flex items-center justify-center text-ink flex-shrink-0 shadow-lg">
                <Upload size={32} />
              </div>
              <div className="flex-1 min-w-[240px]">
                <p className="text-xl font-bold text-ink tracking-tight">
                  {step === "validating" ? t("validating") : t("dropTitle")}
                </p>
                <p className="text-sm text-ink-2 mt-1">
                  {t("dropHint")}
                </p>
                {step === "idle" && (
                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="px-5 py-2.5 bg-[#16110D] text-white text-sm font-bold rounded-xl hover:bg-[#16110D]/80 transition-colors"
                    >
                      {t("chooseFile")}
                    </button>
                    <span className="text-xs text-ink-3">{t("orDrop")}</span>
                  </div>
                )}
                {step === "validating" && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-ink-2">
                    <RefreshCw size={14} className="animate-spin text-[#E8A323]" />
                    {t("reading")}
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
              <p className="text-sm font-bold text-warning">{error}</p>
              <button onClick={reset} className="text-xs underline text-warning mt-1">{t("tryAgain")}</button>
            </div>
          </div>
        )}

        {/* Step 2 — Preview */}
        {(step === "preview" || step === "publishing") && preview && (
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-bold text-ink-2 uppercase tracking-widest">{t("validationResult")}</p>
                <p className="text-base font-bold text-ink mt-0.5">{preview.filename}</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {preview.sites_affected.map((s) => <SiteBadge key={s} code={s} />)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={reset}
                  className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-ink hover:bg-surface-alt transition-colors flex items-center gap-1.5"
                >
                  <X size={13} /> {t("changeFile")}
                </button>
                {preview.matched_rows > 0 && (
                  <button
                    onClick={handlePublish}
                    disabled={step === "publishing"}
                    className="px-5 py-2 rounded-xl bg-[#16A34A] text-white text-sm font-bold hover:bg-[#16A34A]/90 transition-colors disabled:opacity-60 flex items-center gap-2"
                  >
                    {step === "publishing"
                      ? <><RefreshCw size={13} className="animate-spin" /> {t("publishing")}</>
                      : <><CheckCircle size={13} /> {t("publishRows", { rows: preview.matched_rows })}</>}
                  </button>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
              {[
                { value: preview.matched_rows,  label: t("statMatched"), color: "text-[#16A34A]" },
                { value: preview.skipped_rows,  label: t("statSkipped"), color: "text-warning" },
                { value: preview.total_rows,    label: t("statTotal"),   color: "text-ink" },
              ].map((s, i) => (
                <div key={i} className="px-6 py-4">
                  <p className={`text-[36px] font-bold leading-none font-mono tabular-nums ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-ink-2 mt-1.5 font-semibold">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Warnings */}
            {preview.warnings.length > 0 && (
              <div className="px-6 py-3 bg-warning-bg border-b border-warning/10">
                <p className="text-xs font-bold text-warning mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={11} /> Warnings
                </p>
                {preview.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-ink-2 py-0.5">{w}</p>
                ))}
              </div>
            )}

            {/* Preview table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="bg-bg text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                    <th className="text-left px-5 py-3">Part Number</th>
                    <th className="text-left px-4 py-3">{t("colDescription")}</th>
                    <th className="text-center px-4 py-3">Plnt</th>
                    <th className="text-center px-4 py-3">Site</th>
                    <th className="text-right px-5 py-3">Avail Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row, i) => (
                    <tr key={i} className="border-t border-border/60 hover:bg-surface-alt/40">
                      <td className="px-5 py-3 font-mono font-bold text-ink text-[12.5px]">{row.part_number}</td>
                      <td className="px-4 py-3 text-ink max-w-[200px] truncate">{row.description ?? "—"}</td>
                      <td className="px-4 py-3 text-center font-mono text-ink-2 text-[12px]">{row.plnt_code}</td>
                      <td className="px-4 py-3 text-center"><SiteBadge code={row.site_code} /></td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-ink tabular-nums">{row.avail_stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.preview.length === 10 && preview.matched_rows > 10 && (
                <p className="text-center text-[11px] text-ink-3 py-3 border-t border-border">
                  {t("showingMatched", { rows: preview.matched_rows })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Done */}
        {step === "done" && result && (
          <div className="bg-surface rounded-2xl border border-border p-8 text-center">
            <div className="w-14 h-14 bg-[#DCFCE7] rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-[#16A34A]" />
            </div>
            <p className="text-lg font-bold text-ink">{t("uploadSuccess")}</p>
            <p className="text-sm text-ink-3 mt-1 mb-5">
              {t("rowsSavedFor", { rows: result.matched_rows })}{" "}
              {result.sites_affected.map((s) => <SiteBadge key={s} code={s} />)}
            </p>
            <button onClick={reset} className="px-5 py-2.5 bg-[#16110D] text-white text-sm font-bold rounded-xl hover:opacity-80 transition-opacity">
              {t("uploadAnother")}
            </button>
          </div>
        )}

        {/* Upload History */}
        <div>
          <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-widest mb-3">{t("historyTitle")}</h2>
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            {logsLoading ? (
              <div className="px-6 py-10 text-center text-sm text-ink-3 flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin" /> {t("loadingHistory")}
              </div>
            ) : !logsData || logsData.items.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-ink-3">{t("noHistory")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-bg text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                      <th className="text-left px-5 py-3">{t("colDate")}</th>
                      <th className="text-left px-4 py-3">File</th>
                      <th className="text-right px-4 py-3">Matched</th>
                      <th className="text-right px-4 py-3">Skipped</th>
                      <th className="text-left px-4 py-3">Sites</th>
                      <th className="text-left px-5 py-3">Uploaded by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsData.items.map((log) => (
                      <tr key={log.id} className="border-t border-border/60 hover:bg-surface-alt/40">
                        <td className="px-5 py-3 font-mono text-[12px] text-ink-2 whitespace-nowrap">
                          {format(parseISO(log.uploaded_at), "d MMM yyyy · HH:mm")}
                        </td>
                        <td className="px-4 py-3 text-ink max-w-[200px] truncate font-medium">
                          {log.filename ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[#16A34A] tabular-nums">
                          {log.matched_rows}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ink-3 tabular-nums">
                          {log.skipped_rows}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {(log.sites_affected ?? []).map((s) => <SiteBadge key={s} code={s} />)}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-ink-2 text-[12px]">
                          {log.uploader_name ?? "—"}
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
    </div>
  );
}
