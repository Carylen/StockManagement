"use client";

import { useTranslations } from "next-intl";
import { ReadynessBar } from "@/components/ui/ReadynessBar";
import { Skeleton } from "@/components/ui/Skeleton";
import type { DashboardSummary } from "@/lib/types";

interface Props {
  data?: DashboardSummary;
  loading: boolean;
}

export function ReadynessSection({ data, loading }: Props) {
  const t = useTranslations("dashboard");
  return (
    <div className="bg-surface rounded-lg border border-[rgba(27,24,20,0.08)] p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-ink">{t("readinessMetrics")}</h3>
          <p className="text-xs text-ink-3 mt-0.5">{t("readinessSub")}</p>
        </div>
        {data && (
          <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
            {data.site}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-2.5 w-full rounded-full" />
          <Skeleton className="h-2.5 w-full rounded-full" />
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
      ) : data ? (
        <>
          <ReadynessBar
            oh_pct={data.readyness.oh_pct}
            min_pct={data.readyness.min_pct}
            fb_pct={data.readyness.fb_pct}
          />
          <div className="mt-4 pt-3 border-t border-[rgba(27,24,20,0.06)] grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-ink font-mono">{data.readyness.oh_pct.toFixed(0)}%</p>
              <p className="text-[10px] text-ink-3 font-semibold">ON HAND</p>
            </div>
            <div>
              <p className="text-lg font-bold text-aman font-mono">{data.readyness.min_pct.toFixed(0)}%</p>
              <p className="text-[10px] text-ink-3 font-semibold">≥ MIN</p>
            </div>
            <div>
              <p className="text-lg font-bold text-primary font-mono">{data.readyness.fb_pct.toFixed(0)}%</p>
              <p className="text-[10px] text-ink-3 font-semibold">FULFILLED</p>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-3 text-center py-4">{t("noDataYet")}</p>
      )}
    </div>
  );
}
