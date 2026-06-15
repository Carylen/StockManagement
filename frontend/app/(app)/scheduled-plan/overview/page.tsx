"use client";

import { useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Skeleton } from "@/components/ui/Skeleton";
import type { PlanPeriod, PlanOverview } from "@/lib/types";

function pctColor(pct: number): string {
  if (pct >= 100) return "#16A34A";
  if (pct >= 60) return "#D97706";
  return "#DC2626";
}

export default function PlanOverviewPage() {
  const t = useTranslations("planOverview");
  const [selected, setSelected] = useState<string | null>(null);

  const { data: periods, isLoading: loadingPeriods } =
    useSWR<PlanPeriod[]>("/scheduled-plans/periods", (u: string) => api.get<PlanPeriod[]>(u));

  const activePeriod = selected ?? periods?.[0]?.period_id ?? null;

  const { data: overview, isLoading } = useSWR<PlanOverview>(
    activePeriod ? `/scheduled-plans/overview?period_id=${activePeriod}` : null,
    (u: string) => api.get<PlanOverview>(u)
  );

  return (
    <div className="min-h-full">
      <Topbar title={t("title")} subtitle={t("subtitle")} />

      <div className="p-6 pb-20 flex flex-col gap-5">
        {/* Period picker */}
        <div className="flex flex-wrap gap-3">
          {loadingPeriods ? (
            <Skeleton className="h-16 w-52" />
          ) : (periods ?? []).length === 0 ? (
            <p className="text-sm text-ink-3">{t("noPeriods")}</p>
          ) : (
            (periods ?? []).map((p) => {
              const isActive = p.period_id === activePeriod;
              return (
                <button
                  key={p.period_id}
                  onClick={() => setSelected(p.period_id)}
                  className={`text-left px-4 py-3 rounded-xl border transition-colors min-w-[200px] ${
                    isActive ? "bg-kpp-soft border-kpp" : "bg-surface border-border hover:bg-surface-alt"
                  }`}
                >
                  <span className="text-[13px] font-bold text-ink">{p.activity} · {p.site}</span>
                  <div className="text-[11px] text-ink-3 mt-1">{p.start_date} → {p.due_date}</div>
                </button>
              );
            })
          )}
        </div>

        {/* Overview cards (per ACTIVITY) */}
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          (overview?.activities ?? []).map((act) => (
            <div key={act.activity} className="bg-surface rounded-2xl border border-border overflow-hidden">
              <div className="px-6 py-5 flex items-center gap-6 border-b border-border flex-wrap">
                <div>
                  <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.6px]">{t("activityLabel")}</p>
                  <p className="text-xl font-bold text-ink tracking-tight">{act.activity}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[40px] font-bold leading-none font-mono tnum" style={{ color: pctColor(act.readiness_pct) }}>
                    {act.readiness_pct}%
                  </p>
                  <p className="text-[12px] text-ink-3 mt-1">
                    {act.ready}/{act.total} {t("ready")}
                  </p>
                </div>
              </div>

              {/* Per APL ACTIVITY */}
              <div className="divide-y divide-border">
                {act.apl_activities.map((a) => (
                  <div key={a.apl_activity} className="px-6 py-3 flex items-center gap-4">
                    <span className="text-[13px] font-semibold text-ink flex-1 min-w-0 truncate">{a.apl_activity}</span>
                    <div className="w-[180px] h-2 rounded-full bg-surface-alt overflow-hidden flex-shrink-0">
                      <div className="h-full rounded-full" style={{ width: `${a.pct}%`, background: pctColor(a.pct) }} />
                    </div>
                    <span className="text-[12px] font-mono text-ink-2 w-[90px] text-right flex-shrink-0">
                      {a.ready}/{a.total} · {a.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {activePeriod && !isLoading && (overview?.activities ?? []).length === 0 && (
          <p className="text-sm text-ink-3">{t("noData")}</p>
        )}
      </div>
    </div>
  );
}
