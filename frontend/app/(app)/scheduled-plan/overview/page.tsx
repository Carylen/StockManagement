"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { CalendarCheck, CheckCircle2, ChevronRight, Plus, Search, Upload, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Skeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { EventCountdownBanner } from "@/components/plan/EventCountdownBanner";
import { LineNotesThread } from "@/components/plan/LineNotesThread";
import { TrendChart } from "@/components/plan/TrendChart";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { useAuth } from "@/lib/auth";
import type {
  PlanPeriod, PlanOverview, PlanAplStat, PaginatedPlanLines,
  PlanEventCreateResult, PlanMergeResult, TrendResponse, ProposeDateResponse,
} from "@/lib/types";

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
  const tSearch = useTranslations("lineSearch");
  const tNotes = useTranslations("planNotes");
  const { user } = useAuth();
  const { ready } = usePermissionGuard(({ can }) => can("can_view_plan_achievement"), "/dashboard");
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [apl, setApl] = useState<string>("");
  const [activityFilter, setActivityFilter] = useState<string>("");
  const [expandedApl, setExpandedApl] = useState<string | null>(null);

  // Deep-link from the attention digest: /scheduled-plan/overview?period=...&apl=...
  useEffect(() => {
    const period = searchParams.get("period");
    if (period) setSelected(period);
    const aplParam = searchParams.get("apl");
    if (aplParam) setApl(aplParam);
  }, [searchParams]);
  const [eventFilter, setEventFilter] = useState<string>("");

  // Feature 6: cross-line search
  const [searchRaw, setSearchRaw] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((v: string) => {
    setSearchRaw(v);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearchQ(v), 300);
  }, []);

  // Feature 3: propose-date modal
  const tProp = useTranslations("proposeDate");
  const [proposingApl, setProposingApl] = useState<string | null>(null);
  const [proposeDate, setProposeDate] = useState("");
  const [proposeNote, setProposeNote] = useState("");
  const [proposePreview, setProposePreview] = useState<ProposeDateResponse | null>(null);
  const [proposeStep, setProposeStep] = useState<"form" | "preview">("form");
  const [proposing, setProposing] = useState(false);
  const [includeExtra, setIncludeExtra] = useState(true);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  // Create-event modal (name + dates + baseline file, one atomic call)
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newDue, setNewDue] = useState("");
  const createFileRef = useRef<HTMLInputElement>(null);

  // Add-to-baseline modal (file only, into the active event)
  const [showBaseline, setShowBaseline] = useState(false);
  const [addingBaseline, setAddingBaseline] = useState(false);
  const baselineFileRef = useRef<HTMLInputElement>(null);

  const { data: periods, isLoading: loadingPeriods, mutate: mutatePeriods } =
    useSWR<PlanPeriod[]>("/scheduled-plans/periods", (u: string) => api.get<PlanPeriod[]>(u));

  const eventOptions = useMemo(
    () => Array.from(new Set((periods ?? []).map((p) => p.name))).sort(),
    [periods]
  );
  const shownPeriods = useMemo(
    () => (periods ?? []).filter((p) => !eventFilter || p.name === eventFilter),
    [periods, eventFilter]
  );

  const activePeriod = selected ?? periods?.[0]?.period_id ?? null;

  const { data: overview, isLoading } = useSWR<PlanOverview>(
    activePeriod ? `/scheduled-plans/overview?period_id=${activePeriod}` : null,
    (u: string) => api.get<PlanOverview>(u)
  );

  // Distinct apl_activity values for the dropdown — narrowed to the selected
  // Activity, if any, so the two filters stay consistent.
  const aplOptions = useMemo(() => {
    const set = new Set<string>();
    for (const act of overview?.activities ?? []) {
      if (activityFilter && act.activity !== activityFilter) continue;
      for (const a of act.apl_activities) set.add(a.apl_activity);
    }
    return Array.from(set).sort();
  }, [overview, activityFilter]);

  // Distinct activity values (OVERHAUL/MIDLIFE/MANDATORY/...) for the dropdown —
  // whatever activities actually exist in this period's data, not a hardcoded list.
  const activityOptions = useMemo(
    () => Array.from(new Set((overview?.activities ?? []).map((act) => act.activity))).sort(),
    [overview]
  );

  // Activities with their apl_activities narrowed by both filters; empty ones dropped.
  const filtered = useMemo(() => {
    return (overview?.activities ?? [])
      .filter((act) => !activityFilter || act.activity === activityFilter)
      .map((act) => ({
        ...act,
        rows: act.apl_activities.filter(
          (a) => matchStatus(a, status) && (!apl || a.apl_activity === apl)
        ),
      }))
      .filter((act) => act.rows.length > 0);
  }, [overview, status, apl, activityFilter]);

  const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
    { value: "all",       label: t("statusAll") },
    { value: "ready",     label: t("statusReady") },
    { value: "not_ready", label: t("statusNotReady") },
  ];

  // ── Item-level lines: also used for search (Feature 6), notes (Feature 1),
  // lateness table, and EXTRA section. include_extra always true here.
  const linesUrl = useMemo(() => {
    if (!activePeriod) return null;
    const params = new URLSearchParams({ limit: "500", include_extra: "true" });
    if (searchQ) params.set("q", searchQ);
    return `/scheduled-plans/periods/${activePeriod}/lines?${params}`;
  }, [activePeriod, searchQ]);

  const { data: lines, mutate: mutateLines } = useSWR<PaginatedPlanLines>(
    linesUrl,
    (u: string) => api.get<PaginatedPlanLines>(u)
  );

  // Feature 7: trend data for the active period's site + activity — follows
  // the Activity filter when one is selected, otherwise falls back to the
  // period's first activity.
  const activeMeta = (periods ?? []).find((p) => p.period_id === activePeriod);
  const trendActivity = activityFilter || overview?.activities?.[0]?.activity || null;
  const { data: trend, mutate: mutateTrend } = useSWR<TrendResponse>(
    activeMeta && trendActivity
      ? `/scheduled-plans/trend?activity=${trendActivity}&site=${activeMeta.site}&last_n_periods=6`
      : null,
    (u: string) => api.get<TrendResponse>(u),
  );


  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Overdue = official baseline lateness only — EXTRA items were never agreed,
  // so they don't count as a missed commitment.
  const overdueItems = useMemo(() => {
    return (lines?.items ?? [])
      .filter((l) => l.origin === "BASELINE" && !l.removed_in_revision && (!apl || l.apl_activity === apl))
      .filter((l) => (!l.is_ready && l.req_date != null && l.req_date < todayStr) || l.needs_planner_revision)
      .sort((a, b) => a.apl_activity.localeCompare(b.apl_activity) || (a.req_date ?? "").localeCompare(b.req_date ?? ""));
  }, [lines, apl, todayStr]);

  // Items planners added beyond the agreed baseline — admin-only visibility.
  const extraItems = useMemo(() => {
    if (!includeExtra) return [];
    return (lines?.items ?? [])
      .filter((l) => l.origin === "EXTRA" && !l.removed_in_revision && (!apl || l.apl_activity === apl))
      .sort((a, b) => a.apl_activity.localeCompare(b.apl_activity));
  }, [lines, apl, includeExtra]);

  const daysLate = (reqDate: string) =>
    Math.max(0, Math.floor((Date.parse(todayStr) - Date.parse(reqDate)) / 86400000));

  const handleCreateEvent = async () => {
    const file = createFileRef.current?.files?.[0];
    if (!newName.trim() || !newStart || !newDue || !file) {
      setToast({ msg: t("createMissingFields"), kind: "err" });
      return;
    }
    setCreating(true);
    try {
      const result = await api.uploadFile<PlanEventCreateResult>("/scheduled-plans/periods", file, {
        name: newName.trim(), start_date: newStart, due_date: newDue,
      });
      setToast({ msg: t("createSuccess", { inserted: result.merge.rows_inserted }), kind: "ok" });
      setShowCreate(false);
      setNewName(""); setNewStart(""); setNewDue("");
      mutatePeriods();
      setSelected(result.period.period_id);
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("createFailed"), kind: "err" });
    } finally {
      setCreating(false);
    }
  };

  const handleBaselineUpload = async () => {
    const file = baselineFileRef.current?.files?.[0];
    if (!file || !activePeriod) return;
    setAddingBaseline(true);
    try {
      const result = await api.uploadFile<PlanMergeResult>(
        `/scheduled-plans/periods/${activePeriod}/baseline-upload`, file
      );
      setToast({ msg: t("baselineAddSuccess", { inserted: result.rows_inserted, updated: result.rows_updated }), kind: "ok" });
      setShowBaseline(false);
      mutatePeriods();
      mutateLines();
      mutateTrend();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("baselineAddFailed"), kind: "err" });
    } finally {
      setAddingBaseline(false);
    }
  };

  const handleProposePreview = async () => {
    if (!proposeDate || !proposingApl || !activePeriod) return;
    setProposing(true);
    try {
      const res = await api.post<ProposeDateResponse>(
        `/scheduled-plans/periods/${activePeriod}/propose-date`,
        { apl_activity: proposingApl, proposed_date: proposeDate, note: proposeNote || null, dry_run: true },
      );
      setProposePreview(res);
      setProposeStep("preview");
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : tProp("failed"), kind: "err" });
    } finally {
      setProposing(false);
    }
  };

  const handleProposeConfirm = async () => {
    if (!proposeDate || !proposingApl || !activePeriod) return;
    setProposing(true);
    try {
      const res = await api.post<ProposeDateResponse>(
        `/scheduled-plans/periods/${activePeriod}/propose-date`,
        { apl_activity: proposingApl, proposed_date: proposeDate, note: proposeNote || null },
      );
      setToast({ msg: tProp("success", { no: res.revision_no, count: res.updated_count }), kind: "ok" });
      setProposingApl(null); setProposeDate(""); setProposeNote(""); setProposeStep("form"); setProposePreview(null);
      mutateLines();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : tProp("failed"), kind: "err" });
    } finally {
      setProposing(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="min-h-full">
      <Toast message={toast?.msg ?? null} kind={toast?.kind} onDismiss={() => setToast(null)} />
      <Topbar title={t("title")} subtitle={t("subtitle")} />

      {/* Feature 3: Propose-date modal */}
      <Modal
        open={!!proposingApl}
        onClose={() => { setProposingApl(null); setProposeStep("form"); setProposePreview(null); setProposeDate(""); setProposeNote(""); }}
        title={proposingApl ? tProp("title", { apl: proposingApl }) : ""}
      >
        {proposeStep === "form" ? (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-[0.6px] mb-1.5">{tProp("dateLabel")}</label>
              <input type="date" value={proposeDate} onChange={(e) => setProposeDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-bg" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-[0.6px] mb-1.5">{tProp("noteLabel")}</label>
              <input value={proposeNote} onChange={(e) => setProposeNote(e.target.value)}
                placeholder={tProp("notePlaceholder")}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-kpp bg-bg" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setProposingApl(null)}
                className="px-4 py-2.5 text-sm font-semibold text-ink rounded-xl hover:bg-surface-alt transition-colors">
                {tProp("cancel")}
              </button>
              <button type="button" onClick={handleProposePreview} disabled={!proposeDate || proposing}
                className="flex items-center gap-2 px-5 py-2.5 bg-kpp text-white font-bold text-sm rounded-xl disabled:opacity-60 hover:brightness-110 transition-all">
                {proposing ? tProp("submitting") : tProp("confirm")}
              </button>
            </div>
          </div>
        ) : proposePreview && (
          <div className="p-6 space-y-4">
            <p className="text-[12px] font-bold text-ink-3 uppercase tracking-[0.6px]">{tProp("previewTitle")}</p>
            {proposePreview.lines.filter((l) => l.was_ready).length > 0 && (
              <div className="px-3 py-2 rounded-xl bg-warning-bg text-warning text-[12px] font-semibold">
                {tProp("readyWarning", { count: proposePreview.lines.filter((l) => l.was_ready).length })}
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border border-border max-h-[320px] overflow-y-auto">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-surface text-[10px] uppercase tracking-wider text-ink-3">
                    <th className="text-left px-3 py-2">{tProp("colUnit")}</th>
                    <th className="text-left px-3 py-2">{tProp("colNpn")}</th>
                    <th className="text-left px-3 py-2">{tProp("colOldDate")}</th>
                    <th className="text-left px-3 py-2">{tProp("colNewDate")}</th>
                    <th className="text-left px-3 py-2">{tProp("colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {proposePreview.lines.map((l) => (
                    <tr key={l.line_id} className="border-t border-border">
                      <td className="px-3 py-1.5 font-mono text-ink-2">{l.egi} · {l.cn}</td>
                      <td className="px-3 py-1.5 font-mono font-bold text-ink">{l.npn}</td>
                      <td className="px-3 py-1.5 text-ink-3">{l.old_req_date ?? "—"}</td>
                      <td className="px-3 py-1.5 text-kpp font-semibold">{l.new_req_date}</td>
                      <td className="px-3 py-1.5">
                        {l.was_ready && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-aman-bg text-aman">{tProp("wasReady")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setProposeStep("form"); setProposePreview(null); }}
                className="px-4 py-2.5 text-sm font-semibold text-ink rounded-xl hover:bg-surface-alt transition-colors">
                {tProp("cancel")}
              </button>
              <button type="button" onClick={handleProposeConfirm} disabled={proposing}
                className="flex items-center gap-2 px-5 py-2.5 bg-kpp text-white font-bold text-sm rounded-xl disabled:opacity-60 hover:brightness-110 transition-all">
                <CalendarCheck size={14} /> {proposing ? tProp("submitting") : tProp("confirm")}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create event — admin sets the dates manually + uploads the agreed baseline */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t("createEventTitle")}>
        <div className="p-6 space-y-4">
          <p className="text-[12px] text-ink-3">{t("createEventDesc", { site: user?.site ?? "" })}</p>
          <div>
            <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-[0.6px] mb-1.5">{t("eventNameLabel")}</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("eventNamePlaceholder")}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-kpp bg-bg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-[0.6px] mb-1.5">{t("startDateLabel")}</label>
              <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-bg" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-[0.6px] mb-1.5">{t("dueDateLabel")}</label>
              <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-bg" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-ink-3 uppercase tracking-[0.6px] mb-1.5">{t("baselineFileLabel")}</label>
            <input ref={createFileRef} type="file" accept=".xlsx,.xls" className="w-full text-[13px]" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)}
              className="px-4 py-2.5 text-sm font-semibold text-ink rounded-xl hover:bg-surface-alt transition-colors">
              {t("cancel")}
            </button>
            <button type="button" onClick={handleCreateEvent} disabled={creating}
              className="flex items-center gap-2 px-5 py-2.5 bg-kpp text-white font-bold text-sm rounded-xl disabled:opacity-60 hover:brightness-110 transition-all">
              <Upload size={14} /> {creating ? t("creating") : t("createEventSubmit")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add more to the active event's baseline */}
      <Modal open={showBaseline} onClose={() => setShowBaseline(false)} title={t("baselineAddTitle")}>
        <div className="p-6 space-y-4">
          <p className="text-[12px] text-ink-3">{t("baselineAddDesc")}</p>
          <input ref={baselineFileRef} type="file" accept=".xlsx,.xls" className="w-full text-[13px]" />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowBaseline(false)}
              className="px-4 py-2.5 text-sm font-semibold text-ink rounded-xl hover:bg-surface-alt transition-colors">
              {t("cancel")}
            </button>
            <button type="button" onClick={handleBaselineUpload} disabled={addingBaseline}
              className="flex items-center gap-2 px-5 py-2.5 bg-kpp text-white font-bold text-sm rounded-xl disabled:opacity-60 hover:brightness-110 transition-all">
              <Upload size={14} /> {addingBaseline ? t("creating") : t("baselineAddSubmit")}
            </button>
          </div>
        </div>
      </Modal>

      <div className="p-6 pb-20 flex flex-col gap-5">
        {/* Period picker */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loadingPeriods ? (
            <Skeleton className="h-16 w-52 col-span-full" />
          ) : shownPeriods.length === 0 ? (
            <p className="text-sm text-ink-3 col-span-full">{t("noPeriods")}</p>
          ) : (
            shownPeriods.map((p) => {
              const isActive = p.period_id === activePeriod;
              const isOverdue = p.state === "LOCKED" && p.readiness_pct != null && p.readiness_pct < 100;
              return (
                <button
                  key={p.period_id}
                  onClick={() => { setSelected(p.period_id); setApl(""); setActivityFilter(""); }}
                  className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                    isActive ? "bg-kpp-soft border-kpp" : "bg-surface border-border hover:bg-surface-alt"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-ink">{p.name} · {p.site}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      isOverdue
                        ? "bg-warning-bg text-warning"
                        : p.state === "OPEN" ? "bg-aman-bg text-aman" : "bg-surface-alt text-ink-3"
                    }`}>
                      {isOverdue ? t("overdue") : p.state}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-3 mt-1">{p.start_date} → {p.due_date}</div>
                </button>
              );
            })
          )}
        </div>

        {/* Feature 5: countdown banner for active period */}
        {activeMeta && <EventCountdownBanner period={activeMeta} />}

        {/* Filter bar — event / status / apl_activity dropdowns + actions */}
        <div className="bg-surface rounded-xl border border-border px-4 py-3.5 flex flex-wrap items-center gap-x-5 gap-y-3">
          {activePeriod && eventOptions.length > 1 && (
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-ink-3">{t("filterEventLabel")}</span>
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="px-3 py-1.5 text-[12.5px] font-semibold border border-[rgba(27,24,20,0.12)] rounded-lg bg-surface text-ink outline-none focus:ring-2 focus:ring-kpp/30"
              >
                <option value="">{t("allEvents")}</option>
                {eventOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          )}

          {activePeriod && activityOptions.length > 1 && (
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-ink-3">{t("filterActivityLabel")}</span>
              <select
                value={activityFilter}
                onChange={(e) => { setActivityFilter(e.target.value); setApl(""); }}
                className="px-3 py-1.5 text-[12.5px] font-semibold border border-[rgba(27,24,20,0.12)] rounded-lg bg-surface text-ink outline-none focus:ring-2 focus:ring-kpp/30"
              >
                <option value="">{t("allActivities")}</option>
                {activityOptions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
          )}

          {activePeriod && (
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-ink-3">{t("filterStatusLabel")}</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                className="px-3 py-1.5 text-[12.5px] font-semibold border border-[rgba(27,24,20,0.12)] rounded-lg bg-surface text-ink outline-none focus:ring-2 focus:ring-kpp/30"
              >
                {STATUS_CHIPS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
          )}

          {activePeriod && (
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
          )}

          {activePeriod && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeExtra} onChange={(e) => setIncludeExtra(e.target.checked)} />
              <span className="text-[12px] font-semibold text-ink-2">{t("showExtraToggle")}</span>
            </label>
          )}

          {/* Feature 6: cross-line search */}
          {activePeriod && (
            <div className="relative flex items-center">
              <Search size={12} className="absolute left-2.5 text-ink-3 pointer-events-none" />
              <input
                value={searchRaw}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={tSearch("placeholder")}
                className="pl-7 pr-7 py-1.5 text-[12px] border border-border rounded-lg bg-bg focus:outline-none focus:border-kpp w-52"
              />
              {searchRaw && (
                <button onClick={() => { setSearchRaw(""); setSearchQ(""); }}
                  className="absolute right-2 text-ink-3 hover:text-ink">
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {activePeriod && (
              <button onClick={() => setShowBaseline(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-bold transition-colors"
                style={{ background: "var(--c-kpp)", color: "#fff" }}>
                <Plus size={13} /> {t("baselineAddTitle")}
              </button>
            )}
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-ink text-white text-[12px] font-bold rounded-lg hover:bg-ink/80 transition-colors">
              <Plus size={13} /> {t("createEventTitle")}
            </button>
          </div>
        </div>

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

              {/* Per APL ACTIVITY — click a row to expand its line items inline */}
              <div className="divide-y divide-border">
                {act.rows.map((a) => {
                  const rowKey = `${act.activity}__${a.apl_activity}`;
                  const isExpanded = expandedApl === rowKey;
                  const aplLines = (lines?.items ?? []).filter(
                    (l) => l.activity === act.activity && l.apl_activity === a.apl_activity && !l.removed_in_revision
                  );
                  return (
                    <div key={a.apl_activity}>
                      <div className="w-full px-6 py-3 flex items-center gap-4 hover:bg-surface-alt/50 transition-colors">
                        <button
                          type="button"
                          onClick={() => setExpandedApl(isExpanded ? null : rowKey)}
                          className="flex items-center gap-4 flex-1 min-w-0 text-left"
                        >
                          <ChevronRight
                            size={14}
                            className={`text-ink-3 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          />
                          <span className="text-[13px] font-semibold text-ink flex-1 min-w-0 truncate">{a.apl_activity}</span>
                          <div className="w-[180px] h-2 rounded-full bg-surface-alt overflow-hidden flex-shrink-0">
                            <div className="h-full rounded-full" style={{ width: `${a.pct}%`, background: pctColor(a.pct) }} />
                          </div>
                          <span className="text-[12px] font-mono text-ink-2 w-[110px] text-right flex-shrink-0">
                            {a.ready}/{a.total} · {a.pct.toFixed(1)}%
                          </span>
                        </button>
                        {/* Feature 3: Propose date per APL ACTIVITY (OPEN events only) */}
                        {activeMeta?.state === "OPEN" && (
                          <button
                            type="button"
                            onClick={() => { setProposingApl(a.apl_activity); setProposeStep("form"); setProposePreview(null); }}
                            className="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold text-kpp hover:text-kpp/80 px-2 py-1 rounded-lg hover:bg-kpp-soft transition-colors"
                          >
                            <CalendarCheck size={12} /> {tProp("btnLabel")}
                          </button>
                        )}
                      </div>
                      {isExpanded && (
                        <div className="px-6 pb-4 bg-bg/40">
                          {aplLines.length === 0 ? (
                            <p className="text-[12px] text-ink-3 py-3">
                              {searchQ ? tSearch("noResults") : t("noLines")}
                            </p>
                          ) : (
                            <div className="overflow-x-auto rounded-lg border border-border mt-1">
                              <table className="w-full text-[12.5px] border-collapse">
                                <thead>
                                  <tr className="bg-surface text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                                    <th className="text-left px-3 py-2">{t("colNpn")}</th>
                                    <th className="text-left px-3 py-2">{t("colDesc")}</th>
                                    <th className="text-right px-3 py-2">{t("colQty")}</th>
                                    <th className="text-left px-3 py-2">{t("colStatus")}</th>
                                    <th className="text-left px-3 py-2">{t("colLocation")}</th>
                                    <th className="text-left px-3 py-2">{t("colEstDate")}</th>
                                    <th className="text-left px-3 py-2">{t("colReqDate")}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {aplLines.map((l) => (
                                    <tr key={l.id} className="border-t border-border align-top">
                                      <td className="px-3 py-2 font-mono font-bold text-ink">
                                        {l.npn}
                                        {l.origin === "EXTRA" && (
                                          <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-over-bg text-over align-middle">
                                            EXTRA
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-ink-2">{l.description ?? "—"}</td>
                                      <td className="px-3 py-2 text-right font-mono tabular-nums">{l.req_qty}</td>
                                      <td className="px-3 py-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                          l.is_ready ? "bg-aman-bg text-aman" : "bg-warning-bg text-warning"
                                        }`}>
                                          {l.is_ready ? t("statusReady") : t("statusNotReady")}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-ink-2">{l.ut_location ?? "—"}</td>
                                      <td className="px-3 py-2 font-mono text-ink">
                                        {l.est_date ? format(parseISO(l.est_date), "d MMM yyyy") : "—"}
                                      </td>
                                      <td className="px-3 py-2 font-mono text-ink">
                                        {l.req_date ? format(parseISO(l.req_date), "d MMM yyyy") : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {/* Feature 1: per-line notes for each line in this APL group */}
                          {aplLines.map((l) => (
                            <div key={`notes-${l.id}`} className="mt-3 border-t border-border pt-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-3 mb-1">
                                {tNotes("title")} · <span className="font-mono">{l.npn}</span>
                              </p>
                              <LineNotesThread
                                lineId={l.id}
                                currentUserId={user?.id ?? null}
                                isAdmin={true}
                                canWrite={true}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Overdue Items — line-level lateness, scoped to the active period + apl filter */}
        {activePeriod && (
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="px-6 py-5 border-b border-border">
              <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.6px]">{t("overdueItemsTitle")}</p>
              <p className="text-[12px] text-ink-3 mt-1">{t("overdueItemsDesc")}</p>
            </div>
            {overdueItems.length === 0 ? (
              <div className="py-10 flex items-center justify-center gap-2 text-aman text-sm font-semibold">
                <CheckCircle2 size={16} /> {t("noOverdueItems")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-bg text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                      <th className="text-left px-6 py-2.5">{t("colApl")}</th>
                      <th className="text-left px-4 py-2.5">{t("colNpn")}</th>
                      <th className="text-left px-4 py-2.5">{t("colDesc")}</th>
                      <th className="text-left px-4 py-2.5">{t("colReqDate")}</th>
                      <th className="text-left px-6 py-2.5">{t("colReason")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueItems.map((l) => {
                      const isLate = !l.is_ready && l.req_date != null && l.req_date < todayStr;
                      return (
                        <tr key={l.id} className="border-t border-border hover:bg-surface-alt/40">
                          <td className="px-6 py-2.5 text-ink-2">{l.apl_activity}</td>
                          <td className="px-4 py-2.5 font-mono font-bold text-ink">{l.npn}</td>
                          <td className="px-4 py-2.5 text-ink-2 max-w-[220px] truncate">{l.description ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            {l.req_date ? (
                              <span className={isLate ? "text-warning font-semibold" : "text-ink"}>
                                {l.req_date}
                                {isLate && <span className="text-ink-3 font-normal"> · {t("daysLate", { count: daysLate(l.req_date) })}</span>}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-6 py-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isLate && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning-bg text-warning">
                                  {t("reasonOverdue")}
                                </span>
                              )}
                              {l.needs_planner_revision && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-over-bg text-over">
                                  {t("reasonNeedsRevision")}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Feature 7: readiness trend chart — labeled with its activity once
            a period has more than one, since trendActivity now follows the
            Activity filter instead of always the first one. */}
        {trend && trend.periods.length >= 2 && (
          <div className="bg-surface rounded-2xl border border-border px-6 py-5">
            {activityOptions.length > 1 && trendActivity && (
              <p className="text-[11px] font-semibold text-ink-3 mb-2">
                {t("trendForActivity", { activity: trendActivity })}
              </p>
            )}
            <TrendChart periods={trend.periods} />
          </div>
        )}

        {/* EXTRA — items planners added outside the agreed baseline. Admin-only;
            the planner who added them sees their own too (their working page),
            but never another planner's. */}
        {activePeriod && includeExtra && (
          <div className="bg-surface rounded-2xl border border-over/40 overflow-hidden">
            <div className="px-6 py-5 border-b border-border">
              <p className="text-[11px] font-semibold text-over uppercase tracking-[0.6px]">{t("extraItemsTitle")}</p>
              <p className="text-[12px] text-ink-3 mt-1">{t("extraItemsDesc")}</p>
            </div>
            {extraItems.length === 0 ? (
              <div className="py-10 flex items-center justify-center gap-2 text-ink-3 text-sm font-semibold">
                <CheckCircle2 size={16} /> {t("noExtraItems")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-bg text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                      <th className="text-left px-6 py-2.5">{t("colApl")}</th>
                      <th className="text-left px-4 py-2.5">{t("colNpn")}</th>
                      <th className="text-left px-4 py-2.5">{t("colDesc")}</th>
                      <th className="text-right px-4 py-2.5">{t("colQty")}</th>
                      <th className="text-left px-6 py-2.5">{t("colStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extraItems.map((l) => (
                      <tr key={l.id} className="border-t border-border hover:bg-surface-alt/40">
                        <td className="px-6 py-2.5 text-ink-2">{l.apl_activity}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-ink">{l.npn}</td>
                        <td className="px-4 py-2.5 text-ink-2 max-w-[220px] truncate">{l.description ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{l.req_qty}</td>
                        <td className="px-6 py-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            l.is_ready ? "bg-aman-bg text-aman" : "bg-surface-alt text-ink-3"
                          }`}>
                            {l.is_ready ? t("statusReady") : t("statusNotReady")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
