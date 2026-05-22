"use client";

import useSWR from "swr";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { RefreshCw, Upload, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { SkeletonTable } from "@/components/ui/Skeleton";

interface UploadLogItem {
  id: string;
  filename: string;
  uploader_name: string | null;
  rows_total: number;
  rows_processed: number;
  rows_skipped: number;
  rows_error: number;
  status: "success" | "partial" | "failed";
  created_at: string;
}

interface LogsResponse {
  items: UploadLogItem[];
  total: number;
  page: number;
  pages: number;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle size={14} className="text-aman" />;
  if (status === "partial") return <AlertTriangle size={14} className="text-over" />;
  return <XCircle size={14} className="text-warning" />;
}

export default function AdminLogPage() {
  const { data, isLoading, mutate } = useSWR<LogsResponse>(
    "/upload/logs",
    (u: string) => api.get<LogsResponse>(u)
  );

  return (
    <div className="min-h-full">
      <Topbar title="Log Upload" subtitle="Admin · Riwayat upload file CSV/XLSX" />

      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-2">
            <span className="font-bold text-ink">{data?.total ?? "—"}</span> log upload
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/upload"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-ink text-white text-xs font-semibold rounded-lg hover:bg-ink/80 transition-colors"
            >
              <Upload size={12} /> Upload Baru
            </Link>
            <button onClick={() => mutate()} className="p-1.5 text-ink-3 hover:text-ink transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-[rgba(27,24,20,0.08)] overflow-hidden">
          {isLoading ? (
            <SkeletonTable rows={8} />
          ) : !data || data.items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-ink-3 text-sm">Belum ada log upload</p>
              <Link href="/admin/upload" className="text-xs text-primary hover:underline mt-2 inline-block">
                Upload sekarang →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F5EFE1]">
                  <tr>
                    {["Waktu", "File", "Uploader", "Total", "Proses", "Skip", "Error", "Status"].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-ink-2 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((log) => (
                    <tr key={log.id} className="border-t border-[rgba(27,24,20,0.05)] hover:bg-[#FBF7EE] transition-colors">
                      <td className="px-3 py-3 text-xs text-ink-2 whitespace-nowrap">
                        {log.created_at ? format(parseISO(log.created_at), "d MMM yyyy HH:mm", { locale: id }) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs font-semibold text-ink truncate max-w-[200px] block" title={log.filename}>
                          {log.filename}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-2">{log.uploader_name || "—"}</td>
                      <td className="px-3 py-3 text-xs font-mono font-bold text-center">{log.rows_total}</td>
                      <td className="px-3 py-3 text-xs font-mono text-aman-text font-bold text-center">{log.rows_processed}</td>
                      <td className="px-3 py-3 text-xs font-mono text-over-text text-center">{log.rows_skipped}</td>
                      <td className="px-3 py-3 text-xs font-mono text-warning-text text-center">{log.rows_error}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon status={log.status} />
                          <span
                            className="text-xs font-semibold capitalize"
                            style={{
                              color: log.status === "success" ? "#15803D" : log.status === "partial" ? "#B45309" : "#B91C1C",
                            }}
                          >
                            {log.status}
                          </span>
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
