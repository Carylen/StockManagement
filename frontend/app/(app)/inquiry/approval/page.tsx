"use client";

import { useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle, RefreshCw, Loader2, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import { InquiryDetail } from "@/components/inquiry/InquiryDetail";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import type { PaginatedInquiries, InquiryListItem, InquiryDetail as InquiryDetailType } from "@/lib/types";
import { format, parseISO } from "date-fns";

function ApprovalCard({
  inquiry,
  onApprove,
  onReject,
  onView,
  loading,
}: {
  inquiry: InquiryListItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onView: (id: string) => void;
  loading: string | null;
}) {
  const t = useTranslations("approval");
  const createdAt = inquiry.created_at
    ? format(parseISO(inquiry.created_at), "d MMM yyyy · HH:mm")
    : "—";

  return (
    <div className="bg-surface rounded-xl ring-1 ring-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-ink-3">{createdAt}</p>
          {(inquiry.submitted_by_name || inquiry.submitted_by_nrp) && (
            <p className="text-sm font-semibold text-ink mt-0.5">
              {inquiry.submitted_by_name}
              {inquiry.submitted_by_nrp && (
                <span className="text-ink-3 font-mono text-xs ml-1.5">· {inquiry.submitted_by_nrp}</span>
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onView(inquiry.id)}
          className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink transition-colors flex-shrink-0"
        >
          Detail <ChevronRight size={12} />
        </button>
      </div>

      <div className="flex items-center gap-3 text-sm text-ink-2">
        <span className="font-bold font-mono text-ink">{inquiry.total_unique_parts}</span>
        <span>part</span>
        <span className="text-ink-3">·</span>
        <span className="font-bold font-mono text-ink">{inquiry.total_qty}</span>
        <span>pcs total</span>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onReject(inquiry.id)}
          disabled={loading === inquiry.id}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-border text-sm font-semibold text-ink-2 hover:border-red-300 hover:text-red-700 transition-colors disabled:opacity-40"
        >
          <XCircle size={14} />
          {t("reject")}
        </button>
        <button
          type="button"
          onClick={() => onApprove(inquiry.id)}
          disabled={loading === inquiry.id}
          className="flex-[2] flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-40"
        >
          {loading === inquiry.id ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <CheckCircle2 size={14} />
          )}
          {t("approve")}
        </button>
      </div>
    </div>
  );
}

export default function ApprovalQueuePage() {
  const t = useTranslations("approval");
  const tInq = useTranslations("inquiry");
  const { ready } = usePermissionGuard((c) => c.can("can_approve_inquiry"));

  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const { data, isLoading, mutate } = useSWR<PaginatedInquiries>(
    ready ? "/inquiries?approval_status=pending&limit=50" : null,
    (u: string) => api.get<PaginatedInquiries>(u),
    { revalidateOnFocus: true },
  );

  const { data: detail } = useSWR<InquiryDetailType>(
    viewId ? `/inquiries/${viewId}` : null,
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

  return (
    <div className="min-h-full">
      <Toast message={toast?.msg ?? null} kind={toast?.kind} onDismiss={() => setToast(null)} />

      {/* Reject modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => { setRejectTarget(null); setRejectReason(""); }}
        title={t("rejectModalTitle")}
      >
        <div className="p-5 space-y-4">
          <p className="text-sm text-ink-2">
            {t("rejectModalDesc")}
          </p>
          <div>
            <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
              {t("rejectionLabel")} <span className="text-warning-text">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
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
      <Modal open={!!viewId && !!detail} onClose={() => setViewId(null)} title={tInq("detailTitle")}>
        {detail && (
          <div className="p-5">
            <InquiryDetail inquiry={detail} />
          </div>
        )}
      </Modal>

      <Topbar
        title={t("title")}
        subtitle={`Group Leader · ${items.length > 0 ? `${items.length} ${t("awaiting")}` : t("noNew")}`}
      />

      <div className="p-4 md:p-6 max-w-2xl space-y-4">
        <div className="flex justify-end">
          <button onClick={() => mutate()} className="text-ink-3 hover:text-ink p-1.5 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <CheckCircle2 size={36} className="mx-auto text-emerald-400 mb-3" />
            <p className="text-ink-2 font-semibold">{t("allReviewed")}</p>
            <p className="text-ink-3 text-sm mt-1">{t("noNewWaiting")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((inq: InquiryListItem) => (
              <ApprovalCard
                key={inq.id}
                inquiry={inq}
                loading={loading}
                onApprove={handleApprove}
                onReject={(id) => { setRejectTarget(id); setRejectReason(""); }}
                onView={setViewId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
