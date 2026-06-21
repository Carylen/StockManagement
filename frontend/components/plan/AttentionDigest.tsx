"use client";

import { useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AlertTriangle, Clock, PackageSearch, GitBranch, CalendarClock, Inbox, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import type { AttentionResponse, AttentionItem, AttentionType } from "@/lib/types";

const TYPE_ICON: Record<AttentionType, LucideIcon> = {
  NEEDS_REVISION: AlertTriangle,
  UNREAD_SUPPLIER_UPDATE: Inbox,
  UNFILLED_ITEMS: PackageSearch,
  UNREAD_PLANNER_REVISION: Inbox,
  EVENT_NEARING_LOCK: CalendarClock,
  EXTRA_ITEMS_PENDING: GitBranch,
};

const TYPE_COLOR: Record<AttentionType, string> = {
  NEEDS_REVISION: "#DC2626",
  UNREAD_SUPPLIER_UPDATE: "#D97706",
  UNFILLED_ITEMS: "#D97706",
  UNREAD_PLANNER_REVISION: "#D97706",
  EVENT_NEARING_LOCK: "#DC2626",
  EXTRA_ITEMS_PENDING: "#5B5BD6",
};

const VISIBLE_COUNT = 5;

function ItemRow({ item, label }: { item: AttentionItem; label: string }) {
  const Icon = TYPE_ICON[item.type];
  const color = TYPE_COLOR[item.type];
  return (
    <Link
      href={item.link}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-alt/60 transition-colors"
    >
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}1A`, color }}
      >
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-ink truncate">{label}</p>
        <p className="text-[11px] text-ink-3 truncate">
          {item.period_name} · {item.site}{item.apl_activity ? ` · ${item.apl_activity}` : ""}
        </p>
      </div>
      {item.count != null && (
        <span className="text-[10px] font-bold leading-none px-1.5 py-1 rounded-full bg-coral text-white flex-shrink-0">
          {item.count}
        </span>
      )}
      {item.days_remaining != null && (
        <span className="text-[10px] font-mono text-ink-3 flex-shrink-0 flex items-center gap-1">
          <Clock size={10} /> {item.days_remaining}d
        </span>
      )}
    </Link>
  );
}

/** Top-priority cross-role digest (DELTA3 section C) — purely aggregates
 * already-existing collaboration/readiness signals via GET /attention. */
export function AttentionDigest() {
  const t = useTranslations("attention");
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useSWR<AttentionResponse>(
    "/scheduled-plans/attention",
    (u: string) => api.get<AttentionResponse>(u)
  );

  const items = data?.items ?? [];
  if (isLoading || items.length === 0) return null;

  const shown = expanded ? items : items.slice(0, VISIBLE_COUNT);

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3">{t("title")}</p>
      </div>
      <div className="divide-y divide-border/60">
        {shown.map((item, i) => (
          <ItemRow key={`${item.type}-${item.period_id}-${item.apl_activity ?? ""}-${i}`} item={item} label={t(item.type)} />
        ))}
      </div>
      {items.length > VISIBLE_COUNT && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full px-4 py-2 text-[11.5px] font-semibold text-kpp hover:bg-surface-alt/60 transition-colors"
        >
          {expanded ? t("showLess") : t("seeAll", { count: items.length })}
        </button>
      )}
    </div>
  );
}
