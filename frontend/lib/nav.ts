import {
  LayoutDashboard, Package, MessageSquare, Upload, Database, Users,
  BarChart3, History, KeyRound, Building2, ShieldCheck, UserCog, Lock, ClipboardCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PermissionChecks } from "@/lib/auth";

export interface NavItem {
  href: string;
  /** i18n key under the "nav" namespace. */
  tKey: string;
  icon: LucideIcon;
  /** Shows the pending-inquiry count badge. */
  badge?: boolean;
  /** Whether this item is visible for the given permission set. */
  show: (c: PermissionChecks) => boolean;
}

/**
 * Single source of truth for navigation across Sidebar + MobileBottomNav.
 * Visibility is driven purely by permissions (never role strings), so a role's
 * menu changes automatically when its permissions change in HO.
 *
 * Overlap rules (avoid duplicate inquiry links):
 *  - inquiry/all  → has all-inquiries view but is NOT a responder (admin/HO)
 *  - inquiry/team → team view only, no all-inquiries (group leader)
 *  - supplier/*   → responders (UT supplier PIC)
 */
export const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",         tKey: "dashboard",         icon: LayoutDashboard, show: (c) => c.can("can_view_own_site") },
  { href: "/catalog",           tKey: "readinessCatalog",  icon: Package,         show: (c) => c.can("can_view_own_site") },
  { href: "/inquiry/all",       tKey: "classGInquiry",     icon: MessageSquare, badge: true, show: (c) => c.can("can_view_all_inquiries") && !c.can("can_respond_inquiry") },
  { href: "/inquiry/team",      tKey: "teamInquiriesNav",  icon: MessageSquare, badge: true, show: (c) => c.can("can_view_team_inquiry") && !c.can("can_view_all_inquiries") },
  { href: "/inquiry/approval",  tKey: "approvalQueue",     icon: ClipboardCheck, badge: true, show: (c) => c.can("can_approve_inquiry") },
  { href: "/inquiry/mine",      tKey: "myInquiriesNav",    icon: MessageSquare, badge: true, show: (c) => c.can("can_submit_inquiry") || c.can("can_request_class_g") || c.can("can_request_class_v") },
  { href: "/supplier/upload",   tKey: "uploadStock",       icon: Upload,          show: (c) => c.can("can_upload_readiness") && c.can("can_respond_inquiry") },
  { href: "/admin/master",      tKey: "masterClassVG",     icon: Database,        show: (c) => c.can("can_manage_master") },
  { href: "/admin/employees",   tKey: "dataEmployees",     icon: Users,           show: (c) => c.can("can_manage_employees") },
  { href: "/supplier/inquiry",  tKey: "incomingInquiries", icon: MessageSquare, badge: true, show: (c) => c.can("can_respond_inquiry") },
  { href: "/supplier/readiness",tKey: "allSiteReadiness",  icon: BarChart3,       show: (c) => c.can("can_view_all_sites") && c.can("can_respond_inquiry") },
  { href: "/supplier/history",  tKey: "respondHistory",    icon: History,         show: (c) => c.can("can_respond_inquiry") },
  { href: "/ho/dashboard",      tKey: "hoDashboard",       icon: ShieldCheck,     show: (c) => c.can("can_view_ho_dashboard") },
  { href: "/ho/users",          tKey: "hoUsers",           icon: UserCog,         show: (c) => c.can("can_manage_all_users") },
  { href: "/ho/sites",          tKey: "hoSites",           icon: Building2,       show: (c) => c.can("can_manage_sites") },
  { href: "/ho/suppliers",      tKey: "hoSuppliers",       icon: Users,           show: (c) => c.can("can_manage_suppliers") },
  { href: "/ho/roles",          tKey: "hoRoles",           icon: Lock,            show: (c) => c.can("can_manage_roles") },
  { href: "/profile",           tKey: "accountPassword",   icon: KeyRound,        show: () => true },
];

/** Items visible to the given permission set, in declared order. */
export function visibleNav(c: PermissionChecks): NavItem[] {
  return ALL_NAV_ITEMS.filter((item) => item.show(c));
}
