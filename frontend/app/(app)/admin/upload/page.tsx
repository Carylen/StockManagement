"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  RefreshCw,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Topbar } from "@/components/layout/Topbar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toast } from "@/components/ui/Toast";
import type { ValidationResponse, UploadLog } from "@/lib/types";
import { useTranslations } from "next-intl";

type Step = "idle" | "validating" | "preview" | "publishing" | "done";

interface LogsResponse {
  items: UploadLog[];
  total: number;
}

export default function AdminUploadPage() {
  const t = useTranslations("upload");
  const router = useRouter();
  const { user } = useAuth();
  const site = user?.site ?? "AGMR";

  const [step, setStep] = useState<Step>("idle");
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: logsData, isLoading: logsLoading, mutate: mutateLogs } = useSWR<LogsResponse>(
    "/upload/logs?limit=1",
    (u: string) => api.get<LogsResponse>(u)
  );
  const lastLog = logsData?.items?.[0] ?? null;

  const handleFile = async (file: File) => {
    setError(null);
    setStep("validating");
    try {
      const res = await api.uploadFile<ValidationResponse>("/upload/validate", file);
      setValidation(res);
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
    if (!validation) return;
    setStep("publishing");
    try {
      const result = await api.post<{ status: string; rows_processed: number; log_id: string }>(
        "/upload/publish",
        { session_id: validation.session_id }
      );
      setToast({
        msg: `${t("successTitle")} · ${result.rows_processed} rows (${result.status})`,
        kind: "ok",
      });
      setStep("done");
      mutateLogs();
      setTimeout(() => router.push("/admin/log"), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to publish");
      setStep("preview");
    }
  };

  const reset = () => {
    setStep("idle");
    setValidation(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const estimasiCount = validation?.preview?.filter((r) => r.estimated_qty > 0).length ?? 0;

  return (
    <div className="min-h-full">
      <Toast message={toast?.msg ?? null} kind={toast?.kind} onDismiss={() => setToast(null)} />
      <Topbar title={t("title")} subtitle={`Admin ${site} · Upload`} />

      <div className="p-6 pb-20 flex flex-col gap-5">

        {/* Info banner */}
        <div className="bg-kpp-soft rounded-2xl px-5 py-4 flex gap-4 items-center">
          <div className="w-10 h-10 rounded-xl bg-kpp flex items-center justify-center text-white font-bold text-base flex-shrink-0">
            i
          </div>
          <p className="text-sm text-ink leading-relaxed flex-1">
            <strong className="text-kpp-deep font-bold">{t("infoBold")}</strong>{" "}
            {t("infoDesc")}{" "}
            {t("acceptedFormat")}{" "}
            <code className="font-mono text-[11px] bg-surface px-1.5 py-0.5 rounded border border-border">
              {t("infoColumns")}
            </code>
          </p>
          <Link
            href="/admin/log"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface text-xs font-semibold text-ink-2 hover:bg-surface-alt transition-colors flex-shrink-0"
          >
            <ClipboardList size={13} />
            {t("viewLog")}
          </Link>
        </div>

        {/* Upload dropzone */}
        {(step === "idle" || step === "validating") && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`bg-surface rounded-2xl border-[1.5px] border-dashed px-8 py-7 relative overflow-hidden transition-colors ${
              dragging ? "border-kpp bg-kpp-soft/40" : "border-kpp"
            }`}
          >
            {/* Background glow */}
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-kpp-soft/60 blur-3xl pointer-events-none" />

            <div className="flex items-center gap-8 relative flex-wrap">
              {/* Icon */}
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-kpp to-kpp-deep flex items-center justify-center text-white flex-shrink-0 shadow-lg">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M12 3v13" /><path d="m6 9 6-6 6 6" /><path d="M5 21h14" />
                </svg>
              </div>

              {/* Description + action */}
              <div className="flex-1 min-w-[260px]">
                <p className="text-xl font-bold text-ink tracking-tight">
                  {step === "validating" ? t("validating") : t("dropZoneTitle", { site })}
                </p>
                <p className="text-sm text-ink-2 mt-1.5">
                  {t("dropZoneFormat", { site })}
                </p>
                {step === "idle" && (
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
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

              {/* Last sync panel */}
              <div className="border-l border-border pl-8 shrink-0">
                <p className="text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-1.5">
                  {t("lastSync", { site })}
                </p>
                {logsLoading ? (
                  <div className="space-y-1.5">
                    <div className="h-4 w-28 bg-surface-alt animate-pulse rounded" />
                    <div className="h-3 w-36 bg-surface-alt animate-pulse rounded" />
                  </div>
                ) : lastLog ? (
                  <>
                    <p className="text-base font-bold text-ink leading-snug">
                      {format(parseISO(lastLog.created_at), "d MMM yyyy")}
                      <br />
                      <span className="text-sm font-semibold">{format(parseISO(lastLog.created_at), "HH:mm")} WIB</span>
                    </p>
                    <p className="font-mono text-[11px] text-ink-2 mt-2 max-w-[180px] truncate">
                      {lastLog.filename}
                    </p>
                    <div className="flex gap-3 mt-2 text-[11px] font-bold">
                      <span className="text-aman">✓ {lastLog.rows_processed} valid</span>
                      <span className="text-ink-3">{lastLog.rows_error} error</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-ink-3">{t("noLastUpload")}</p>
                )}
              </div>
            </div>

            <input
              ref={fileInputRef}
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
              <button onClick={reset} className="text-xs underline text-warning mt-1">
                {t("tryAgain")}
              </button>
            </div>
          </div>
        )}

        {/* Preview + Publish */}
        {(step === "preview" || step === "publishing") && validation && (
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            {/* Card header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-bold text-ink-2 uppercase tracking-widest">
                  Preview Validasi · Sudah Disepakati UT
                </p>
                <p className="text-lg font-bold text-ink mt-0.5">{validation.filename}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={reset}
                  className="px-4 py-2.5 rounded-xl border border-border text-ink text-sm font-semibold hover:bg-surface-alt transition-colors flex items-center gap-1.5"
                >
                  <X size={14} />
                  {t("changeFile")}
                </button>
                {validation.rows_valid > 0 && (
                  <button
                    onClick={handlePublish}
                    disabled={step === "publishing"}
                    className="px-5 py-2.5 rounded-xl bg-aman text-white text-sm font-bold hover:bg-aman/90 transition-colors disabled:opacity-60 flex items-center gap-2"
                  >
                    {step === "publishing" ? (
                      <><RefreshCw size={14} className="animate-spin" /> {t("publishing")}</>
                    ) : (
                      <><CheckCircle size={14} /> {t("publishRows", { count: validation.rows_valid })}</>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* 4-column stat row */}
            <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
              {[
                { value: validation.rows_valid,   label: t("validRows"),       color: "text-aman" },
                { value: validation.rows_skipped, label: t("skipped"),         color: "text-over" },
                { value: validation.rows_error,   label: t("errors"),          color: "text-ink-3" },
                { value: estimasiCount,            label: t("estimasiFilled"),  color: "text-[#5B5BD6]" },
              ].map((s, i) => (
                <div key={i} className="px-6 py-5">
                  <div className="flex items-baseline gap-2">
                    <p className={`text-[38px] font-bold leading-none tracking-tight font-mono tnum ${s.color}`}>
                      {s.value}
                    </p>
                    <span className="text-[11px] text-ink-2 font-semibold">rows</span>
                  </div>
                  <p className="text-xs text-ink-2 font-semibold mt-1.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Row errors detail */}
            {validation.error_detail && validation.error_detail.length > 0 && (
              <div className="px-6 py-4 bg-warning-bg border-b border-warning/10">
                <p className="text-xs font-bold text-warning mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> {t("rowErrors")}
                </p>
                {validation.error_detail.slice(0, 5).map((err, i) => (
                  <div key={i} className="text-xs text-ink-2 flex gap-2 py-1 border-t border-warning/10">
                    <span className="font-mono font-bold text-warning w-16 flex-shrink-0">Row {err.row}</span>
                    <span>{err.reason}</span>
                  </div>
                ))}
                {validation.error_detail.length > 5 && (
                  <p className="text-xs text-ink-3 font-semibold pt-1 border-t border-warning/10">
                    +{validation.error_detail.length - 5} more
                  </p>
                )}
              </div>
            )}

            {/* Preview table */}
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
                  {validation.preview.map((row, i) => (
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
                      <td className="px-4 py-3 text-right font-mono font-bold text-ink tnum">
                        {row.rtt_qty + row.tbd_qty}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tnum">
                        <span className={row.estimated_qty > 0 ? "text-[#5B5BD6] font-semibold" : "text-ink-3"}>
                          {row.estimated_qty > 0 ? `+${row.estimated_qty}` : "—"}
                        </span>
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
        {step === "done" && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-aman-bg rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-aman" />
            </div>
            <p className="text-lg font-bold text-ink">{t("successTitle")}</p>
            <p className="text-sm text-ink-3 mt-1">{t("redirecting")}</p>
          </div>
        )}

      </div>
    </div>
  );
}
