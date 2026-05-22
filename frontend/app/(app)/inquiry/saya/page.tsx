"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { InquiryCard } from "@/components/inquiry/InquiryCard";
import { FilterChips } from "@/components/ui/FilterChips";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { InquiryDetail } from "@/components/inquiry/InquiryDetail";
import type { PaginatedInquiries, Inquiry } from "@/lib/types";

const STATUS_CHIPS = [
  { value: "", label: "Semua" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "available", label: "Tersedia" },
  { value: "unavailable", label: "Tidak Ada" },
  { value: "partial", label: "Partial" },
  { value: "rejected", label: "Ditolak" },
];

export default function InquirySayaPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const limit = 10;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);

  const { data, isLoading, mutate } = useSWR<PaginatedInquiries>(
    `/inquiries/me?${params}`,
    (u: string) => api.get<PaginatedInquiries>(u)
  );

  return (
    <div className="min-h-full">
      <Topbar title="Inquiry Saya" subtitle="Kelas G · Riwayat Pengajuan" />

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detail Inquiry">
        {selected && (
          <div className="p-5">
            <InquiryDetail inquiry={selected} />
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
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-ink-3 text-sm mb-3">Belum ada inquiry yang diajukan</p>
            <Link
              href="/inquiry/baru"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-ink font-bold text-sm rounded-lg"
            >
              <Plus size={14} /> Ajukan Sekarang
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {data?.items.map((inq) => (
                <InquiryCard
                  key={inq.id}
                  inquiry={inq}
                  onClick={() => setSelected(inq)}
                />
              ))}
            </div>
            {data && data.pages > 1 && (
              <Pagination
                page={page}
                pages={data.pages}
                total={data.total}
                limit={limit}
                onPage={setPage}
              />
            )}
          </>
        )}

        {/* FAB */}
        <div className="fixed bottom-24 right-4 md:bottom-8 md:right-6">
          <Link
            href="/inquiry/baru"
            className="flex items-center gap-2 px-4 py-3 bg-ink text-white rounded-full shadow-xl font-bold text-sm hover:bg-ink/80 transition-all"
          >
            <Plus size={16} /> Baru
          </Link>
        </div>
      </div>
    </div>
  );
}
