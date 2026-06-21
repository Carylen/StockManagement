"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { format, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { RefreshCw, Download, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { useAuth } from "@/lib/auth";
import { Topbar } from "@/components/layout/Topbar";
import { InquiryDetail } from "@/components/inquiry/InquiryDetail";
import { InquiryBadge } from "@/components/ui/InquiryBadge";
import { FilterChips } from "@/components/ui/FilterChips";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
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

export default function ApprovalQueuePage() {
  const t = useTranslations("approval");
  const tInq = useTranslations("inquiry");
  const { ready } = usePermissionGuard((c) => c.can("can_approve_inquiry"));
  const { can } = useAuth();
  // Only HO (and other roles that can view all sites) get the SITE filter — every
  // other role is bounded to its own site, so they filter by status instead.
  const showSiteFilter = can("can_view_all_sites");

  const APPROVAL_CHIPS = [
    { value: "pending",  label: "Pending"  },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  const [approval, setApproval] = useState("pending");
  const [siteFilter, setSiteFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const limit = 15;

  // reject + action state
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const { data: sites = [] } = useSWR<Site[]>(
    ready ? "/auth/me/sites" : null,
    (u: string) => api.get<Site[]>(u),
    { revalidateOnFocus: true }
  );

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (approval) params.set("approval_status", approval);
  if (showSiteFilter && siteFilter !== "ALL") params.set("site", siteFilter);
  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);

  const { data, isLoading, mutate } = useSWR<PaginatedInquiries>(
    ready ? `/inquiries?${params}` : null,
    (u: string) => api.get<PaginatedInquiries>(u),
    { revalidateOnFocus: true },
  );

  const { data: detail } = useSWR<InquiryDetailType>(
    selectedId ? `/inquiries/${selectedId}` : null,
    (u: string) => api.get<InquiryDetailType>(u),
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

  const handleApprove = async (id: string) => {
    setLoading(id);
    try {
      await api.patch(`/inquiries/${id}/approve`, {});
      setToast({ msg: t("approveSuccess"), kind: "ok" });
      setSelectedId(null);
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedApprove"), kind: "err" });
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setLoading(rejectTarget);
    try {
      await api.patch(`/inquiries/${rejectTarget}/reject`, { reject_reason: rejectReason.trim() });
      setToast({ msg: t("rejectedMsg"), kind: "ok" });
      setRejectTarget(null);
      setRejectReason("");
      setSelectedId(null);
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedReject"), kind: "err" });
    } finally {
      setLoading(null);
    }
  };

  const handleExport = async () => {
    const p = new URLSearchParams();
    if (siteFilter !== "ALL") p.set("site", siteFilter);
    try {
      const blob = await api.download(`/export/inquiries?${p}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `inquiry-approval-${Date.now()}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  // Approve/Reject action bar shown inside the detail modal for pending items.
  const actionBar = (inq: InquiryDetailType) =>
    inq.approval_status === "pending" ? (
      <div className="flex gap-2 mt-4 pt-4 border-t border-border/60">
        <button
          type="button"
          onClick={() => { setRejectTarget(inq.id); setRejectReason(""); }}
          disabled={loading === inq.id}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-border text-sm font-semibold text-ink-2 hover:border-red-300 hover:text-red-700 transition-colors disabled:opacity-40"
        >
          <XCircle size={14} />
          {t("reject")}
        </button>
        <button
          type="button"
          onClick={() => handleApprove(inq.id)}
          disabled={loading === inq.id}
          className="flex-[2] flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-40"
        >
          {loading === inq.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {t("approve")}
        </button>
      </div>
    ) : null;

  if (!ready) return null;

  return (
    <div className="min-h-full">
      <Toast message={toast?.msg ?? null} kind={toast?.kind} onDismiss={() => setToast(null)} />

      <Topbar
        title={t("title")}
        subtitle={`${data?.total ?? 0} ${approval === "pending" ? t("awaiting") : ""}`}
      />

      {/* Reject modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => { setRejectTarget(null); setRejectReason(""); }}
        title={t("rejectModalTitle")}
      >
        <div className="p-5 space-y-4">
          <p className="text-sm text-ink-2">{t("rejectModalDesc")}</p>
          <div>
            <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
              {t("rejectionLabel")} <span className="text-warning-text">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t("rejectionPlaceholder")}
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setRejectTarget(null); setRejectReason(""); }}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold text-ink-2"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={!rejectReason.trim() || loading === rejectTarget}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-bold disabled:opacity-40"
            >
              {loading === rejectTarget ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              {t("confirmReject")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal
        open={!!selectedId && !!detail && !rejectTarget}
        onClose={() => setSelectedId(null)}
        title={tInq("detailTitle")}
        width={560}
      >
        {detail && (
          <div className="p-5">
            <InquiryDetail inquiry={detail} />
            {actionBar(detail)}
          </div>
        )}
      </Modal>

      <div className="p-4 md:p-6 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label={tInq("statTotalDone")}   value={stats.done}        accent="#1B1814" />
          <SummaryCard label={tInq("statItemValid")}   value={stats.valid}       accent="#15803D" />
          <SummaryCard label={tInq("statItemInvalid")} value={stats.invalid}     accent="#B91C1C" />
          <SummaryCard label={tInq("statRateValid")}   value={`${stats.rate}%`}  accent="#E8A323" />
        </div>

        {/* Filter card */}
        <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] px-4 py-3.5 flex flex-wrap items-center gap-x-5 gap-y-3">
          {showSiteFilter && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-widest text-ink-3">{tInq("filterSiteLabel")}</span>
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
                    {s === "ALL" ? tInq("allSites") : s}
                  </button>
                );
              })}
            </div>
          )}

          <FilterChips
            chips={APPROVAL_CHIPS}
            selected={approval}
            onSelect={(v) => { setApproval(v); setPage(1); }}
          />

          <div className="flex items-center gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-3">{tInq("fromLabel")}</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                className="px-2.5 py-1.5 text-xs border border-[rgba(27,24,20,0.12)] rounded-lg bg-surface"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-3">{tInq("toLabel")}</span>
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
              <Download size={13} /> {tInq("exportExcel")}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="bg-bg text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                  <th className="text-left px-5 py-3">{tInq("colSite")}</th>
                  <th className="text-left px-4 py-3">{tInq("colSubmitDate")}</th>
                  <th className="text-left px-4 py-3">{tInq("colPemohon")}</th>
                  <th className="text-right px-4 py-3">{tInq("colTotalQty")}</th>
                  <th className="text-left px-4 py-3">{tInq("colRespondDate")}</th>
                  <th className="text-right px-5 py-3">{tInq("colItemStatus")}</th>
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
                      {approval === "pending" ? t("allReviewed") : tInq("noInquiries")}
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
            <span className="text-[12px] text-ink-3">{tInq("totalDoneFooter", { total: data?.total ?? 0 })}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface disabled:opacity-40">{tInq("prev")}</button>
              <button onClick={() => setPage((p) => Math.min(data?.pages ?? 1, p + 1))} disabled={page >= (data?.pages ?? 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface disabled:opacity-40">{tInq("next")}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
