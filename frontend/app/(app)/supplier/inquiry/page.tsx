"use client";

import { useState } from "react";
import useSWR from "swr";
import { Send, RefreshCw, CheckCircle, XCircle, SplitSquareVertical } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { InquiryCard } from "@/components/inquiry/InquiryCard";
import { InquiryDetail } from "@/components/inquiry/InquiryDetail";
import { FilterChips } from "@/components/ui/FilterChips";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/DataTable";
import type { PaginatedInquiries, Inquiry } from "@/lib/types";

const STATUS_CHIPS = [
  { value: "", label: "Semua" },
  { value: "pending", label: "Pending" },
  { value: "available", label: "Tersedia" },
  { value: "unavailable", label: "Tidak Ada" },
  { value: "partial", label: "Partial" },
];

const RESPOND_OPTIONS = [
  { value: "available", label: "Tersedia", icon: CheckCircle, color: "#22C55E", bg: "#DCFCE7" },
  { value: "partial", label: "Partial", icon: SplitSquareVertical, color: "#6366F1", bg: "#EDE9FE" },
  { value: "unavailable", label: "Tidak Ada", icon: XCircle, color: "#EF4444", bg: "#FEE2E2" },
];

export default function SupplierInquiryPage() {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [respondStatus, setRespondStatus] = useState("available");
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [loading, setLoading] = useState(false);
  const limit = 10;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);

  const { data, isLoading, mutate } = useSWR<PaginatedInquiries>(
    `/inquiries?${params}`,
    (u: string) => api.get<PaginatedInquiries>(u)
  );

  const handleRespond = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await api.patch(`/inquiries/${selected.id}/respond`, {
        status: respondStatus,
        supplier_notes: notes || null,
      });
      setToast({ msg: `Response terkirim: ${respondStatus}`, kind: "ok" });
      setSelected(null);
      setNotes("");
      setRespondStatus("available");
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Gagal respond", kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full">
      <Toast message={toast?.msg ?? null} kind={toast?.kind} onDismiss={() => setToast(null)} />
      <Topbar title="Inquiry Masuk" subtitle="UT Supplier · Pending dari KPP Mining" />

      <Modal
        open={!!selected}
        onClose={() => { setSelected(null); setNotes(""); setRespondStatus("available"); }}
        title="Respond Inquiry"
        width={560}
      >
        {selected && (
          <div className="p-5 space-y-4">
            <InquiryDetail inquiry={selected} />

            {selected.status === "pending" && (
              <>
                <div className="border-t border-[rgba(27,24,20,0.06)] pt-4">
                  <label className="block text-xs font-semibold text-ink-2 mb-2">Status Ketersediaan</label>
                  <div className="grid grid-cols-3 gap-2">
                    {RESPOND_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setRespondStatus(opt.value)}
                          className="flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-sm font-semibold"
                          style={{
                            borderColor: respondStatus === opt.value ? opt.color : "rgba(27,24,20,0.1)",
                            background: respondStatus === opt.value ? opt.bg : "transparent",
                            color: respondStatus === opt.value ? opt.color : "#6B6256",
                          }}
                        >
                          <Icon size={18} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1.5">Catatan (opsional)</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tambah informasi: ETA, jumlah yang tersedia, alternatif, dll..."
                    className="w-full px-3 py-2.5 border border-[rgba(27,24,20,0.12)] rounded-lg text-sm focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <button
                  onClick={handleRespond}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-ink font-bold text-sm rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-60"
                >
                  <Send size={16} />
                  {loading ? "Mengirim..." : "Kirim Response"}
                </button>
              </>
            )}
          </div>
        )}
      </Modal>

      <div className="p-4 md:p-6 space-y-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <FilterChips
            chips={STATUS_CHIPS}
            selected={status}
            onSelect={(v) => { setStatus(v); setPage(1); }}
          />
          <button onClick={() => mutate()} className="text-ink-3 hover:text-ink p-1.5 transition-colors flex-shrink-0">
            <RefreshCw size={14} />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle size={40} className="mx-auto mb-3 text-aman" />
            <p className="text-ink font-bold">Tidak ada inquiry {status ? `berstatus "${status}"` : ""}</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {data?.items.map((inq) => (
                <InquiryCard
                  key={inq.id}
                  inquiry={inq}
                  onClick={() => { setSelected(inq); setRespondStatus("available"); setNotes(""); }}
                  showSubmitter
                />
              ))}
            </div>
            {data && data.pages > 1 && (
              <Pagination page={page} pages={data.pages} total={data.total} limit={limit} onPage={setPage} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
