"use client";

import type { CSSProperties } from "react";

// =============================================================
// Haul cycle — open-pit login backdrop.
// A sun glow, drifting clouds, birds, a working excavator loading
// at the bench, and a 3-truck convoy hauling across the graded
// ground line, kicking up dust. GPU-only (opacity + transform).
// Ported from raw_concept/prototype-a/login-anim.jsx.
// =============================================================

// CSS custom properties (--sx / --sy) aren't in the CSSProperties type,
// so widen it for the spark particles.
type SparkStyle = CSSProperties & { "--sx"?: string; "--sy"?: string };

const Cloud = ({ o }: { o: number }) => (
  <svg width="120" height="44" viewBox="0 0 120 44" fill="#fff" fillOpacity={o}>
    <circle cx="34" cy="28" r="16" />
    <circle cx="56" cy="22" r="20" />
    <circle cx="82" cy="28" r="15" />
    <rect x="30" y="30" width="58" height="12" rx="6" />
  </svg>
);

const Birds = ({ accent }: { accent: string }) => (
  <svg
    width="60"
    height="20"
    viewBox="0 0 60 20"
    fill="none"
    stroke={accent}
    strokeOpacity="0.7"
    strokeWidth="1.4"
    strokeLinecap="round"
  >
    <path d="M2 10 Q8 2 14 10 Q20 2 26 10" />
    <path d="M30 14 Q35 7 40 14 Q45 7 50 14" />
  </svg>
);

const HaulTruck = ({ accent, scale }: { accent: string; scale: number }) => {
  const W = 150 * scale;
  const H = 78 * scale;
  return (
    <div style={{ position: "relative", width: W, height: H, transform: "translateY(-100%)" }}>
      {/* dust puffs trailing left */}
      <div
        style={{
          position: "absolute",
          left: -8 * scale,
          bottom: 0,
          width: 20 * scale,
          height: 20 * scale,
          borderRadius: "50%",
          background: "rgba(248,228,190,0.30)",
          animation: "haul-dust 1.5s ease-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -24 * scale,
          bottom: 2 * scale,
          width: 16 * scale,
          height: 16 * scale,
          borderRadius: "50%",
          background: "rgba(248,228,190,0.22)",
          animation: "haul-dust 1.5s ease-out -0.5s infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -40 * scale,
          bottom: 5 * scale,
          width: 12 * scale,
          height: 12 * scale,
          borderRadius: "50%",
          background: "rgba(248,228,190,0.14)",
          animation: "haul-dust 1.5s ease-out -1s infinite",
        }}
      />

      <svg
        width={W}
        height={H}
        viewBox="0 0 150 78"
        style={{ position: "absolute", inset: 0, filter: `drop-shadow(0 0 6px ${accent}44)` }}
      >
        {/* dump bed — angled trapezoid */}
        <polygon points="42,18 138,18 132,46 36,46" fill={accent} opacity="1" />
        <line x1="42" y1="18" x2="138" y2="18" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.4" />
        {/* ore load peeking over bed */}
        <path d="M50 18 q10 -8 20 0 q12 -7 22 0 q10 -6 20 0 z" fill="#fff" opacity="0.32" />
        {/* chassis */}
        <rect x="22" y="46" width="116" height="10" fill="#1B1814" stroke={accent} strokeOpacity="0.8" strokeWidth="1" />
        {/* cabin */}
        <rect x="22" y="22" width="22" height="26" fill="#0F0E0C" stroke={accent} strokeWidth="1.4" />
        <rect x="26" y="26" width="14" height="10" fill={accent} opacity="0.9" />
        <circle cx="22" cy="44" r="2.4" fill={accent} />
        {/* wheels */}
        <g style={{ transformOrigin: "40px 64px", animation: "wheel-spin 0.6s linear infinite" }}>
          <circle cx="40" cy="64" r="11" fill="#0F0E0C" stroke={accent} strokeWidth="2.6" />
          <line x1="29" y1="64" x2="51" y2="64" stroke={accent} strokeWidth="1.3" />
          <line x1="40" y1="53" x2="40" y2="75" stroke={accent} strokeWidth="1.3" />
        </g>
        <g style={{ transformOrigin: "110px 64px", animation: "wheel-spin 0.6s linear infinite" }}>
          <circle cx="110" cy="64" r="11" fill="#0F0E0C" stroke={accent} strokeWidth="2.6" />
          <line x1="99" y1="64" x2="121" y2="64" stroke={accent} strokeWidth="1.3" />
          <line x1="110" y1="53" x2="110" y2="75" stroke={accent} strokeWidth="1.3" />
        </g>
      </svg>
    </div>
  );
};

