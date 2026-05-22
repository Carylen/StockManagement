"use client";

import { InquiryBadge } from "@/components/ui/InquiryBadge";
import type { Inquiry } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { CalendarDays, Package, User } from "lucide-react";

interface Props {
  inquiry: Inquiry;
  onClick?: () => void;
  showSubmitter?: boolean;
}

export function InquiryCard({ inquiry, onClick, showSubmitter = false }: Props) {
  const createdAt = inquiry.created_at
    ? format(parseISO(inquiry.created_at), "d MMM yyyy", { locale: id })
    : "—";

  return (
    <div
      onClick={onClick}
      className={`bg-surface rounded-lg border border-[rgba(27,24,20,0.08)] p-4 transition-all ${
        onClick ? "cursor-pointer hover:border-primary/40 hover:shadow-sm" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-ink truncate">{inquiry.part_name}</span>
            {inquiry.part_number && (
              <span className="text-[10px] font-mono text-ink-3 bg-[#F5EFE1] px-1.5 py-0.5 rounded">
                {inquiry.part_number}
              </span>
            )}
          </div>
        </div>
        <InquiryBadge status={inquiry.status} size="sm" />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3 mt-2">
        <span className="flex items-center gap-1">
          <Package size={11} />
          Qty: <span className="font-bold text-ink">{inquiry.qty_needed}</span>
          {inquiry.unit_asset && <span className="text-ink-2"> / {inquiry.unit_asset}</span>}
        </span>
        {inquiry.date_needed && (
          <span className="flex items-center gap-1">
            <CalendarDays size={11} />
            Butuh: <span className="font-semibold text-ink-2">{inquiry.date_needed}</span>
          </span>
        )}
        <span className="flex items-center gap-1">
          <CalendarDays size={11} />
          {createdAt}
        </span>
        {showSubmitter && inquiry.submitter_name && (
          <span className="flex items-center gap-1">
            <User size={11} />
            {inquiry.submitter_name}
          </span>
        )}
      </div>

      {inquiry.notes && (
        <p className="text-xs text-ink-2 mt-2 line-clamp-2 bg-[#FBF7EE] rounded px-2 py-1.5">
          {inquiry.notes}
        </p>
      )}

      {inquiry.supplier_notes && (
        <div className="mt-2 text-xs text-ink-2 border-l-2 border-primary pl-2">
          <span className="font-semibold text-ink-3">Catatan UT: </span>
          {inquiry.supplier_notes}
        </div>
      )}

      {inquiry.rejection_reason && (
        <div className="mt-2 text-xs text-warning-text border-l-2 border-warning pl-2 bg-warning-bg rounded-r px-2 py-1">
          <span className="font-semibold">Alasan ditolak: </span>
          {inquiry.rejection_reason}
        </div>
      )}
    </div>
  );
}
