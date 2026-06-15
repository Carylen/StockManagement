"use client";

import { InquiryBadge } from "@/components/ui/InquiryBadge";
import type { InquiryListItem, ApprovalStatus } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { CalendarDays, Package, User, Clock, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  inquiry: InquiryListItem;
  onClick?: () => void;
  showSubmitter?: boolean;
}

function ApprovalBadge({ status, rejectReason }: { status: ApprovalStatus; rejectReason?: string | null }) {
  const t = useTranslations("approvalStatus");
  if (status === "not_required") return null;
  const cfg = {
    pending:  { icon: Clock,         label: t("pending"),  cls: "bg-amber-50 text-amber-700 border-amber-200" },
    approved: { icon: CheckCircle2,  label: t("approved"), cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected: { icon: XCircle,       label: t("rejected"), cls: "bg-red-50 text-red-700 border-red-200" },
  }[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <div className={`flex items-start gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold ${cfg.cls}`}>
      <Icon size={11} className="flex-shrink-0 mt-0.5" />
      <span>
        {cfg.label}
        {status === "rejected" && rejectReason && (
          <span className="font-normal ml-1 opacity-80">· {rejectReason}</span>
        )}
      </span>
    </div>
  );
}

function SitePill({ site }: { site: string }) {
  const COLORS: Record<string, { bg: string; text: string }> = {
    AGMR: { bg: "#DCEEE3", text: "#1F6F4C" },
    RANT: { bg: "#E6E6F9", text: "#5B5BD6" },
    SPUT: { bg: "#FFE5DC", text: "#FF7A59" },
  };
  const c = COLORS[site] ?? { bg: "#F3F4F6", text: "#4B5563" };
  return (
    <span
      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.text }}
    >
      {site}
    </span>
  );
}

export function InquiryCard({ inquiry, onClick, showSubmitter = false }: Props) {
  const createdAt = inquiry.created_at
    ? format(parseISO(inquiry.created_at), "d MMM yyyy · HH:mm")
    : "—";

  return (
    <div
      onClick={onClick}
      className={`bg-surface rounded-lg border border-[rgba(27,24,20,0.08)] p-4 transition-all ${
        onClick ? "cursor-pointer hover:border-brand/40 hover:shadow-sm" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <SitePill site={inquiry.site} />
        </div>
        <InquiryBadge status={inquiry.status} size="sm" />
      </div>
      {inquiry.approval_status && inquiry.approval_status !== "not_required" && (
        <div className="mb-2">
          <ApprovalBadge status={inquiry.approval_status} rejectReason={inquiry.reject_reason} />
        </div>
      )}

      {/* Part count summary */}
      <div className="flex items-center gap-3 mt-2">
        <span className="flex items-center gap-1.5 text-xs text-ink-2">
          <Package size={12} className="text-ink-3" />
          <span className="font-bold font-mono tabular-nums text-ink">{inquiry.total_unique_parts}</span>
          <span>part</span>
          <span className="text-ink-3">·</span>
          <span className="font-bold font-mono tabular-nums text-ink">{inquiry.total_qty}</span>
          <span>pcs</span>
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3 mt-2">
        {showSubmitter && inquiry.submitted_by_name && (
          <span className="flex items-center gap-1">
            <User size={11} />
            <span className="text-ink-2">{inquiry.submitted_by_name}</span>
            {inquiry.submitted_by_nrp && (
              <span className="font-mono text-ink-3">· {inquiry.submitted_by_nrp}</span>
            )}
          </span>
        )}
        <span className="flex items-center gap-1">
          <CalendarDays size={11} />
          {createdAt}
        </span>
      </div>
    </div>
  );
}
