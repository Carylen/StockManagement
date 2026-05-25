"use client";

import { useState } from "react";
import useSWR from "swr";
import { CheckCircle, XCircle, RefreshCw, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { InquiryCard } from "@/components/inquiry/InquiryCard";
import { InquiryDetail } from "@/components/inquiry/InquiryDetail";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/DataTable";
import type { PaginatedInquiries, Inquiry } from "@/lib/types";
import { useTranslations } from "next-intl";

export default function ApprovalPage() {
  const t = useTranslations("approval");
  const tu = useTranslations("users");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [loading, setLoading] = useState(false);
  const limit = 10;

  const params = new URLSearchParams({ status: "draft", page: String(page), limit: String(limit) });

  const { data, isLoading, mutate } = useSWR<PaginatedInquiries>(
    `/inquiries?${params}`,
    (u: string) => api.get<PaginatedInquiries>(u)
  );

  const handleApprove = async (inq: Inquiry) => {
    setLoading(true);
    try {
      await api.patch(`/inquiries/${inq.id}/approve`);
      setToast({ msg: `"${inq.part_name}" ${t("approvedMsg")}`, kind: "ok" });
      setSelected(null);
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedApprove"), kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) return;
    setLoading(true);
    try {
      await api.patch(`/inquiries/${selected.id}/reject`, { rejection_reason: rejectReason });
      setToast({ msg: t("rejectedMsg"), kind: "ok" });
      setSelected(null);
      setShowRejectForm(false);
      setRejectReason("");
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedReject"), kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full">
      <Toast message={toast?.msg ?? null} kind={toast?.kind} onDismiss={() => setToast(null)} />
      <Topbar title={t("title")} subtitle={t("subtitle")} />

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => { setSelected(null); setShowRejectForm(false); setRejectReason(""); }} title={t("reviewTitle")} width={560}>
        {selected && (
          <div className="p-5">
            <InquiryDetail inquiry={selected} />

            {!showRejectForm ? (
              <div className="flex gap-3 mt-5 pt-4 border-t border-[rgba(27,24,20,0.06)]">
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-warning-bg text-warning-text font-semibold text-sm rounded-lg hover:bg-red-100 transition-colors"
                >
                  <XCircle size={16} /> {t("reject")}
                </button>
                <button
                  onClick={() => handleApprove(selected)}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-aman text-white font-bold text-sm rounded-lg hover:bg-green-600 transition-colors disabled:opacity-60"
                >
                  <CheckCircle size={16} /> {t("approve")}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1.5">{t("rejectionLabel")}</label>
                  <textarea
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder={t("rejectionPlaceholder")}
                    className="w-full px-3 py-2.5 border border-[rgba(27,24,20,0.12)] rounded-lg text-sm focus:outline-none focus:border-warning resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowRejectForm(false); setRejectReason(""); }}
                    className="px-4 py-2.5 bg-surface-alt text-ink text-sm font-semibold rounded-lg"
                  >
                    {tu("cancel")}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!rejectReason.trim() || loading}
                    className="flex-1 py-2.5 bg-warning text-white font-bold text-sm rounded-lg disabled:opacity-50"
                  >
                    {t("confirmReject")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <div className="p-4 md:p-6 space-y-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {data && data.total > 0 && (
              <span className="bg-warning text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {data.total}
              </span>
            )}
            <span className="text-sm text-ink-2">{t("awaiting")}</span>
          </div>
          <button onClick={() => mutate()} className="text-ink-3 hover:text-ink p-1.5 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle size={40} className="mx-auto mb-3 text-aman" />
            <p className="text-ink font-bold">{t("noNew")}</p>
            <p className="text-sm text-ink-3 mt-1">{t("allReviewed")}</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {data?.items.map((inq) => (
                <div key={inq.id} className="relative">
                  <InquiryCard
                    inquiry={inq}
                    onClick={() => setSelected(inq)}
                    showSubmitter
                  />
                  <div className="absolute top-3 right-3 flex gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelected(inq); setShowRejectForm(true); }}
                      className="p-1.5 bg-warning-bg text-warning-text rounded-lg hover:bg-red-100 transition-colors"
                      title={t("rejectTitle")}
                    >
                      <XCircle size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleApprove(inq); }}
                      className="p-1.5 bg-aman-bg text-aman-text rounded-lg hover:bg-green-100 transition-colors"
                      title={t("approveTitle")}
                    >
                      <CheckCircle size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {data && data.pages > 1 && (
              <Pagination page={page} pages={data.pages} total={data.total} limit={limit} onPage={setPage} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
