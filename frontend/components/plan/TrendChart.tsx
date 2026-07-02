"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { TrendPeriodItem, TrendAplStat } from "@/lib/types";

interface Props {
  periods: TrendPeriodItem[];
}

function pctColor(pct: number): string {
  if (pct >= 100) return "#16A34A";
  if (pct >= 60) return "#D97706";
  return "#DC2626";
}

const SVG_W = 1000;
const SVG_H = 140;
// Inset so dots at first/last period aren't clipped by the border.
const X_PAD = 30;

const LINE_COLORS = [
  "#5B5BD6", "#FF7A59", "#D97706", "#DC2626",
  "#7C3AED", "#0369A1", "#BE185D",
];

function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

/** Sparkline-style readiness trend chart. SVG-only, no external deps. */
export function TrendChart({ periods }: Props) {
  const t = useTranslations("trendChart");
  const [breakdown, setBreakdown] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  if (periods.length === 0) return null;

  const n = periods.length;
  const xOf = (i: number) =>
    n === 1 ? SVG_W / 2 : X_PAD + (i * (SVG_W - X_PAD * 2)) / (n - 1);

  // Dynamic Y range: zoom in so small differences are clearly visible.
  const pcts = periods.map((p) => p.readiness_pct);
  const rawMin = Math.min(...pcts);
  const rawMax = Math.max(...pcts);
  const yMin = Math.max(0, rawMin - 15);
  const yMax = Math.min(100, rawMax + 15);
  const yRange = yMax - yMin || 1;
  const yMid = (yMin + yMax) / 2;

  const toY = (pct: number) =>
    (SVG_H * (1 - (pct - yMin) / yRange)).toFixed(1);

  const mainPoints = periods.map((p, i) => ({
    x: xOf(i),
    y: parseFloat(toY(p.readiness_pct)),
  }));

  const aplSet = new Set<string>();
  for (const p of periods) for (const b of p.breakdown) aplSet.add(b.apl_activity);
  const apls = Array.from(aplSet);

  const aplLines = apls.map((apl, ci) => ({
    apl,
    color: LINE_COLORS[ci % LINE_COLORS.length],
    points: periods.map((p, i) => {
      const b = p.breakdown.find((x: TrendAplStat) => x.apl_activity === apl);
      return { x: xOf(i), y: parseFloat(toY(b?.pct ?? 0)) };
    }),
  }));

  const hoveredPeriod = hovered !== null ? periods[hovered] : null;

  // X_PAD as % of SVG_W — used to pad the HTML label row so labels align with dots.
  const xPadPct = `${((X_PAD / SVG_W) * 100).toFixed(1)}%`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-ink-3">
          {t("title")}
        </span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={breakdown}
            onChange={(e) => setBreakdown(e.target.checked)}
          />
          <span className="text-[11px] text-ink-2">{t("breakdownToggle")}</span>
        </label>
      </div>

      {/* Chart area: Y-axis column + SVG + X-axis row */}
      <div className="flex items-stretch gap-1">
        {/* Y-axis labels — HTML so font size is never distorted by SVG scaling */}
        <div
          className="flex flex-col justify-between text-right shrink-0 w-8 pb-5"
          aria-hidden="true"
        >
          <span className="text-[10px] text-ink-3 leading-none">{yMax.toFixed(0)}%</span>
          <span className="text-[10px] text-ink-3 leading-none">{yMid.toFixed(0)}%</span>
          <span className="text-[10px] text-ink-3 leading-none">{yMin.toFixed(0)}%</span>
        </div>

        {/* SVG + X-axis labels */}
        <div className="relative flex-1 min-w-0">
          {/*
            preserveAspectRatio="none" lets the SVG fill the full container width.
            vectorEffect="non-scaling-stroke" on every stroked element keeps stroke
            widths in screen pixels regardless of the X/Y scale ratio.
            SVG_W=1000 keeps X-scale ≈ 1–1.5× so circle geometry stays near-round.
          */}
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            preserveAspectRatio="none"
            className="w-full border border-border rounded-xl bg-surface"
            style={{ height: SVG_H, display: "block" }}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Y gridlines at top / mid / bottom of the dynamic range */}
            {[yMin, yMid, yMax].map((pct) => (
              <line
                key={pct}
                x1={0} y1={toY(pct)} x2={SVG_W} y2={toY(pct)}
                stroke="#e5e7eb"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* Main line (overall readiness) */}
            {!breakdown && (
              <path
                d={buildPath(mainPoints)}
                fill="none"
                stroke="#1F6F4C"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Breakdown lines — open period shown via hollow dot, not dashes */}
            {breakdown &&
              aplLines.map((al) => (
                <path
                  key={al.apl}
                  d={buildPath(al.points)}
                  fill="none"
                  stroke={al.color}
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

            {/* Data points */}
            {mainPoints.map((pt, i) => {
              const p = periods[i];
              const isOpen = p.state === "OPEN";
              return (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r="5"
                  fill={isOpen ? "#fff" : pctColor(p.readiness_pct)}
                  stroke={pctColor(p.readiness_pct)}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHovered(i)}
                />
              );
            })}
          </svg>

          {/* X-axis labels — HTML to avoid SVG font-size distortion */}
          <div
            className="flex justify-between mt-1"
            style={{ paddingLeft: xPadPct, paddingRight: xPadPct }}
          >
            {periods.map((p, i) => (
              <span
                key={i}
                className="text-[10px] text-ink-3 leading-none truncate text-center"
                style={{ maxWidth: n > 1 ? `${Math.floor(85 / n)}%` : "100%" }}
              >
                {p.label}
              </span>
            ))}
          </div>

          {/* Hover tooltip */}
          {hoveredPeriod && (
            <div className="absolute top-2 right-2 bg-surface border border-border rounded-xl px-3 py-2 text-[11px] shadow-sm min-w-[140px] z-10">
              <p className="font-bold text-ink mb-1">{hoveredPeriod.label}</p>
              <p className="font-mono text-ink-2">
                {hoveredPeriod.readiness_pct.toFixed(1)}% · {hoveredPeriod.ready}/
                {hoveredPeriod.total}
              </p>
              {hoveredPeriod.state === "OPEN" && (
                <p className="text-aman text-[10px] mt-0.5">{t("openPeriod")}</p>
              )}
              {breakdown &&
                hoveredPeriod.breakdown.map((b: TrendAplStat) => (
                  <p key={b.apl_activity} className="text-ink-3 text-[10px]">
                    {b.apl_activity}: {b.pct.toFixed(1)}%
                  </p>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Legend for breakdown mode */}
      {breakdown && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pl-9">
          {aplLines.map((al) => (
            <span key={al.apl} className="flex items-center gap-1 text-[10px] text-ink-2">
              <span
                className="inline-block w-3 h-0.5 rounded-full"
                style={{ background: al.color }}
              />
              {al.apl}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
