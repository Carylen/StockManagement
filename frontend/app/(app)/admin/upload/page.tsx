"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertTriangle, XCircle, Upload, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toast } from "@/components/ui/Toast";
import type { ValidationResponse } from "@/lib/types";

type Step = "idle" | "validating" | "preview" | "publishing" | "done";

export default function AdminUploadPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setStep("validating");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.uploadFile<ValidationResponse>("/upload/validate", file);
      setValidation(res);
      setStep("preview");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to validate file");
      setStep("idle");
    }
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
        msg: `Success! ${result.rows_processed} rows processed (${result.status})`,
        kind: "ok",
      });
      setStep("done");
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
  };

  return (
    <div className="min-h-full">
      <Toast message={toast?.msg ?? null} kind={toast?.kind} onDismiss={() => setToast(null)} />
      <Topbar title="Upload Stock Data" subtitle="Admin · CSV / XLSX from UT" />

      <div className="p-4 md:p-6 max-w-3xl space-y-5">
        {/* Info banner */}
        <div className="bg-[#FFF1D0] border border-primary/30 rounded-lg p-4">
          <p className="text-sm font-semibold text-ink mb-1">Accepted file format:</p>
          <p className="text-xs text-ink-2">
            CSV/XLSX from United Tractors with columns: <code className="font-mono bg-white px-1 rounded">PROD, COMM, NEW PN, DESCRIPTION, AGMR MIN, AGMR MAX, RTT, TBD</code>
          </p>
        </div>

        {/* Step 1: Upload */}
        {(step === "idle" || step === "validating") && (
          <FileDropzone onFile={handleFile} loading={step === "validating"} />
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-warning-bg rounded-lg border border-warning/20">
            <AlertTriangle size={16} className="text-warning-text flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning-text">Error:</p>
              <p className="text-xs text-warning-text mt-0.5">{error}</p>
              <button onClick={reset} className="text-xs underline text-warning-text mt-1">
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && validation && (
          <div className="space-y-4 animate-fade-in">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-aman-bg rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-aman font-mono">{validation.rows_valid}</p>
                <p className="text-xs font-semibold text-aman-text mt-0.5">Valid Rows</p>
              </div>
              <div className="bg-[#FEF3C7] rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-over font-mono">{validation.rows_skipped}</p>
                <p className="text-xs font-semibold text-over-text mt-0.5">Skipped</p>
              </div>
              <div className="bg-warning-bg rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-warning font-mono">{validation.rows_error}</p>
                <p className="text-xs font-semibold text-warning-text mt-0.5">Errors</p>
              </div>
            </div>

            {/* Errors */}
            {validation.error_detail && validation.error_detail.length > 0 && (
              <div className="bg-warning-bg rounded-lg p-3 border border-warning/20">
                <p className="text-xs font-bold text-warning-text mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> Row Errors:
                </p>
                {validation.error_detail.slice(0, 5).map((err, i) => (
                  <div key={i} className="text-xs text-ink-2 flex gap-2 py-1 border-t border-warning/10">
                    <span className="font-mono font-bold text-warning-text w-14 flex-shrink-0">Row {err.row}</span>
                    <span>{err.reason}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Preview table */}
            <div className="bg-surface rounded-lg border border-[rgba(27,24,20,0.08)] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(27,24,20,0.06)]">
                <Eye size={14} className="text-ink-3" />
                <span className="text-sm font-bold text-ink">Preview (first 20 rows)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#F5EFE1]">
                    <tr>
                      {["Part Number", "MIN", "MAX", "RTT", "TBD", "Status"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-ink-2 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validation.preview.map((row, i) => (
                      <tr key={i} className="border-t border-[rgba(27,24,20,0.04)] hover:bg-[#FBF7EE]">
                        <td className="px-3 py-2 font-mono font-bold">{row.part_number}</td>
                        <td className="px-3 py-2 font-mono">{row.min_qty}</td>
                        <td className="px-3 py-2 font-mono">{row.max_qty}</td>
                        <td className="px-3 py-2 font-mono font-bold">{row.rtt_qty}</td>
                        <td className="px-3 py-2 font-mono">{row.tbd_qty}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={row.status} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="px-5 py-3 bg-[#F5EFE1] text-ink font-semibold text-sm rounded-lg hover:bg-[#EDE3D0] transition-colors"
              >
                Change File
              </button>
              {validation.rows_valid > 0 && (
                <button
                  onClick={handlePublish}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-ink text-white font-bold text-sm rounded-lg hover:bg-ink/80 transition-colors"
                >
                  <Upload size={16} />
                  Publish {validation.rows_valid} Rows to Database
                </button>
              )}
            </div>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="text-center py-12 animate-fade-in">
            <div className="w-16 h-16 bg-aman-bg rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-aman" />
            </div>
            <p className="text-lg font-bold text-ink">Upload Successful!</p>
            <p className="text-sm text-ink-3 mt-1">Redirecting to upload log...</p>
          </div>
        )}
      </div>
    </div>
  );
}
