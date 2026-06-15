"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { format, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { Topbar } from "@/components/layout/Topbar";
import { InquiryDetail } from "@/components/inquiry/InquiryDetail";
import { InquiryBadge } from "@/components/ui/InquiryBadge";
import { FilterChips } from "@/components/ui/FilterChips";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import { Pagination } from "@/components/ui/DataTable";
import type { PaginatedInquiries, InquiryListItem, InquiryDetail as InquiryDetailType } from "@/lib/types";

export default function ApprovalQueuePage() {
  const t = useTranslations("approval");
  const tInq = useTranslations("inquiry");
  const { ready } = usePermissionGuard((c) => c.can("can_approve_inquiry"));

  const APPROVAL_CHIPS = [
    { value: "pending",  label: "Pending"  },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  const [approval, setApproval] = useState("pending");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const limit = 15;

  // reject + action state
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1280);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (approval) params.set("approval_status", approval);
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

  if (!ready) return null;

  const items = data?.items ?? [];

  const handleApprove = async (id: string) => {
    setLoading(id);
    try {
      await api.patch(`/inquiries/${id}/approve`, {});
      setToast({ msg: t("approveSuccess"), kind: "ok" });
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
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedReject"), kind: "err" });
    } finally {
      setLoading(null);
    }
  };

  // Approve/Reject action bar shown inside the detail panel for pending items.
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

      {/* Detail modal (mobile) */}
      <Modal
        open={isMobile && !!selectedId && !!detail}
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
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <FilterChips
              chips={APPROVAL_CHIPS}
              selected={approval}
              onSelect={(v) => { setApproval(v); setPage(1); }}
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
            <button onClick={() => mutate()} className="p-1.5 text-ink-3 hover:text-ink transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-bg text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                      <th className="text-left px-5 py-3">{tInq("colRequester")}</th>
                      <th className="text-right px-4 py-3">{tInq("colTotalPn")}</th>
                      <th className="text-right px-4 py-3">{tInq("colTotalQty")}</th>
                      <th className="text-left px-4 py-3">{tInq("colDate")}</th>
                      <th className="text-right px-5 py-3">{tInq("colItemStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      [...Array(6)].map((_, i) => (
                        <tr key={i} className="border-t border-[rgba(27,24,20,0.06)]">
                          <td colSpan={5} className="px-5 py-3">
                            <Skeleton className="h-5 w-full rounded" />
                          </td>
                        </tr>
                      ))
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-14 text-center text-ink-3 text-sm">
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
                          <td className="px-5 py-3">
                            <div className="font-semibold text-ink text-[12.5px]">
                              {inq.submitted_by_name ?? "—"}
                            </div>
                            {inq.submitted_by_nrp && (
                              <div className="text-[10px] font-mono text-ink-3">{inq.submitted_by_nrp}</div>
                            )}
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

          <div className="hidden xl:block">
            {detail ? (
              <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] p-4 sticky top-6">
                <InquiryDetail inquiry={detail} />
                {actionBar(detail)}
              </div>
            ) : (
              <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] p-4 flex flex-col items-center justify-center h-48 text-center">
                <p className="text-sm text-ink-3">{tInq("selectToView")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
