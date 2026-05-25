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
import { useTranslations } from "next-intl";

export default function InquirySayaPage() {
  const t = useTranslations("myInquiry");
  const ti = useTranslations("inquiry");
  const tis = useTranslations("inquiryStatus");

  const STATUS_CHIPS = [
    { value: "", label: ti("allLabel") },
    { value: "draft", label: tis("draft") },
    { value: "pending", label: tis("pending") },
    { value: "available", label: tis("available") },
    { value: "unavailable", label: tis("unavailable") },
    { value: "partial", label: tis("partial") },
    { value: "rejected", label: tis("rejected") },
  ];
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
      <Topbar title={t("title")} subtitle={t("subtitle")} />

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
            <p className="text-ink-3 text-sm mb-3">{t("noInquiries")}</p>
            <Link
              href="/inquiry/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-ink font-bold text-sm rounded-lg"
            >
              <Plus size={14} /> {t("submitNow")}
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
            href="/inquiry/new"
            className="flex items-center gap-2 px-4 py-3 bg-ink text-white rounded-full shadow-xl font-bold text-sm hover:bg-ink/80 transition-all"
          >
            <Plus size={16} /> {t("fab")}
          </Link>
        </div>
      </div>
    </div>
  );
}
