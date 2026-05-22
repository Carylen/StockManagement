"use client";

import { SummaryCard } from "@/components/ui/SummaryCard";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { AlertTriangle, CheckCircle, TrendingUp, Layers } from "lucide-react";
import type { DashboardSummary } from "@/lib/types";

interface Props {
  data?: DashboardSummary;
  loading: boolean;
}

export function StockSummaryCards({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    {
      label: "Total Parts",
      value: data.total_parts.toLocaleString("id"),
      sub: `Site ${data.site}`,
      accent: "#1B1814",
      icon: <Layers size={18} />,
    },
    {
      label: "WARNING",
      value: data.status_count.WARNING,
      sub: "RTT di bawah MIN",
      accent: "#EF4444",
      icon: <AlertTriangle size={18} />,
    },
    {
      label: "AMAN",
      value: data.status_count.AMAN,
      sub: "Stok dalam range",
      accent: "#22C55E",
      icon: <CheckCircle size={18} />,
    },
    {
      label: "OVER / MAX",
      value: data.status_count.OVER + data.status_count.MAX,
      sub: `OVER: ${data.status_count.OVER} | MAX: ${data.status_count.MAX}`,
      accent: "#F59E0B",
      icon: <TrendingUp size={18} />,
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <SummaryCard key={i} {...c} />
      ))}
    </div>
  );
}
