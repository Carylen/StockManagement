interface Props {
  rtt: number;
  min: number;
  max: number;
  height?: number;
  showLabels?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  WARNING: "#EF4444",
  AMAN:    "#22C55E",
  OVER:    "#F59E0B",
  MAX:     "#3B82F6",
};

function getStatus(rtt: number, min: number, max: number): string {
  if (rtt < min) return "WARNING";
  if (rtt > max) return "OVER";
  if (rtt === max) return "MAX";
  return "AMAN";
}

export function StockGauge({ rtt, min, max, height = 10, showLabels = false }: Props) {
  const range = Math.max(max * 1.3, rtt * 1.1, 1);
  const minPct = Math.min((min / range) * 100, 100);
  const maxPct = Math.min((max / range) * 100, 100);
  const rttPct = Math.min((rtt / range) * 100, 100);
  const status = getStatus(rtt, min, max);
  const fill = STATUS_COLOR[status];

  return (
    <div className="w-full">
      {showLabels && (
        <div className="relative mb-1" style={{ height: 16 }}>
          <span
            className="absolute text-[9px] font-semibold text-ink-2 font-mono transform -translate-x-1/2"
            style={{ left: `${minPct}%` }}
          >
            MIN
          </span>
          <span
            className="absolute text-[9px] font-semibold text-ink-2 font-mono transform -translate-x-1/2"
            style={{ left: `${maxPct}%` }}
          >
            MAX
          </span>
        </div>
      )}
      <div
        className="relative w-full rounded-full overflow-visible"
        style={{ height, background: "#F5EFE1" }}
      >
        {/* MIN–MAX zone highlight */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: `${minPct}%`,
            width: `${maxPct - minPct}%`,
            background: "#FFF1D0",
          }}
        />
        {/* RTT fill */}
        <div
          className="absolute top-0 left-0 bottom-0 rounded-full transition-all duration-300"
          style={{ width: `${rttPct}%`, background: fill, opacity: 0.92 }}
        />
        {/* MIN marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5"
          style={{ left: `${minPct}%`, background: "rgba(27,24,20,0.35)" }}
        />
        {/* MAX marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5"
          style={{ left: `${maxPct}%`, background: "rgba(27,24,20,0.35)" }}
        />
      </div>
      {showLabels && (
        <div className="relative mt-1" style={{ height: 16 }}>
          <span
            className="absolute text-[9px] font-bold font-mono transform -translate-x-1/2"
            style={{ left: `${rttPct}%`, color: fill }}
          >
            ● {rtt}
          </span>
        </div>
      )}
    </div>
  );
}
