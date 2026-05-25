"use client";

import { useState } from "react";
import useSWR from "swr";
import { format, parseISO, subDays } from "date-fns";
import { CheckCircle, XCircle, Download, RefreshCw, MapPin, Package } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { InquiryBadge } from "@/components/ui/InquiryBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { PaginatedInquiries, Inquiry } from "@/lib/types";

// ── Helpers ─────────────────────────────────────────────────────
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

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return format(parseISO(iso), "d MMM yyyy · HH:mm");
}

// ── Respond detail card ─────────────────────────────────────────
function RespondDetail({ inq }: { inq: Inquiry }) {
  const isValid = inq.status === "valid";
  return (
    <div
      className="mt-3 rounded-lg px-3 py-2.5 text-xs space-y-1.5"
      style={{
        background: isValid ? "#DCFCE7" : "#FEE2E2",
        color: isValid ? "#15803D" : "#B91C1C",
      }}
    >
      {inq.ut_site_code && (
        <div className="flex items-center gap-1.5">
          <MapPin size={10} />
          <span className="font-semibold uppercase tracking-wide">WH UT:</span>
          <span className="font-mono font-bold">{inq.ut_site_code}</span>
        </div>
      )}
      {inq.replacement_pn && (
        <div className="flex items-center gap-1.5">
          <Package size={10} />
          <span className="font-semibold uppercase tracking-wide">PN Pengganti:</span>
          <span className="font-mono font-bold">{inq.replacement_pn}</span>
        </div>
      )}
      {inq.respond_notes && (
        <p className="italic opacity-90">&ldquo;{inq.respond_notes}&rdquo;</p>
      )}
      {inq.responded_at && (
        <p className="text-[10px] opacity-70 pt-0.5">{fmtDate(inq.responded_at)}</p>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────
export default function SupplierHistoryPage() {
  const [siteFilter, setSiteFilter]     = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"valid" | "invalid" | "">(""); // "" = both
  const [fromDate, setFromDate]         = useState(() => format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [toDate, setToDate]             = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [page, setPage]                 = useState(1);
  const [toast, setToast]               = useState<string | null>(null);

  const limit = 30;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  // Fetch only responded inquiries (valid + invalid)
  if (statusFilter) params.set("status", statusFilter);
  if (siteFilter !== "ALL") params.set("site", siteFilter);
  if (fromDate) params.set("from_date", fromDate);
  if (toDate)   params.set("to_date", toDate);

  // We need to show only responded items; use two SWR calls and merge when no status filter
  const { data: validData, isLoading: loadValid, mutate: mValid } = useSWR<PaginatedInquiries>(
    !statusFilter || statusFilter === "valid"
      ? `/inquiries?${new URLSearchParams({ ...Object.fromEntries(params), status: "valid" })}`
      : null,
    (u: string) => api.get<PaginatedInquiries>(u),
    { refreshInterval: 60000 }
  );
  const { data: invalidData, isLoading: loadInvalid, mutate: mInvalid } = useSWR<PaginatedInquiries>(
    !statusFilter || statusFilter === "invalid"
      ? `/inquiries?${new URLSearchParams({ ...Object.fromEntries(params), status: "invalid" })}`
      : null,
    (u: string) => api.get<PaginatedInquiries>(u),
    { refreshInterval: 60000 }
  );

  const handleRefresh = () => { mValid(); mInvalid(); };

  // Merge + sort by responded_at desc
  let items: Inquiry[] = [];
  if (!statusFilter) {
    items = [
      ...(validData?.items ?? []),
      ...(invalidData?.items ?? []),
    ].sort((a, b) => {
      const ta = a.responded_at ?? a.created_at;
      const tb = b.responded_at ?? b.created_at;
      return tb.localeCompare(ta);
    });
  } else if (statusFilter === "valid") {
    items = validData?.items ?? [];
  } else {
    items = invalidData?.items ?? [];
  }

  const totalValid   = validData?.total ?? 0;
  const totalInvalid = invalidData?.total ?? 0;
  const isLoading    = loadValid || loadInvalid;

  const handleExport = async () => {
    const p = new URLSearchParams();
    if (siteFilter !== "ALL") p.set("site", siteFilter);
    if (fromDate) p.set("from", fromDate);
    if (toDate)   p.set("to", toDate);
    try {
      const blob = await api.download(`/export/inquiries?${p}`);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `inquiry-history-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast("Export gagal.");
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="min-h-full">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl shadow-xl text-sm font-semibold bg-[#FEE2E2] text-[#B91C1C] border border-[#FCA5A5] flex items-center gap-2 animate-fade-in">
          <XCircle size={14} /> {toast}
        </div>
      )}

      <Topbar title="Riwayat Respond" subtitle="UT Rantau · Semua respond yang sudah dikirim" />

      <div className="p-4 lg:p-6 pb-10 space-y-4 max-w-[1200px]">

        {/* ── Summary stats ──────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Respond",  value: totalValid + totalInvalid, color: "#16110D", icon: null          },
            { label: "Valid",          value: totalValid,                 color: "#15803D", icon: CheckCircle   },
            { label: "Invalid",        value: totalInvalid,              color: "#B91C1C", icon: XCircle       },
            { label: "Rate Valid",
              value: (totalValid + totalInvalid) > 0
                ? `${((totalValid / (totalValid + totalInvalid)) * 100).toFixed(0)}%`
                : "—",
              color: "#B07410", icon: null },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-3 mb-2">
                {Icon && <Icon size={10} style={{ color }} />}
                {label}
              </div>
              <div
                className="text-[28px] font-bold font-mono tabular-nums leading-none"
                style={{ color }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters ────────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3 bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] p-4">
          {/* Site */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-3">Site</label>
            <div className="flex gap-1.5">
              {["ALL", "AGMR", "RANT", "SPUT"].map((s) => {
                const on = siteFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => { setSiteFilter(s); setPage(1); }}
                    className="px-3 py-1.5 rounded-full text-[11.5px] font-bold transition-all"
                    style={{
                      background: on ? "#16110D" : "#F6F3EE",
                      color: on ? "#fff" : "#6B6256",
                      border: on ? "none" : "1px solid rgba(27,24,20,0.08)",
                      fontFamily: s !== "ALL" ? "var(--font-mono, monospace)" : "inherit",
                    }}
                  >
                    {s === "ALL" ? "Semua" : s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-3">Status Respond</label>
            <div className="flex gap-1.5">
              {[
                { k: "",        l: "Semua",          dot: null      },
                { k: "valid",   l: "Valid",           dot: "#22C55E" },
                { k: "invalid", l: "Invalid · diganti", dot: "#EF4444" },
              ].map(({ k, l, dot }) => {
                const on = statusFilter === k;
                return (
                  <button
                    key={k}
                    onClick={() => { setStatusFilter(k as "" | "valid" | "invalid"); setPage(1); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-semibold transition-all"
                    style={{
                      background: on ? "#16110D" : "#F6F3EE",
                      color: on ? "#fff" : "#6B6256",
                      border: on ? "none" : "1px solid rgba(27,24,20,0.08)",
                    }}
                  >
                    {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? "#fff" : dot }} />}
                    {l}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date range */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-3">Dari</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-lg border border-[rgba(27,24,20,0.12)] bg-bg text-[12px] text-ink outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-3">Sampai</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-lg border border-[rgba(27,24,20,0.12)] bg-bg text-[12px] text-ink outline-none"
            />
          </div>

          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg border border-[rgba(27,24,20,0.1)] bg-bg text-ink-3 hover:text-ink transition-colors"
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-bold transition-colors"
              style={{ background: "#E8A323", color: "#16110D" }}
            >
              <Download size={13} />
              Export Excel
            </button>
          </div>
        </div>

        {/* ── Table desktop / cards mobile ───────────────── */}
        <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] overflow-hidden">
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="bg-bg text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                  <th className="text-left px-5 py-3">Site</th>
                  <th className="text-left px-4 py-3">Tgl Submit</th>
                  <th className="text-left px-4 py-3">Part</th>
                  <th className="text-right px-4 py-3">Qty</th>
                  <th className="text-left px-4 py-3">Unit Aset</th>
                  <th className="text-left px-4 py-3">Mekanik</th>
                  <th className="text-left px-4 py-3">WH UT</th>
                  <th className="text-left px-4 py-3">PN Pengganti</th>
                  <th className="text-right px-4 py-3">Tgl Respond</th>
                  <th className="text-right px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-t border-[rgba(27,24,20,0.06)]">
                      <td colSpan={10} className="px-5 py-3">
                        <Skeleton className="h-5 w-full rounded" />
                      </td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-14 text-center text-ink-3 text-sm">
                      Tidak ada riwayat respond pada filter ini.
                    </td>
                  </tr>
                ) : (
                  items.map((inq) => (
                    <tr
                      key={inq.id}
                      className="border-t border-[rgba(27,24,20,0.06)] hover:bg-[#F6F3EE] transition-colors"
                    >
                      <td className="px-5 py-3"><SiteBadge site={inq.site} /></td>
                      <td className="px-4 py-3 text-ink-2 text-[12px]">
                        {inq.created_at ? format(parseISO(inq.created_at), "d MMM yy") : "—"}
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <div className="font-semibold text-ink truncate">{inq.part_name}</div>
                        {inq.part_number && (
                          <div className="text-[10px] font-mono text-ink-3 mt-0.5">{inq.part_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-ink tabular-nums">
                        {inq.qty_needed}
                      </td>
                      <td className="px-4 py-3 text-ink-2 text-[12px] truncate max-w-[120px]">
                        {inq.unit_asset ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-2 text-[12px]">
                        {inq.submitter_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-[12px]"
                        style={{ color: "#B07410" }}>
                        {inq.ut_site_code ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-ink-2">
                        {inq.replacement_pn ?? (inq.status === "invalid" ? "—" : "")}
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] text-ink-3">
                        {inq.responded_at ? format(parseISO(inq.responded_at), "d MMM yy") : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <InquiryBadge status={inq.status} size="sm" />
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
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="py-14 text-center text-ink-3 text-sm">
                Tidak ada riwayat respond.
              </div>
            ) : (
              items.map((inq) => (
                <div key={inq.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <SiteBadge site={inq.site} />
                      <InquiryBadge status={inq.status} size="sm" />
                    </div>
                    <span className="text-[11px] text-ink-3">
                      {inq.created_at ? format(parseISO(inq.created_at), "d MMM yy") : "—"}
                    </span>
                  </div>
                  <div className="font-bold text-ink text-sm">{inq.part_name}</div>
                  {inq.part_number && (
                    <div className="text-[10px] font-mono text-ink-3 mt-0.5">{inq.part_number}</div>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-2 mt-1.5">
                    <span>Qty: <span className="font-mono font-bold text-ink">{inq.qty_needed}</span></span>
                    {inq.unit_asset && <span>{inq.unit_asset}</span>}
                    {inq.submitter_name && <span>{inq.submitter_name}</span>}
                  </div>
                  <RespondDetail inq={inq} />
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {!isLoading && items.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[rgba(27,24,20,0.06)] bg-bg">
              <span className="text-[12px] text-ink-3">
                {totalValid + totalInvalid} total respond
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={items.length < limit}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
