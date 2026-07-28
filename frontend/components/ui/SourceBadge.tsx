"use client";

import { useTranslations } from "next-intl";
import clsx from "clsx";

const SOURCE_STYLE: Record<string, { dot: string; text: string; bg: string }> = {
  ADMIN: { dot: "#6366F1", text: "#4338CA", bg: "#E0E7FF" },
  UT:    { dot: "#0D9488", text: "#0F766E", bg: "#CCFBF1" },
  NONE:  { dot: "#9CA3AF", text: "#4B5563", bg: "#F3F4F6" },
};

interface Props {
  source: "ADMIN" | "UT" | "NONE" | string | null | undefined;
  size?: "sm" | "md";
}

export function SourceBadge({ source, size = "md" }: Props) {
  const t = useTranslations("source");
  if (!source) return null;
  const style = SOURCE_STYLE[source] ?? SOURCE_STYLE.NONE;
  const label = SOURCE_STYLE[source] ? t(source) : source;
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
