"use client";

import { InquiryBadge } from "@/components/ui/InquiryBadge";
import type { Inquiry } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";

interface Props {
  inquiry: Inquiry;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-[rgba(27,24,20,0.06)] last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</span>
      <span className="text-sm text-ink">{value || <span className="text-ink-3">—</span>}</span>
    </div>
  );
}

export function InquiryDetail({ inquiry }: Props) {
  const fmt = (d: string | null) =>
    d ? format(parseISO(d), "d MMMM yyyy HH:mm", { locale: id }) : null;

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono text-ink-3 truncate">{inquiry.id}</span>
        <InquiryBadge status={inquiry.status} />
      </div>

      <Row label="Part Name" value={<span className="font-semibold">{inquiry.part_name}</span>} />
      <Row label="Part Number" value={inquiry.part_number && <span className="font-mono">{inquiry.part_number}</span>} />
      <Row label="Qty Dibutuhkan" value={<><span className="font-bold font-mono">{inquiry.qty_needed}</span> unit</>} />
      <Row label="Unit / Aset" value={inquiry.unit_asset} />
      <Row label="Tanggal Dibutuhkan" value={inquiry.date_needed} />
      <Row label="Catatan" value={inquiry.notes} />
      <Row
        label="Diajukan oleh"
        value={
          <span>
            {inquiry.submitter_name || inquiry.submitted_by}
            <span className="text-ink-3 ml-1">· {fmt(inquiry.created_at)}</span>
          </span>
        }
      />
      {inquiry.reviewed_by && (
        <Row
          label="Ditinjau oleh"
          value={
            <span>
              {inquiry.reviewer_name || inquiry.reviewed_by}
              <span className="text-ink-3 ml-1">· {fmt(inquiry.reviewed_at)}</span>
            </span>
          }
        />
      )}
      {inquiry.rejection_reason && (
        <div className="mt-3 p-3 bg-warning-bg rounded-lg border border-warning/20">
          <p className="text-xs font-semibold text-warning-text uppercase tracking-wider mb-1">Alasan Ditolak</p>
          <p className="text-sm text-ink">{inquiry.rejection_reason}</p>
        </div>
      )}
      {inquiry.supplier_notes && (
        <div className="mt-3 p-3 bg-[#FBF7EE] rounded-lg border border-[rgba(27,24,20,0.08)]">
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-1">Catatan Supplier (UT)</p>
          <p className="text-sm text-ink">{inquiry.supplier_notes}</p>
          {inquiry.responded_at && (
            <p className="text-[10px] text-ink-3 mt-1">{fmt(inquiry.responded_at)}</p>
          )}
        </div>
      )}
    </div>
  );
}