// Excavator that swings its boom + bucket on a loop, ejecting dirt
const Excavator = ({ accent }: { accent: string }) => (
  <div style={{ position: "relative", width: 96, height: 92, transform: "translateY(-100%)" }}>
    {/* spoil particles flung from bucket */}
    <div
      style={
        {
          position: "absolute",
          left: 8,
          top: 6,
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "rgba(248,228,190,0.5)",
          "--sx": "-16px",
          "--sy": "-10px",
          animation: "spark-fly 1.6s ease-out infinite",
        } as SparkStyle
      }
    />
    <div
      style={
        {
          position: "absolute",
          left: 12,
          top: 10,
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "rgba(248,228,190,0.4)",
          "--sx": "-22px",
          "--sy": "-4px",
          animation: "spark-fly 1.6s ease-out -0.6s infinite",
        } as SparkStyle
      }
    />

    <svg
      width="96"
      height="92"
      viewBox="0 0 96 92"
      style={{ position: "absolute", inset: 0, filter: `drop-shadow(0 0 6px ${accent}44)` }}
    >
      {/* tracks */}
      <rect x="40" y="74" width="52" height="14" rx="7" fill="#0F0E0C" stroke={accent} strokeWidth="1.6" />
      <circle cx="50" cy="81" r="4" fill="none" stroke={accent} strokeWidth="1.2" />
      <circle cx="82" cy="81" r="4" fill="none" stroke={accent} strokeWidth="1.2" />
      {/* house / cab */}
      <rect x="52" y="50" width="34" height="24" rx="4" fill={accent} />
      <rect x="56" y="54" width="14" height="12" fill="#0F0E0C" opacity="0.85" />
      {/* boom + arm + bucket — animated group, pivots at cab shoulder */}
      <g style={{ transformOrigin: "56px 56px", animation: "exc-boom 3.4s ease-in-out infinite" }}>
        <rect x="20" y="48" width="40" height="8" rx="4" fill={accent} transform="rotate(-32 56 56)" />
        <g style={{ transformOrigin: "24px 30px", animation: "exc-bucket 3.4s ease-in-out infinite" }}>
          <rect x="14" y="26" width="8" height="26" rx="4" fill={accent} />
          <path d="M6 50 L24 50 L22 64 L10 64 Z" fill="#0F0E0C" stroke={accent} strokeWidth="1.6" />
        </g>
      </g>
    </svg>
  </div>
);

export function HaulCycleAnim({ accent }: { accent: string }) {
  return (
    <div
      className="haul-anim"
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}
    >
      {/* sky wash + sun */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 90% 60% at 70% 100%, ${accent}33 0%, transparent 60%), radial-gradient(circle at 78% 16%, ${accent}26 0%, transparent 34%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "14%",
          width: 90,
          height: 90,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent} 0%, ${accent}66 38%, transparent 70%)`,
          animation: "sun-glow 5s ease-in-out infinite",
        }}
      />

      {/* drifting clouds */}
      <div style={{ position: "absolute", top: "18%", left: "12%", animation: "cloud-drift 9s ease-in-out infinite alternate" }}>
        <Cloud o={0.16} />
      </div>
      <div style={{ position: "absolute", top: "30%", left: "46%", animation: "cloud-drift 12s ease-in-out infinite alternate-reverse" }}>
        <Cloud o={0.11} />
      </div>

      {/* birds */}
      <div style={{ position: "absolute", top: "24%", left: "30%", animation: "birds-fly 11s linear infinite" }}>
        <Birds accent="#fff" />
      </div>

      {/* ridge lines */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 600 800"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, opacity: 0.28 }}
      >
        <polyline
          points="0,560 80,540 160,548 240,520 320,536 400,512 480,528 560,508 600,520"
          fill="none"
          stroke="#fff"
          strokeWidth="1.4"
        />
        <polyline
          points="0,600 100,580 180,592 260,572 340,584 420,560 500,576 600,560"
          fill="none"
          stroke="#fff"
          strokeWidth="1"
        />
      </svg>

      {/* ground line + tick marks */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "20%",
          height: 2,
          background: `${accent}88`,
          boxShadow: `0 0 10px ${accent}55`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "18.8%",
          height: 6,
          opacity: 0.5,
          backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.30) 0 1px, transparent 1px 26px)",
        }}
      />

      {/* working excavator at the loading bench (right side) */}
      <div style={{ position: "absolute", bottom: "20%", right: "8%" }}>
        <Excavator accent={accent} />
      </div>

      {/* truck convoy — three at staggered scale/phase */}
      <div style={{ position: "absolute", bottom: "20%", left: 0, animation: "haul-drive 11s linear infinite" }}>
        <HaulTruck accent={accent} scale={1} />
      </div>
      <div style={{ position: "absolute", bottom: "20%", left: 0, animation: "haul-drive 11s linear infinite -4s", opacity: 0.85 }}>
        <HaulTruck accent={accent} scale={0.82} />
      </div>
      <div style={{ position: "absolute", bottom: "20%", left: 0, animation: "haul-drive 11s linear infinite -7.5s", opacity: 0.6 }}>
        <HaulTruck accent={accent} scale={0.64} />
      </div>
    </div>
  );
}
