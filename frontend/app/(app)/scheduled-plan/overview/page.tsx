"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Skeleton } from "@/components/ui/Skeleton";
import type { PlanPeriod, PlanOverview, PlanAplStat } from "@/lib/types";

function pctColor(pct: number): string {
  if (pct >= 100) return "#16A34A";
  if (pct >= 60) return "#D97706";
  return "#DC2626";
}

type StatusFilter = "all" | "ready" | "not_ready";

function matchStatus(a: PlanAplStat, status: StatusFilter): boolean {
  if (status === "ready") return a.pct >= 100;
  if (status === "not_ready") return a.pct < 100;
  return true;
}

export default function PlanOverviewPage() {
  const t = useTranslations("planOverview");
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [apl, setApl] = useState<string>("");

  const { data: periods, isLoading: loadingPeriods } =
    useSWR<PlanPeriod[]>("/scheduled-plans/periods", (u: string) => api.get<PlanPeriod[]>(u));

  const activePeriod = selected ?? periods?.[0]?.period_id ?? null;

  const { data: overview, isLoading } = useSWR<PlanOverview>(
    activePeriod ? `/scheduled-plans/overview?period_id=${activePeriod}` : null,
    (u: string) => api.get<PlanOverview>(u)
  );

  // Distinct apl_activity values for the dropdown.
  const aplOptions = useMemo(() => {
    const set = new Set<string>();
    for (const act of overview?.activities ?? []) {
      for (const a of act.apl_activities) set.add(a.apl_activity);
    }
    return Array.from(set).sort();
  }, [overview]);

  // Activities with their apl_activities narrowed by both filters; empty ones dropped.
  const filtered = useMemo(() => {
    return (overview?.activities ?? [])
      .map((act) => ({
        ...act,
        rows: act.apl_activities.filter(
          (a) => matchStatus(a, status) && (!apl || a.apl_activity === apl)
        ),
      }))
      .filter((act) => act.rows.length > 0);
  }, [overview, status, apl]);

  const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
    { value: "all",       label: t("statusAll") },
    { value: "ready",     label: t("statusReady") },
    { value: "not_ready", label: t("statusNotReady") },
  ];

  return (
    <div className="min-h-full">
      <Topbar title={t("title")} subtitle={t("subtitle")} />

      <div className="p-6 pb-20 flex flex-col gap-5">
        {/* Period picker */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loadingPeriods ? (
            <Skeleton className="h-16 w-52 col-span-full" />
          ) : (periods ?? []).length === 0 ? (
            <p className="text-sm text-ink-3 col-span-full">{t("noPeriods")}</p>
          ) : (
            (periods ?? []).map((p) => {
              const isActive = p.period_id === activePeriod;
              return (
                <button
                  key={p.period_id}
                  onClick={() => setSelected(p.period_id)}
                  className={`text-left px-4 py-3 rounded-xl border transition-colors ${
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

        {/* Filter bar — status chips + apl_activity dropdown */}
        {activePeriod && (
          <div className="bg-surface rounded-xl border border-border px-4 py-3.5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-widest text-ink-3">{t("filterStatusLabel")}</span>
              {STATUS_CHIPS.map((c) => {
                const on = status === c.value;
                return (
                  <button key={c.value} onClick={() => setStatus(c.value)}
                    className="px-3 py-1.5 rounded-full text-[12.5px] font-bold transition-all"
                    style={{
                      background: on ? "#16110D" : "#FFFFFF", color: on ? "#FFFFFF" : "#6B6256",
                      border: on ? "none" : "1px solid rgba(27,24,20,0.1)",
                    }}>
                    {c.label}
                  </button>
                );
              })}
            </div>

            <label className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-ink-3">{t("filterAplLabel")}</span>
              <select
                value={apl}
                onChange={(e) => setApl(e.target.value)}
                className="px-3 py-1.5 text-[12.5px] font-semibold border border-[rgba(27,24,20,0.12)] rounded-lg bg-surface text-ink outline-none focus:ring-2 focus:ring-kpp/30"
              >
                <option value="">{t("allApl")}</option>
                {aplOptions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* Activity cards */}
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : filtered.length === 0 ? (
          activePeriod && (overview?.activities ?? []).length === 0 ? (
            <p className="text-sm text-ink-3">{t("noData")}</p>
          ) : (
            <div className="flex items-center gap-2 text-aman text-sm font-semibold">
              <CheckCircle2 size={16} />
              {status === "not_ready" ? t("allReady") : t("noMatch")}
            </div>
          )
        ) : (
          filtered.map((act) => (
            <div key={act.activity} className="bg-surface rounded-2xl border border-border overflow-hidden">
              <div className="px-6 py-5 flex items-center gap-6 border-b border-border flex-wrap">
                <div>
                  <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.6px]">{t("activityLabel")}</p>
                  <p className="text-xl font-bold text-ink tracking-tight">{act.activity}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[40px] font-bold leading-none font-mono tnum" style={{ color: pctColor(act.readiness_pct) }}>
                    {act.readiness_pct.toFixed(1)}%
                  </p>
                  <p className="text-[12px] text-ink-3 mt-1">
                    {act.ready}/{act.total} {t("ready")}
                  </p>
                </div>
              </div>

              {/* Per APL ACTIVITY */}
              <div className="divide-y divide-border">
                {act.rows.map((a) => (
                  <div key={a.apl_activity} className="px-6 py-3 flex items-center gap-4">
                    <span className="text-[13px] font-semibold text-ink flex-1 min-w-0 truncate">{a.apl_activity}</span>
                    <div className="w-[180px] h-2 rounded-full bg-surface-alt overflow-hidden flex-shrink-0">
                      <div className="h-full rounded-full" style={{ width: `${a.pct}%`, background: pctColor(a.pct) }} />
                    </div>
                    <span className="text-[12px] font-mono text-ink-2 w-[110px] text-right flex-shrink-0">
                      {a.ready}/{a.total} · {a.pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
