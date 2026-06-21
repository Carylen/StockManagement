"use client";

import { useTranslations } from "next-intl";
import { CalendarClock } from "lucide-react";
import type { PlanPeriod } from "@/lib/types";

const SITE_COLORS: Record<string, { bg: string; text: string }> = {
  AGMR: { bg: "#DCEEE3", text: "#1F6F4C" },
  RANT: { bg: "#E6E6F9", text: "#5B5BD6" },
  SPUT: { bg: "#FFE5DC", text: "#FF7A59" },
};

function daysRemaining(dueDate: string): number {
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/** Site + event + LOCKED countdown banner shown above the lines table on
 * both the planner upload page and the supplier fill page (DELTA3 D.4) —
 * computed client-side from `period.due_date`, no backend involved. */
export function PeriodCountdownBanner({ period }: { period: PlanPeriod }) {
  const t = useTranslations("planCountdown");
  const days = daysRemaining(period.due_date);
  const siteColor = SITE_COLORS[period.site] ?? { bg: "#F3F4F6", text: "#4B5563" };

  let tone: { bg: string; text: string } = { bg: "#F3F4F6", text: "#4B5563" };
  if (days <= 2) tone = { bg: "#FEE2E2", text: "#DC2626" };
  else if (days <= 7) tone = { bg: "#FEF3C7", text: "#D97706" };

  return (
    <div className="bg-surface rounded-2xl border border-border px-5 py-3 flex items-center gap-3 flex-wrap">
      <span
        className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full"
        style={{ background: siteColor.bg, color: siteColor.text }}
      >
        {period.site}
      </span>
      <span className="text-[13px] font-bold text-ink">{period.name}</span>
      <span className="text-[11px] text-ink-3">{period.start_date} → {period.due_date}</span>
      <span
        className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] font-bold px-2.5 py-1 rounded-full"
        style={{ background: tone.bg, color: tone.text }}
      >
        <CalendarClock size={12} />
        {days >= 0 ? t("daysRemaining", { days }) : t("eventLocked")}
      </span>
    </div>
  );
}
