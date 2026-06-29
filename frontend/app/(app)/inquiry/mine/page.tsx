"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { InquiryCard } from "@/components/inquiry/InquiryCard";
import { FilterChips } from "@/components/ui/FilterChips";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { InquiryDetail } from "@/components/inquiry/InquiryDetail";
import type { PaginatedInquiries, InquiryListItem, InquiryDetail as InquiryDetailType } from "@/lib/types";

export default function MyInquiryPage() {
  const t = useTranslations("myInquiry");
  const tInq = useTranslations("inquiry");
  const STATUS_CHIPS = [
    { value: "", label: tInq("allLabel") },
    { value: "pending", label: "Pending" },
    { value: "valid", label: "Valid" },
    { value: "invalid", label: "Invalid" },
  ];
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const limit = 10;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);

  const { data, isLoading, mutate } = useSWR<PaginatedInquiries>(
    `/inquiries/me?${params}`,
    (u: string) => api.get<PaginatedInquiries>(u)
  );

  const { data: detail } = useSWR<InquiryDetailType>(
    selectedId ? `/inquiries/${selectedId}` : null,
    (u: string) => api.get<InquiryDetailType>(u)
  );

  return (
    <div className="min-h-full">
      <Topbar title={t("title")} subtitle={t("subtitle")} />

      <Modal open={!!selectedId && !!detail} onClose={() => setSelectedId(null)} title={tInq("detailTitle")}>
        {detail && (
          <div className="p-5">
            <InquiryDetail inquiry={detail} />
          </div>
        )}
      </Modal>

      <div className="p-4 md:p-6 space-y-4">
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
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-ink-3 text-sm mb-3">{t("noInquiries")}</p>
            <Link
              href="/inquiry/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-ink font-bold text-sm rounded-lg"
            >
              <Plus size={14} /> {tInq("createInquiry")}
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {data?.items.map((inq: InquiryListItem) => (
                <InquiryCard
                  key={inq.id}
                  inquiry={inq}
                  onClick={() => setSelectedId(inq.id)}
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
            <Plus size={16} /> {tInq("createInquiry")}
          </Link>
        </div>
      </div>
    </div>
  );
}
