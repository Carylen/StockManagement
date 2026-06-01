"use client";

import { useState } from "react";
import useSWR from "swr";
import { format, parseISO, subDays } from "date-fns";
import { Download, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { InquiryBadge } from "@/components/ui/InquiryBadge";
import { InquiryDetail } from "@/components/inquiry/InquiryDetail";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import type { PaginatedInquiries, InquiryListItem, InquiryDetail as InquiryDetailType, Site } from "@/lib/types";

const SITE_COLORS: Record<string, { bg: string; text: string }> = {
  AGMR: { bg: "#DCEEE3", text: "#1F6F4C" },
  RANT: { bg: "#E6E6F9", text: "#5B5BD6" },
  SPUT: { bg: "#FFE5DC", text: "#FF7A59" },
};

function SiteBadge({ site }: { site: string }) {
  const c = SITE_COLORS[site] ?? { bg: "#F3F4F6", text: "#4B5563" };
  return (
    <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full"
      style={{ background: c.bg, color: c.text }}>
      {site}
    </span>
  );
}

/** Small chips showing item-level breakdown for a done inquiry */
function ItemCountChips({ inq }: { inq: InquiryListItem }) {
  return (
    <div className="flex items-center gap-1">
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
    </div>
  );
}

export default function SupplierHistoryPage() {
  const [siteFilter, setSiteFilter] = useState("ALL");
  const [fromDate, setFromDate]     = useState(() => format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [toDate, setToDate]         = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [page, setPage]             = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: sites = [] } = useSWR<Site[]>(
    "/sites", (u: string) => api.get<Site[]>(u), { revalidateOnFocus: false }
  );

  const limit = 30;
  const params = new URLSearchParams({ status: "done", page: String(page), limit: String(limit) });
  if (siteFilter !== "ALL") params.set("site", siteFilter);
  if (fromDate) params.set("from_date", fromDate);
  if (toDate)   params.set("to_date", toDate);

  const { data, isLoading, mutate } = useSWR<PaginatedInquiries>(
    `/inquiries?${params}`,
    (u: string) => api.get<PaginatedInquiries>(u),
    { refreshInterval: 60000 }
  );

  const { data: detail } = useSWR<InquiryDetailType>(
    selectedId ? `/inquiries/${selectedId}` : null,
    (u: string) => api.get<InquiryDetailType>(u)
  );

  const items: InquiryListItem[] = data?.items ?? [];
  const totalDone     = data?.total ?? 0;
  const pageValidN    = items.reduce((s, i) => s + i.total_valid_items, 0);
  const pageInvalidN  = items.reduce((s, i) => s + i.total_invalid_items, 0);
  const pageTotal     = pageValidN + pageInvalidN;
  const rateValid     = pageTotal > 0
    ? `${Math.round((pageValidN / pageTotal) * 100)}%`
    : "—";

  const handleExport = async () => {
    const p = new URLSearchParams();
    if (siteFilter !== "ALL") p.set("site", siteFilter);
    if (fromDate) p.set("from_date", fromDate);
    if (toDate)   p.set("to_date", toDate);
    try {
      const blob = await api.download(`/export/inquiries?${p}`);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `inquiry-history-${Date.now()}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div className="min-h-full">
      {/* Detail modal */}
      <Modal open={!!selectedId && !!detail} onClose={() => setSelectedId(null)} title="Detail Respond" width={560}>
        {detail && (
          <div className="p-5">
            <InquiryDetail inquiry={detail} />
          </div>
        )}
      </Modal>

      <Topbar title="Riwayat Respond" subtitle="UT — semua inquiry yang sudah selesai direspond" />

      <div className="p-4 lg:p-6 pb-10 space-y-4 max-w-[1200px]">

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Done",    value: totalDone,  color: "#16110D" },
            { label: "Item Valid",    value: pageValidN,   color: "#15803D" },
            { label: "Item Invalid",  value: pageInvalidN, color: "#B91C1C" },
            { label: "Rate Valid",    value: rateValid,    color: "#B07410" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-3 mb-2">{label}</div>
              <div className="text-[28px] font-bold font-mono tabular-nums leading-none" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] p-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-3">Site</label>
            <div className="flex gap-1.5 flex-wrap">
              {["ALL", ...sites.map((s) => s.code)].map((s) => {
                const on = siteFilter === s;
                return (
                  <button key={s} onClick={() => { setSiteFilter(s); setPage(1); }}
                    className="px-3 py-1.5 rounded-full text-[11.5px] font-bold transition-all"
                    style={{
                      background: on ? "#16110D" : "#F6F3EE", color: on ? "#fff" : "#6B6256",
                      border: on ? "none" : "1px solid rgba(27,24,20,0.08)",
                      fontFamily: s !== "ALL" ? "var(--font-mono, monospace)" : "inherit",
                    }}>
                    {s === "ALL" ? "Semua" : s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-3">Dari</label>
            <input type="date" value={fromDate}
              onChange={e => { setFromDate(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-lg border border-[rgba(27,24,20,0.12)] bg-bg text-[12px] text-ink outline-none" />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-3">Sampai</label>
            <input type="date" value={toDate}
              onChange={e => { setToDate(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-lg border border-[rgba(27,24,20,0.12)] bg-bg text-[12px] text-ink outline-none" />
          </div>

          <div className="flex gap-2 ml-auto">
            <button onClick={() => mutate()}
              className="p-2 rounded-lg border border-[rgba(27,24,20,0.1)] bg-bg text-ink-3 hover:text-ink transition-colors">
              <RefreshCw size={13} />
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-bold transition-colors"
              style={{ background: "#E8A323", color: "#16110D" }}>
              <Download size={13} /> Export Excel
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] overflow-hidden">
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="bg-bg text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                  <th className="text-left px-5 py-3">Site</th>
                  <th className="text-left px-4 py-3">Tgl Submit</th>
                  <th className="text-left px-4 py-3">Mekanik</th>
                  <th className="text-right px-4 py-3">Total Qty</th>
                  <th className="text-left px-4 py-3">Tgl Respond</th>
                  <th className="text-right px-5 py-3">Item Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-t border-[rgba(27,24,20,0.06)]">
                      <td colSpan={6} className="px-5 py-3"><Skeleton className="h-5 w-full rounded" /></td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center text-ink-3 text-sm">
                      Tidak ada riwayat respond.
                    </td>
                  </tr>
                ) : (
                  items.map((inq) => (
                    <tr key={inq.id}
                      onClick={() => setSelectedId(inq.id)}
                      className="border-t border-[rgba(27,24,20,0.06)] hover:bg-[#F6F3EE] cursor-pointer transition-colors">
                      <td className="px-5 py-3"><SiteBadge site={inq.site} /></td>
                      <td className="px-4 py-3 text-ink-2 text-[12px]">
                        {inq.created_at ? format(parseISO(inq.created_at), "d MMM yy") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink text-[12.5px]">{inq.submitted_by_name ?? "—"}</div>
                        {inq.submitted_by_nrp && (
                          <div className="text-[10px] font-mono text-ink-3">{inq.submitted_by_nrp}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-ink tabular-nums">
                        {inq.total_qty}<span className="text-ink-3 font-normal text-[10px] ml-1">pcs</span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-ink-3">
                        {inq.responded_at ? format(parseISO(inq.responded_at), "d MMM yy · HH:mm") : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <InquiryBadge status={inq.status} size="sm" />
                          <ItemCountChips inq={inq} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-[rgba(27,24,20,0.06)]">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="py-14 text-center text-ink-3 text-sm">Tidak ada riwayat respond.</div>
            ) : (
              items.map((inq) => (
                <button key={inq.id} onClick={() => setSelectedId(inq.id)}
                  className="w-full text-left p-4">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2">
                      <SiteBadge site={inq.site} />
                      <InquiryBadge status={inq.status} size="sm" />
                      <ItemCountChips inq={inq} />
                    </div>
                    <span className="text-[11px] text-ink-3 flex-shrink-0">
                      {inq.created_at ? format(parseISO(inq.created_at), "d MMM yy") : "—"}
                    </span>
                  </div>
                  <div className="font-bold text-ink text-sm">{inq.submitted_by_name ?? "—"}</div>
                  <div className="flex gap-4 text-xs text-ink-2 mt-1">
                    <span className="font-mono font-bold tabular-nums text-ink">{inq.total_qty} pcs</span>
                    {inq.responded_at && (
                      <span>Respond: {format(parseISO(inq.responded_at), "d MMM yy")}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {!isLoading && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[rgba(27,24,20,0.06)] bg-bg">
              <span className="text-[12px] text-ink-3">{totalDone} total done</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface disabled:opacity-40">Prev</button>
                <button onClick={() => setPage(p => p + 1)} disabled={items.length < limit}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
