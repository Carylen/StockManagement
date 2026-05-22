import clsx from "clsx";

interface BarProps {
  label: string;
  pct: number;
  color: string;
  bg: string;
}

function Bar({ label, pct, color, bg }: BarProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-ink-2 w-8 flex-shrink-0">{label}</span>
      <div className="flex-1 rounded-full overflow-hidden h-2.5" style={{ background: bg }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold font-mono tnum w-10 text-right" style={{ color }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

interface Props {
  oh_pct: number;
  min_pct: number;
  fb_pct: number;
  className?: string;
}

export function ReadynessBar({ oh_pct, min_pct, fb_pct, className }: Props) {
  return (
    <div className={clsx("flex flex-col gap-2.5", className)}>
      <Bar label="OH%" pct={oh_pct} color="#1B1814" bg="#E8E0D0" />
      <Bar label="MIN%" pct={min_pct} color="#22C55E" bg="#DCFCE7" />
      <Bar label="FB%" pct={fb_pct} color="#F5A623" bg="#FFF1D0" />
    </div>
  );
}
