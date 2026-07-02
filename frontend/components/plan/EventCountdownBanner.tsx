"use client";

import { useTranslations } from "next-intl";
import { CalendarClock } from "lucide-react";
import type { PlanPeriod } from "@/lib/types";

// Threshold constants — change here only, not in JSX.
const WARN_ORANGE_DAYS = 3;  // < 3 days → orange
const WARN_YELLOW_DAYS = 7;  // 3–7 days → yellow

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

type BannerTone = { bg: string; text: string } | null;

function bannerTone(days: number, isLocked: boolean): BannerTone {
  if (isLocked) return { bg: "#F3F4F6", text: "#6B7280" };
  if (days < WARN_ORANGE_DAYS) return { bg: "#FEE2E2", text: "#DC2626" };
  if (days <= WARN_YELLOW_DAYS) return { bg: "#FEF3C7", text: "#D97706" };
  return null; // > 7 days → no banner
}

interface Props {
  period: PlanPeriod;
  /** Show site + event name label (default true). */
  showLabel?: boolean;
}

/** Countdown banner shown above the lines table on planner, supplier, and
 *  overview pages. Single source of truth — three pages, one component.
 *  No banner rendered when > 7 days remaining (avoids noise in normal state). */
export function EventCountdownBanner({ period, showLabel = true }: Props) {
  const t = useTranslations("planCountdown");
  const isLocked = period.state === "LOCKED";
  const days = daysRemaining(period.due_date);
  const tone = bannerTone(days, isLocked);

  if (!tone) return null; // no banner when event is comfortably open

  const siteColor = SITE_COLORS[period.site] ?? { bg: "#F3F4F6", text: "#4B5563" };

  const message = isLocked
    ? t("eventLocked")
    : days === 0
    ? t("eventToday")
    : t("daysRemaining", { days });

  return (
    <div className="rounded-2xl border border-border px-5 py-3 flex items-center gap-3 flex-wrap"
      style={{ background: tone.bg + "33", borderColor: tone.bg }}>
      {showLabel && (
        <>
          <span
            className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ background: siteColor.bg, color: siteColor.text }}
          >
            {period.site}
          </span>
          <span className="text-[13px] font-bold text-ink">{period.name}</span>
        </>
      )}
      <span
        className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] font-bold px-2.5 py-1 rounded-full"
        style={{ background: tone.bg, color: tone.text }}
      >
        <CalendarClock size={12} />
        {message}
      </span>
    </div>
  );
}
