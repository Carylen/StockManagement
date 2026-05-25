"use client";

import { useTranslations } from "next-intl";
import type { StockStatus } from "@/lib/types";
import clsx from "clsx";

const STATUS_STYLE: Record<StockStatus, { dot: string; text: string; bg: string }> = {
  AMAN:    { dot: "#22C55E", text: "#15803D", bg: "#DCFCE7" },
  WARNING: { dot: "#EF4444", text: "#B91C1C", bg: "#FEE2E2" },
  OVER:    { dot: "#F59E0B", text: "#B45309", bg: "#FEF3C7" },
  MAX:     { dot: "#3B82F6", text: "#1D4ED8", bg: "#DBEAFE" },
};

interface Props {
  status: StockStatus | string | null | undefined;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: Props) {
  const t = useTranslations("status");
  if (!status) return null;
  const style = STATUS_STYLE[status as StockStatus] ?? { dot: "#9CA3AF", text: "#4B5563", bg: "#F3F4F6" };
  const label = STATUS_STYLE[status as StockStatus] ? t(status as StockStatus) : status;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide",
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1"
      )}
      style={{ background: style.bg, color: style.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: style.dot }} />
      {label}
    </span>
  );
}
