"use client";

import { useState } from "react";
import useSWR from "swr";
import { Download, RefreshCw, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { InquiryCard } from "@/components/inquiry/InquiryCard";
import { InquiryDetail } from "@/components/inquiry/InquiryDetail";
import { FilterChips } from "@/components/ui/FilterChips";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/DataTable";
import type { PaginatedInquiries, Inquiry } from "@/lib/types";
import { useTranslations } from "next-intl";

export default function SemuaInquiryPage() {
  const t = useTranslations("inquiry");
  const tn = useTranslations("nav");
  const tis = useTranslations("inquiryStatus");

  const STATUS_CHIPS = [
    { value: "", label: t("allLabel") },
    { value: "draft", label: tis("draft") },
    { value: "pending", label: tis("pending") },
    { value: "available", label: tis("available") },
    { value: "unavailable", label: tis("unavailable") },
    { value: "partial", label: tis("partial") },
    { value: "rejected", label: tis("rejected") },
  ];
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const limit = 15;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);

  const { data, isLoading, mutate } = useSWR<PaginatedInquiries>(
    `/inquiries?${params}`,
    (u: string) => api.get<PaginatedInquiries>(u)
  );

  const handleExport = async () => {
    try {
      const blob = await api.download("/export/inquiries");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inquiries.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div className="min-h-full">
      <Topbar title={tn("classGInquiry")} subtitle={`Admin · ${data?.total ?? 0} total`} />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={t("detailTitle")} width={560}>
        {selected && (
          <div className="p-5">
            <InquiryDetail inquiry={selected} />
          </div>
        )}
      </Modal>

      <div className="p-4 md:p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <FilterChips
              chips={STATUS_CHIPS}
              selected={status}
              onSelect={(v) => { setStatus(v); setPage(1); }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 text-xs border border-[rgba(27,24,20,0.12)] rounded-lg bg-surface"
            />
            <span className="text-ink-3 text-xs">–</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 text-xs border border-[rgba(27,24,20,0.12)] rounded-lg bg-surface"
            />
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-[rgba(27,24,20,0.12)] rounded-lg text-xs font-semibold text-ink-2 hover:text-ink transition-colors"
              title="Export XLSX"
            >
              <Download size={13} /> Export
            </button>
            <button onClick={() => mutate()} className="p-1.5 text-ink-3 hover:text-ink transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* List */}
          <div className="xl:col-span-2 space-y-3">
            {isLoading ? (
              [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
            ) : data && data.items.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-ink-3 text-sm">{t("noInquiries")}</p>
              </div>
            ) : (
              data?.items.map((inq) => (
                <InquiryCard
                  key={inq.id}
                  inquiry={inq}
                  onClick={() => setSelected(inq)}
                  showSubmitter
                />
              ))
            )}
            {data && data.pages > 1 && (
              <Pagination page={page} pages={data.pages} total={data.total} limit={limit} onPage={setPage} />
            )}
          </div>

          {/* Side panel detail (desktop) */}
          <div className="hidden xl:block">
            {selected ? (
              <div className="bg-surface rounded-lg border border-[rgba(27,24,20,0.08)] p-4 sticky top-6">
                <InquiryDetail inquiry={selected} />
              </div>
            ) : (
              <div className="bg-surface rounded-lg border border-[rgba(27,24,20,0.08)] p-4 flex flex-col items-center justify-center h-48 text-center">
                <p className="text-sm text-ink-3">{t("selectToView")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
