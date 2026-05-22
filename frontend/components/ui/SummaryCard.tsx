import clsx from "clsx";

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export function SummaryCard({ label, value, sub, accent = "#F5A623", icon, trend, trendValue }: Props) {
  return (
    <div className="bg-surface rounded-lg border border-[rgba(27,24,20,0.08)] p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-ink-2 uppercase tracking-wider truncate">{label}</p>
          <p
            className="text-2xl font-bold mt-0.5 font-mono tnum"
            style={{ color: accent }}
          >
            {value}
          </p>
          {sub && <p className="text-xs text-ink-3 mt-0.5 truncate">{sub}</p>}
        </div>
        {icon && (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: accent + "20" }}
          >
            <span style={{ color: accent }}>{icon}</span>
          </div>
        )}
      </div>
      {trend && trendValue && (
        <div className="flex items-center gap-1">
          <span
            className={clsx(
              "text-xs font-semibold",
              trend === "up" && "text-aman-text",
              trend === "down" && "text-warning-text",
              trend === "neutral" && "text-ink-3"
            )}
          >
            {trend === "up" && "↑"}
            {trend === "down" && "↓"}
            {trendValue}
          </span>
        </div>
      )}
    </div>
  );
}
