"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { format, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { RefreshCw, Download } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Topbar } from "@/components/layout/Topbar";
import { InquiryDetail } from "@/components/inquiry/InquiryDetail";
import { InquiryBadge } from "@/components/ui/InquiryBadge";
import { FilterChips } from "@/components/ui/FilterChips";
import { SummaryCard } from "@/components/ui/SummaryCard";
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

export default function TeamInquiryPage() {
  const { user, isLoading: authLoading, can } = useAuth();
  const t = useTranslations("inquiry");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const canViewTeam = can("can_view_team_inquiry");
  // Only HO (and other roles that can view all sites) get the SITE filter — every
  // other role is bounded to its own site, so they filter by status instead.
  const showSiteFilter = can("can_view_all_sites");
  const STATUS_CHIPS = [
    { value: "",        label: t("allLabel") },
    { value: "pending", label: "Pending" },
    { value: "done",    label: "Done"    },
  ];
  const [status, setStatus] = useState("");
  const [siteFilter, setSiteFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const limit = 15;

  useEffect(() => {
    if (!authLoading && user && !canViewTeam) {
      router.replace("/dashboard");
    }
  }, [authLoading, user, canViewTeam, router]);

  const { data: sites = [] } = useSWR<Site[]>(
    canViewTeam ? "/auth/me/sites" : null,
    (u: string) => api.get<Site[]>(u),
    { revalidateOnFocus: true }
  );

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  // Team list shows only approved inquiries — pending/rejected stay in the approval queue.
  params.set("approval_status", "approved");
  if (status) params.set("status", status);
  if (showSiteFilter && siteFilter !== "ALL") params.set("site", siteFilter);
  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);

  const { data, isLoading, mutate } = useSWR<PaginatedInquiries>(
    canViewTeam ? `/inquiries?${params}` : null,
    (u: string) => api.get<PaginatedInquiries>(u)
  );

  const { data: detail } = useSWR<InquiryDetailType>(
    selectedId ? `/inquiries/${selectedId}` : null,
    (u: string) => api.get<InquiryDetailType>(u)
  );

  const items = data?.items ?? [];

  // Summary stats — computed from the currently loaded page.
  const stats = useMemo(() => {
    const done = items.filter((i) => i.status === "done").length;
    const valid = items.reduce((s, i) => s + i.total_valid_items, 0);
    const invalid = items.reduce((s, i) => s + i.total_invalid_items, 0);
    const total = valid + invalid;
    const rate = total > 0 ? Math.round((valid / total) * 100) : 0;
    return { done, valid, invalid, rate };
  }, [items]);

  const handleExport = async () => {
    const p = new URLSearchParams();
    if (siteFilter !== "ALL") p.set("site", siteFilter);
    try {
      const blob = await api.download(`/export/inquiries?${p}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `inquiry-team-${Date.now()}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  if (authLoading || !user || !canViewTeam) return null;

  return (
    <div className="min-h-full">
      <Topbar title={tNav("teamInquiriesNav")} subtitle={t("teamSubtitle", { total: data?.total ?? 0, site: user.site ?? "" })} />

      <Modal
        open={!!selectedId && !!detail}
        onClose={() => setSelectedId(null)}
        title={t("detailTitle")}
        width={560}
      >
        {detail && (
          <div className="p-5">
            <InquiryDetail inquiry={detail} />
          </div>
        )}
      </Modal>

      <div className="p-4 md:p-6 space-y-4 max-w-[1400px]">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label={t("statTotalDone")}   value={stats.done}        accent="#1B1814" />
          <SummaryCard label={t("statItemValid")}   value={stats.valid}       accent="#15803D" />
          <SummaryCard label={t("statItemInvalid")} value={stats.invalid}     accent="#B91C1C" />
          <SummaryCard label={t("statRateValid")}   value={`${stats.rate}%`}  accent="#E8A323" />
        </div>

        {/* Filter card */}
        <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] px-4 py-3.5 flex flex-wrap items-center gap-x-5 gap-y-3">
          {showSiteFilter && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-widest text-ink-3">{t("filterSiteLabel")}</span>
              {(["ALL", ...sites.map((s) => s.code)] as string[]).map((s) => {
                const on = siteFilter === s;
                return (
                  <button key={s} onClick={() => { setSiteFilter(s); setPage(1); }}
                    className="px-3 py-1.5 rounded-full text-[12.5px] font-bold transition-all"
                    style={{
                      background: on ? "#16110D" : "#FFFFFF", color: on ? "#FFFFFF" : "#6B6256",
                      border: on ? "none" : "1px solid rgba(27,24,20,0.1)",
                      fontFamily: s === "ALL" ? "inherit" : "var(--font-mono, monospace)",
                    }}>
                    {s === "ALL" ? t("allSites") : s}
                  </button>
                );
              })}
            </div>
          )}

          <FilterChips
            chips={STATUS_CHIPS}
            selected={status}
            onSelect={(v) => { setStatus(v); setPage(1); }}
          />

          <div className="flex items-center gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-3">{t("fromLabel")}</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                className="px-2.5 py-1.5 text-xs border border-[rgba(27,24,20,0.12)] rounded-lg bg-surface"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-3">{t("toLabel")}</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                className="px-2.5 py-1.5 text-xs border border-[rgba(27,24,20,0.12)] rounded-lg bg-surface"
              />
            </label>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => mutate()}
              className="p-2 rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface text-ink-3 hover:text-ink transition-colors">
              <RefreshCw size={14} />
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-bold transition-colors"
              style={{ background: "#E8A323", color: "#16110D" }}>
              <Download size={13} /> {t("exportExcel")}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="bg-bg text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                  <th className="text-left px-5 py-3">{t("colSite")}</th>
                  <th className="text-left px-4 py-3">{t("colSubmitDate")}</th>
                  <th className="text-left px-4 py-3">{t("colPemohon")}</th>
                  <th className="text-right px-4 py-3">{t("colTotalQty")}</th>
                  <th className="text-left px-4 py-3">{t("colRespondDate")}</th>
                  <th className="text-right px-5 py-3">{t("colItemStatus")}</th>
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
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center text-ink-3 text-sm">
                      {t("noInquiries")}
                    </td>
                  </tr>
                ) : (
                  items.map((inq: InquiryListItem) => (
                    <tr
                      key={inq.id}
                      onClick={() => setSelectedId(inq.id)}
                      className={`border-t border-[rgba(27,24,20,0.06)] cursor-pointer transition-colors ${
                        selectedId === inq.id ? "bg-[#F0F7F3]" : "hover:bg-[#F6F3EE]"
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <SiteBadge site={inq.site} />
                      </td>
                      <td className="px-4 py-3.5 text-[12.5px] font-bold text-ink">
                        {inq.created_at ? format(parseISO(inq.created_at), "d MMM yy") : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-ink text-[12.5px]">
                          {inq.submitted_by_name ?? "—"}
                        </div>
                        {inq.submitted_by_nrp && (
                          <div className="text-[10px] font-mono text-ink-3">{inq.submitted_by_nrp}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold tabular-nums text-ink">
                        {inq.total_qty}
                        <span className="text-ink-3 font-normal text-[10px] ml-0.5">pcs</span>
                      </td>
                      <td className="px-4 py-3.5 text-[11px] text-ink-3">
                        {inq.responded_at ? format(parseISO(inq.responded_at), "d MMM yy · HH:mm") : "—"}
                      </td>
                      <td className="px-5 py-3.5">
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

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[rgba(27,24,20,0.06)] bg-[#F6F3EE]">
            <span className="text-[12px] text-ink-3">{t("totalDoneFooter", { total: data?.total ?? 0 })}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface disabled:opacity-40">{t("prev")}</button>
              <button onClick={() => setPage((p) => Math.min(data?.pages ?? 1, p + 1))} disabled={page >= (data?.pages ?? 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface disabled:opacity-40">{t("next")}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
