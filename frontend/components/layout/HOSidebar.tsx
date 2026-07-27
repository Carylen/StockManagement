"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ChevronRight, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import { ALL_NAV_ITEMS } from "@/lib/nav";
import { Logo } from "@/components/ui/Logo";

// Only HO-relevant routes shown in this sidebar
const HO_HREFS = new Set([
  "/ho/dashboard",
  "/ho/users",
  "/ho/sites",
  "/ho/suppliers",
  "/ho/roles",
  "/profile",
]);

export function HOSidebar() {
  const { user, logout, can, canAny, canAll } = useAuth();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Lock body scroll while the drawer is open
  useEffect(() => {
    if (!isMobile) { setMobileOpen(false); return; }
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen, isMobile]);

  if (!user) return null;

  const items = ALL_NAV_ITEMS.filter(
    (item) => HO_HREFS.has(item.href) && item.show({ can, canAny, canAll })
  );

  const workspaceBadge = (
    <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl flex items-center gap-2.5" style={{ background: "rgba(255,255,255,0.07)" }}>
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold tracking-wide font-mono flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.18)", color: "#FFFFFF" }}
      >
        HO
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
          Workspace
        </div>
        <div className="text-[12px] font-bold" style={{ color: "#FFFFFF" }}>
          Head Office · HQ
        </div>
      </div>
    </div>
  );

  const navList = (
    <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/profile" && pathname.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-[11px] text-[13.5px] font-medium transition-all relative overflow-hidden rounded-xl"
            style={{
              background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
              color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.50)",
              fontWeight: isActive ? 600 : 500,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.80)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.50)";
              }
            }}
          >
            {isActive && (
              <span
                className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                style={{ background: "rgba(255,255,255,0.55)" }}
              />
            )}
            <Icon
              size={18}
              style={{ color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.38)", flexShrink: 0 }}
            />
            {t(item.tKey)}
            {isActive && (
              <ChevronRight
                size={14}
                className="ml-auto"
                style={{ color: "rgba(255,255,255,0.35)" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );

  const userFooter = (
    <div className="p-3 border-t" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
      <div
        className="flex items-center gap-2.5 p-3 rounded-xl"
        style={{ background: "rgba(255,255,255,0.07)" }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.18)", color: "#FFFFFF" }}
        >
          {user.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-[12.5px] font-semibold truncate"
            style={{ color: "#FFFFFF" }}
          >
            {user.name}
          </div>
          <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.40)" }}>
            Super Admin
          </div>
        </div>
        <button
          onClick={logout}
          title={t("logout")}
          className="transition-colors"
          style={{ color: "rgba(255,255,255,0.35)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#FFFFFF"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );

  // ── Mobile: fixed top bar + slide-in drawer ─────────────────
  if (isMobile) {
    return (
      <>
        <div
          className="fixed top-0 left-0 right-0 z-[60] flex items-center gap-2.5 px-4 border-b border-white/10"
          style={{ height: 56, background: "#1B1814" }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            aria-label={t("openMenu")}
            className="w-[42px] h-[42px] rounded-xl border border-white/15 text-white flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.07)" }}
          >
            <Menu size={20} />
          </button>
          <div className="flex-1 min-w-0 overflow-hidden">
            <Link href="/ho/dashboard">
              <Logo size="sm" dark />
            </Link>
          </div>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[10.5px] font-bold font-mono flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.18)", color: "#FFFFFF" }}
          >
            HO
          </div>
        </div>

        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-[140] flex"
            style={{ background: "rgba(15,14,12,0.45)", animation: "sidebarFadeIn 0.18s ease" }}
          >
            <aside
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col gap-3 overflow-y-auto"
              style={{
                width: 290,
                maxWidth: "85%",
                height: "100%",
                padding: "16px 0 0",
                background: "#1B1814",
                boxShadow: "8px 0 44px rgba(15,14,12,0.32)",
                animation: "sidebarDrawerIn 0.26s cubic-bezier(.2,.7,.3,1)",
              }}
            >
              <div className="flex items-center justify-between gap-2.5 px-4">
                <Link href="/ho/dashboard" onClick={() => setMobileOpen(false)}>
                  <Logo size="md" dark />
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label={t("closeMenu")}
                  className="w-9 h-9 rounded-xl border border-white/15 text-white flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.07)" }}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="px-4">
                <div
                  className="text-[9.5px] font-bold tracking-[1.6px] uppercase px-0.5"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  HQ · Super Admin
                </div>
              </div>
              <div className="px-3">{workspaceBadge}</div>
              {navList}
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
      className="w-60 flex-shrink-0 flex flex-col border-r border-white/10 h-screen sticky top-0"
      style={{ background: "#1B1814" }}
    >
      <div className="px-5 pt-6 pb-3">
        <Link href="/ho/dashboard">
          <Logo size="md" dark />
        </Link>
        <div
          className="mt-2 text-[9.5px] font-bold tracking-[1.6px] uppercase px-0.5"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          HQ · Super Admin
        </div>
      </div>

      {workspaceBadge}
      {navList}
      {userFooter}
    </aside>
  );
}
