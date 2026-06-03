"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { visibleNav } from "@/lib/nav";

// Compact labels (the sidebar's full labels are too long for a bottom bar).
// Keyed by href → "common" namespace key; falls back to the nav tKey.
const SHORT_LABEL: Record<string, string> = {
  "/dashboard": "home",
  "/catalog": "catalog",
  "/inquiry/mine": "inquiry",
  "/inquiry/all": "inquiry",
  "/inquiry/team": "inquiry",
  "/profile": "profile",
};

export function MobileBottomNav({ badge }: { badge?: number }) {
  const pathname = usePathname();
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const { can, canAny, canAll } = useAuth();

  // Permission-filtered, capped at 5 for the bottom bar.
  const NAV = visibleNav({ can, canAny, canAll }).slice(0, 5);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe bg-gradient-to-t from-bg via-bg to-transparent pt-4 px-3 md:hidden">
      <div
        className="bg-surface rounded-2xl shadow-lg ring-1 ring-border"
        style={{ display: "grid", gridTemplateColumns: `repeat(${NAV.length}, 1fr)`, padding: "8px 4px" }}
      >
        {NAV.map((n) => {
          const Icon = n.icon;
          const label = SHORT_LABEL[n.href] ? tc(SHORT_LABEL[n.href]) : tn(n.tKey);
          const isActive = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
          const showBadge = n.badge && badge;
          return (
            <Link
              key={n.href}
              href={n.href}
              className="flex flex-col items-center gap-1 py-1 relative"
              style={{ color: isActive ? "#16110D" : "#A39A8A" }}
            >
              <div
                className="rounded-xl transition-colors"
                style={{
                  padding: "6px 16px",
                  background: isActive ? "#FFF1D0" : "transparent",
                }}
              >
                <Icon size={22} />
              </div>
              <span className="text-[10.5px]" style={{ fontWeight: isActive ? 700 : 500 }}>
                {label}
              </span>
              {showBadge ? (
                <span
                  className="absolute top-1"
                  style={{
                    right: "30%",
                    background: "#FF7A59",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: 6,
                  }}
                >
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
