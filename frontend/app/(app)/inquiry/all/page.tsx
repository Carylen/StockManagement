"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { format, parseISO } from "date-fns";
import { Download, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { InquiryDetail } from "@/components/inquiry/InquiryDetail";
import { InquiryBadge } from "@/components/ui/InquiryBadge";
import { FilterChips } from "@/components/ui/FilterChips";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/DataTable";
import type { PaginatedInquiries, InquiryListItem, InquiryDetail as InquiryDetailType } from "@/lib/types";

const SITE_COLORS: Record<string, { bg: string; text: string }> = {
  AGMR: { bg: "#DCEEE3", text: "#1F6F4C" },
  RANT: { bg: "#E6E6F9", text: "#5B5BD6" },
  SPUT: { bg: "#FFE5DC", text: "#FF7A59" },
};

function SitePill({ site }: { site: string }) {
  const c = SITE_COLORS[site] ?? { bg: "#F3F4F6", text: "#4B5563" };
  return (
    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.text }}>
      {site}
    </span>
  );
}

const STATUS_CHIPS = [
  { value: "",        label: "Semua"   },
  { value: "pending", label: "Pending" },
  { value: "done",    label: "Done"    },
];

export default function SemuaInquiryPage() {
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const limit = 15;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1280);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);

  const { data, isLoading, mutate } = useSWR<PaginatedInquiries>(
    `/inquiries?${params}`,
    (u: string) => api.get<PaginatedInquiries>(u)
  );

  const { data: detail } = useSWR<InquiryDetailType>(
    selectedId ? `/inquiries/${selectedId}` : null,
    (u: string) => api.get<InquiryDetailType>(u)
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
      <Topbar title="Class G Inquiry" subtitle={`${data?.total ?? 0} total`} />

      {/* Mobile-only detail modal — desktop uses side panel */}
      <Modal
        open={isMobile && !!selectedId && !!detail}
        onClose={() => setSelectedId(null)}
        title="Detail Inquiry"
        width={560}
      >
        {detail && (
          <div className="p-5">
            <InquiryDetail inquiry={detail} />
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
          {/* Table list */}
          <div className="xl:col-span-2">
            <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-bg text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                      <th className="text-left px-5 py-3">Mekanik</th>
                      <th className="text-left px-4 py-3">Site</th>
                      <th className="text-right px-4 py-3">Total PN</th>
                      <th className="text-right px-4 py-3">Total Qty</th>
                      <th className="text-left px-4 py-3">Tanggal</th>
                      <th className="text-right px-5 py-3">Status Item</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      [...Array(6)].map((_, i) => (
                        <tr key={i} className="border-t border-[rgba(27,24,20,0.06)]">
                          <td colSpan={6} className="px-5 py-3">
                            <Skeleton className="h-5 w-full rounded" />
                          </td>
                        </tr>
                      ))
                    ) : data && data.items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-14 text-center text-ink-3 text-sm">
                          Tidak ada inquiry
                        </td>
                      </tr>
                    ) : (
                      data?.items.map((inq: InquiryListItem) => (
                        <tr
                          key={inq.id}
                          onClick={() => setSelectedId(inq.id)}
                          className={`border-t border-[rgba(27,24,20,0.06)] cursor-pointer transition-colors ${
                            selectedId === inq.id
                              ? "bg-[#F0F7F3]"
                              : "hover:bg-[#F6F3EE]"
                          }`}
                        >
                          <td className="px-5 py-3">
                            <div className="font-semibold text-ink text-[12.5px]">
                              {inq.submitted_by_name ?? "—"}
                            </div>
                            {inq.submitted_by_nrp && (
                              <div className="text-[10px] font-mono text-ink-3">{inq.submitted_by_nrp}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <SitePill site={inq.site} />
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-ink">
                            {inq.total_unique_parts}
                            <span className="text-ink-3 font-normal text-[10px] ml-0.5">PN</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-ink">
                            {inq.total_qty}
                            <span className="text-ink-3 font-normal text-[10px] ml-0.5">pcs</span>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-ink-3">
                            {inq.created_at ? format(parseISO(inq.created_at), "d MMM yy · HH:mm") : "—"}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <InquiryBadge status={inq.status} size="sm" />
                              {inq.total_valid_items > 0 && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ background: "#DCFCE7", color: "#15803D" }}>
                                  {inq.total_valid_items}V
                                </span>
                              )}
                              {inq.total_invalid_items > 0 && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ background: "#FEE2E2", color: "#B91C1C" }}>
                                  {inq.total_invalid_items}I
                                </span>
                              )}
                              {inq.total_pending_items > 0 && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ background: "#FEF3C7", color: "#B45309" }}>
                                  {inq.total_pending_items}P
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {data && data.pages > 1 && (
                <div className="border-t border-[rgba(27,24,20,0.06)]">
                  <Pagination page={page} pages={data.pages} total={data.total} limit={limit} onPage={setPage} />
                </div>
              )}
            </div>
          </div>

          {/* Side panel — desktop only, no modal on xl+ */}
          <div className="hidden xl:block">
            {detail ? (
              <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] p-4 sticky top-6">
                <InquiryDetail inquiry={detail} />
              </div>
            ) : (
              <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] p-4 flex flex-col items-center justify-center h-48 text-center">
                <p className="text-sm text-ink-3">Klik baris inquiry untuk lihat detail</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
