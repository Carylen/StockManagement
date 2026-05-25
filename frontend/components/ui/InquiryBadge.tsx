"use client";

import type { InquiryStatus } from "@/lib/types";
import clsx from "clsx";

const INQ_STYLE: Record<InquiryStatus, { dot: string; text: string; bg: string; label: string }> = {
  pending: { dot: "#F59E0B", text: "#B45309", bg: "#FEF3C7", label: "Pending" },
  valid:   { dot: "#22C55E", text: "#15803D", bg: "#DCFCE7", label: "Valid"    },
  invalid: { dot: "#EF4444", text: "#B91C1C", bg: "#FEE2E2", label: "Invalid"  },
};

interface Props {
  status: string | null | undefined;
  size?: "sm" | "md";
}

export function InquiryBadge({ status, size = "md" }: Props) {
  if (!status) return null;
  const style = INQ_STYLE[status as InquiryStatus] ?? {
    dot: "#9CA3AF", text: "#4B5563", bg: "#F3F4F6", label: status.toUpperCase(),
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide",
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1"
      )}
      style={{ background: style.bg, color: style.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: style.dot }} />
      {style.label}
    </span>
  );
}
