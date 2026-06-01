"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, MessageSquare, Upload,
  Users, LogOut, ChevronRight, Database, KeyRound,
  BarChart3, History, UserCheck, Menu, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import clsx from "clsx";
import type { Role } from "@/lib/types";
import { Logo } from "@/components/ui/Logo";

interface NavItem {
  href: string;
  tKey: string;
  icon: LucideIcon;
  badge?: boolean;
}

const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard",        tKey: "dashboard",        icon: LayoutDashboard },
  { href: "/catalog",          tKey: "readinessCatalog",  icon: Package },
  { href: "/inquiry/all",      tKey: "classGInquiry",    icon: MessageSquare, badge: true },
  { href: "/admin/upload",     tKey: "uploadReadiness",  icon: Upload },
  { href: "/admin/master",     tKey: "masterClassVG",    icon: Database },
  { href: "/admin/employees",  tKey: "plantEmployees",   icon: Users },
  { href: "/profile",          tKey: "accountPassword",  icon: KeyRound },
];

const GL_NAV: NavItem[] = [
  { href: "/inquiry/all",   tKey: "teamInquiry",      icon: MessageSquare },
  { href: "/catalog",       tKey: "readinessCatalog",  icon: Package },
  { href: "/inquiry/team",  tKey: "teamMechanics",    icon: UserCheck },
];

