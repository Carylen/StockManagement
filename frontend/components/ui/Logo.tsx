interface LogoProps {
  isSupplier?: boolean;
  size?: "sm" | "md";
  dark?: boolean;
}

/**
 * Option A lock-up (follows prototype-a/atoms.jsx Logo):
 *   KPP roles  → [kpp-mark-color / kpp-mark-white] hairline [UT·STOCK / by KPP Mining]
 *   Supplier   → UTLogo.png only
 */
export function Logo({ isSupplier = false, size = "md", dark = false }: LogoProps) {
  // base font size — maps to prototype `size` prop
  const s = size === "sm" ? 14 : 16;

  const wordmarkColor = dark ? "#FFFFFF"                : "#16110D";
  const dotColor      = dark ? "#DCEEE3"                : "#1F6F4C";
  const subColor      = dark ? "rgba(255,255,255,0.55)" : "#6B6256";
  const dividerColor  = dark ? "rgba(255,255,255,0.20)" : "rgba(27,24,20,0.12)";

  // ── Supplier / UT ──────────────────────────────────────────────
  if (isSupplier) {
    const utH = Math.round(s * 1.3);
    if (dark) {
      return (
        <div style={{
          background: "#FFFFFF",
          borderRadius: 6,
          padding: "3px 8px",
          display: "inline-flex",
          alignItems: "center",
          flexShrink: 0,
        }}>
          <img src="/UTLogo.png" alt="United Tractors" draggable={false}
            style={{ height: utH - 4, width: "auto", display: "block" }} />
        </div>
      );
    }
    return (
      <img src="/UTLogo.png" alt="United Tractors" draggable={false}
        style={{ height: utH, width: "auto", display: "block", mixBlendMode: "multiply" }} />
    );
  }

  // ── KPP roles: Option A — separate mark PNGs (prototype approach) ─
  const markH   = Math.round(s * 1.3);
  const gap     = Math.round(s * 0.52);
  const divH    = Math.round(s * 1.45);
  const subSize = Math.max(s - 7, 8);

  return (
    <div style={{ display: "flex", alignItems: "center", gap, fontFamily: "inherit", minWidth: 0 }}>
      {/* Mark — separate colour/white PNG, no crop trick needed */}
      <img
        src={dark ? "/kpp-mark-white.png" : "/kpp-mark-color.png"}
        alt="KPP Mining"
        draggable={false}
        style={{ height: markH, width: "auto", display: "block", flexShrink: 0 }}
      />

      {/* Hairline divider */}
      <div style={{ width: 1, height: divH, background: dividerColor, flexShrink: 0 }} />

      {/* Wordmark */}
      <div style={{ lineHeight: 1, minWidth: 0 }}>
        <div style={{
          fontSize: s,
          fontWeight: 800,
          letterSpacing: -0.4,
          color: wordmarkColor,
          whiteSpace: "nowrap",
        }}>
          UT<span style={{ color: dotColor }}>·</span>STOCK
        </div>
        <div style={{
          fontSize: subSize,
          fontWeight: 600,
          letterSpacing: 1.3,
          textTransform: "uppercase",
          color: subColor,
          marginTop: Math.round(s * 0.2),
          whiteSpace: "nowrap",
        }}>
          by KPP Mining
        </div>
      </div>
    </div>
  );
}
