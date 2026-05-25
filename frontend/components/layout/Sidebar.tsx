"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, MessageSquare, Upload,
  Users, LogOut, ChevronRight, Database, KeyRound,
  BarChart3, History, UserCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import clsx from "clsx";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  tKey: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: boolean; // show pending count badge
}

// ── Per prototype atoms.jsx ADMIN_NAV ──────────────────────────
const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard",        tKey: "dashboard",       icon: LayoutDashboard },
  { href: "/catalog",          tKey: "readinessCatalog", icon: Package },
  { href: "/inquiry/all",      tKey: "classGInquiry",   icon: MessageSquare, badge: true },
  { href: "/admin/upload",     tKey: "uploadReadiness", icon: Upload },
  { href: "/admin/master",     tKey: "masterClassVG",   icon: Database },
  { href: "/admin/employees",  tKey: "plantEmployees",  icon: Users },
  { href: "/profile",          tKey: "accountPassword", icon: KeyRound },
];

// ── Per prototype atoms.jsx GL_NAV ─────────────────────────────
const GL_NAV: NavItem[] = [
  { href: "/inquiry/all",   tKey: "teamInquiry",     icon: MessageSquare },
  { href: "/catalog",       tKey: "readinessCatalog", icon: Package },
  { href: "/inquiry/team",  tKey: "teamMechanics",   icon: UserCheck },
];

// ── Per prototype atoms.jsx UT_NAV ─────────────────────────────
const SUPPLIER_NAV: NavItem[] = [
  { href: "/supplier/inquiry",   tKey: "incomingInquiries", icon: MessageSquare, badge: true },
  { href: "/supplier/readiness", tKey: "allSiteReadiness",  icon: BarChart3 },
  { href: "/supplier/history",   tKey: "respondHistory",    icon: History },
  { href: "/profile",            tKey: "accountPassword",   icon: KeyRound },
];

// ── Mechanic — desktop fallback (prototype is mobile-only) ─────
const MECHANIC_NAV: NavItem[] = [
  { href: "/catalog",       tKey: "readinessCatalog", icon: Package },
  { href: "/inquiry/mine",  tKey: "myInquiriesNav",  icon: MessageSquare, badge: true },
];

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  admin:        ADMIN_NAV,
  group_leader: GL_NAV,
  supplier:     SUPPLIER_NAV,
  mechanic:     MECHANIC_NAV,
};

// Site badge color per site — matches prototype SiteBadge
const SITE_COLORS: Record<string, { bg: string; text: string }> = {
  AGMR: { bg: "#DCEEE3", text: "#1F6F4C" },
  RANT: { bg: "#E6E6F9", text: "#5B5BD6" },
  SPUT: { bg: "#FFE5DC", text: "#FF7A59" },
};

interface Props {
  pendingCount?: number;
}

export function Sidebar({ pendingCount }: Props) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tRoles = useTranslations("roles");

  if (!user) return null;

  const items = NAV_BY_ROLE[user.role] ?? ADMIN_NAV;
  const isSupplier = user.role === "supplier";
  const siteColor = user.site ? SITE_COLORS[user.site] : null;

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col border-r border-border bg-bg h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-6">
        <Link href={isSupplier ? "/supplier/inquiry" : "/dashboard"} className="flex items-center gap-2.5">
          <div className={clsx(
            "w-8 h-8 rounded-lg flex items-center justify-center ring-1",
            isSupplier ? "bg-ink ring-[#E8A323]/30" : "bg-ink ring-primary/30"
          )}>
            <div className={clsx(
              "w-4 h-4 rounded bg-gradient-to-br",
              isSupplier ? "from-[#E8A323] to-[#FF7A59]" : "from-primary to-coral"
            )} />
          </div>
          <div className="leading-none">
            <div className={clsx(
              "font-extrabold text-[15px] tracking-tight",
              isSupplier ? "text-ink" : "text-ink"
            )}>
              UT<span className={isSupplier ? "text-[#B07410]" : "text-primary-dark"}>·</span>STOCK
            </div>
            <div className="text-[9px] font-medium text-ink-3 tracking-widest mt-0.5">BY KPP MINING</div>
          </div>
        </Link>
      </div>

      {/* Site badge — prototype shows for non-UT roles */}
      {!isSupplier && user.site && siteColor && (
        <div className="mx-3 mb-2 px-3 py-2.5 rounded-xl flex items-center gap-2.5"
          style={{ background: siteColor.bg }}>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold tracking-wide font-mono"
            style={{ background: siteColor.text, color: "#fff" }}
          >
            {user.site}
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: siteColor.text }}>Site Aktif</div>
            <div className="text-[12px] font-bold text-ink leading-tight">KPP Mining · {user.site}</div>
          </div>
        </div>
      )}

      {/* UT workspace badge */}
      {isSupplier && (
        <div className="mx-3 mb-2 px-3 py-2.5 rounded-xl flex items-center gap-2.5 bg-[#FFF1D0]">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold tracking-wide font-mono bg-[#E8A323] text-ink">
            UT
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#B07410]">Workspace</div>
            <div className="text-[12px] font-bold text-ink leading-tight">UT Rantau · Multi-Site</div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              item.href !== "/profile" &&
              pathname.startsWith(item.href));
          const Icon = item.icon;
          const badge = item.badge ? pendingCount : undefined;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all relative overflow-hidden",
                isActive
                  ? "bg-surface text-ink shadow-sm ring-1 ring-border font-semibold"
                  : "text-ink-2 hover:bg-surface/60 hover:text-ink"
              )}
            >
              {/* Active left border accent */}
              {isActive && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                  style={{ background: isSupplier ? "#E8A323" : "var(--color-primary)" }}
                />
              )}
              <Icon
                size={18}
                className={clsx(
                  isActive
                    ? isSupplier ? "text-[#B07410]" : "text-primary-dark"
                    : "text-ink-3"
                )}
              />
              {t(item.tKey)}
              {badge ? (
                <span className={clsx(
                  "ml-auto text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                  isSupplier ? "bg-[#E8A323] text-ink" : "bg-coral"
                )}>
                  {badge}
                </span>
              ) : isActive ? (
                <ChevronRight size={14} className="ml-auto text-ink-3" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-surface ring-1 ring-border">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={
              isSupplier
                ? { background: "#E8A323", color: "#16110D" }
                : { background: "linear-gradient(135deg, var(--color-primary), var(--color-coral))", color: "#fff" }
            }
          >
            {user.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold text-ink truncate">{user.name}</div>
            <div className="text-[10px] text-ink-3">{tRoles(user.role as Role)}</div>
          </div>
          <button
            onClick={logout}
            title={t("logout")}
            className="text-ink-3 hover:text-warning transition-colors"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