const SUPPLIER_NAV: NavItem[] = [
  { href: "/supplier/inquiry",   tKey: "incomingInquiries", icon: MessageSquare, badge: true },
  { href: "/supplier/readiness", tKey: "allSiteReadiness",  icon: BarChart3 },
  { href: "/supplier/history",   tKey: "respondHistory",    icon: History },
  { href: "/profile",            tKey: "accountPassword",   icon: KeyRound },
];

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (!isMobile) { setMobileOpen(false); return; }
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen, isMobile]);

  if (!user) return null;

  // Mechanic on mobile uses MobileBottomNav — no sidebar on mobile
  // On desktop, mechanic still gets a sidebar rail for navigation
  if (user.role === "mechanic" && isMobile) return null;

  const items = NAV_BY_ROLE[user.role] ?? ADMIN_NAV;
  const isSupplier = user.role === "supplier";
  const siteColor = user.site ? SITE_COLORS[user.site] : null;

  // ── Shared: nav list ────────────────────────────────────────
  const navList = items.map((item) => {
    const isActive =
      pathname === item.href ||
      (item.href !== "/dashboard" &&
        item.href !== "/profile" &&
        pathname.startsWith(item.href));
    const Icon = item.icon;
    const badge = item.badge ? pendingCount : undefined;
    const glassActive = isActive && !isSupplier;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={clsx(
          "flex items-center gap-3 px-3 py-[11px] text-[13.5px] font-medium transition-all relative overflow-hidden",
          glassActive
            ? "rounded-xl font-semibold text-ink"
            : isActive
            ? "rounded-lg bg-surface text-ink shadow-sm ring-1 ring-border font-semibold"
            : "rounded-lg text-ink-2 hover:bg-surface/60 hover:text-ink"
        )}
        style={
          glassActive
            ? {
                background: "rgba(255,255,255,0.72)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                boxShadow:
                  "0 1px 2px rgba(27,24,20,0.06), inset 0 0 0 1px rgba(255,255,255,0.8)",
              }
            : undefined
        }
      >
        {isActive && (
          <span
            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
            style={{ background: isSupplier ? "var(--c-ut)" : "var(--brand-primary)" }}
          />
        )}
        <Icon
          size={18}
          className={clsx(
            isActive
              ? isSupplier ? "text-ut-deep" : "text-brand-deep"
              : "text-ink-3"
          )}
        />
        {t(item.tKey)}
        {badge ? (
          <span
            className={clsx(
              "ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md",
              isSupplier ? "bg-[#E8A323] text-ink" : "bg-coral text-white"
            )}
          >
            {badge}
          </span>
        ) : isActive ? (
          <ChevronRight size={14} className="ml-auto text-ink-3" />
        ) : null}
      </Link>
    );
  });

  // ── Shared: site card ───────────────────────────────────────
  const siteCard = !isSupplier && user.site && siteColor ? (
    <div className="px-3 py-2.5 rounded-xl flex items-center gap-2.5" style={{ background: siteColor.bg }}>
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold tracking-wide font-mono"
        style={{ background: siteColor.text, color: "#fff" }}
      >
        {user.site}
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: siteColor.text }}>
          Site Aktif
        </div>
        <div className="text-[12px] font-bold text-ink leading-tight">KPP Mining · {user.site}</div>
      </div>
    </div>
  ) : isSupplier ? (
    <div className="px-3 py-2.5 rounded-xl flex items-center gap-2.5 bg-[#FFF1D0]">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold tracking-wide font-mono bg-[#E8A323] text-ink">
        UT
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-widest text-ut-deep">Workspace</div>
        <div className="text-[12px] font-bold text-ink leading-tight">UT Rantau · Multi-Site</div>
      </div>
    </div>
  ) : null;

  // ── Shared: user footer ─────────────────────────────────────
  const userFooter = (
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
      <button onClick={logout} title={t("logout")} className="text-ink-3 hover:text-warning transition-colors">
        <LogOut size={15} />
      </button>
    </div>
  );


  // ── Mobile: fixed top bar + slide-in drawer ─────────────────
  if (isMobile) {
    return (
      <>
        {/* Fixed top bar */}
        <div
          className="fixed top-0 left-0 right-0 z-[60] flex items-center gap-2.5 px-4 bg-bg border-b border-border"
          style={{ height: 56 }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu"
            className="w-[42px] h-[42px] rounded-xl bg-surface border border-border text-ink flex items-center justify-center flex-shrink-0"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1 min-w-0 overflow-hidden">
            <Link href={isSupplier ? "/supplier/inquiry" : "/dashboard"}>
              <Logo isSupplier={isSupplier} size="sm" />
            </Link>
          </div>
          {/* Site chip */}
          {!isSupplier && user.site && siteColor && (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[10.5px] font-bold font-mono flex-shrink-0"
              style={{ background: siteColor.text, color: "#fff" }}
            >
              {user.site}
            </div>
          )}
          {isSupplier && (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[10.5px] font-bold font-mono flex-shrink-0 bg-[#E8A323] text-ink">
              UT
            </div>
          )}
        </div>

        {/* Drawer overlay */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-[140] flex"
            style={{ background: "rgba(15,14,12,0.45)", animation: "sidebarFadeIn 0.18s ease" }}
          >
            <aside
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col gap-4 overflow-y-auto bg-bg"
              style={{
                width: 290,
                maxWidth: "85%",
                height: "100%",
                padding: "16px 14px 22px",
                boxShadow: "8px 0 44px rgba(15,14,12,0.32)",
                animation: "sidebarDrawerIn 0.26s cubic-bezier(.2,.7,.3,1)",
              }}
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between gap-2.5 px-1">
                <Link
                  href={isSupplier ? "/supplier/inquiry" : "/dashboard"}
                  onClick={() => setMobileOpen(false)}
                >
                  <Logo isSupplier={isSupplier} size="md" />
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Tutup menu"
                  className="w-9 h-9 rounded-xl bg-surface border border-border text-ink-2 flex items-center justify-center flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>

              {siteCard}

              <div className="text-[10px] text-ink-3 font-bold tracking-widest uppercase px-2">
                Menu
              </div>

              <nav className="flex flex-col gap-0.5">{navList}</nav>

              <div className="mt-auto">{userFooter}</div>
            </aside>
          </div>
        )}
      </>
    );
  }

  // ── Desktop: left sidebar rail ──────────────────────────────
  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col border-r border-border h-screen sticky top-0"
      style={{
        background: isSupplier
          ? "var(--c-bg)"
          : "linear-gradient(160deg, #F0F7F3 0%, #EDE9E0 55%, #F6F3EE 100%)",
      }}
    >
      {/* Logo */}
      <div className="px-5 py-6">
        <Link href={isSupplier ? "/supplier/inquiry" : "/dashboard"}>
          <Logo isSupplier={isSupplier} size="md" />
        </Link>
      </div>

      {/* Site badge */}
      {siteCard && <div className="mx-3 mb-2">{siteCard}</div>}

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">{navList}</nav>

      {/* User footer */}
      <div className="p-3 border-t border-border">{userFooter}</div>
    </aside>
  );
}
