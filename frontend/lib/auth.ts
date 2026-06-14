"use client";

import { createContext, useContext } from "react";
import type { AuthUser } from "./types";

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isLoading: boolean;
  /** True if the current user has the given permission. */
  can: (permission: string) => boolean;
  /** True if the current user has at least one of the given permissions. */
  canAny: (...permissions: string[]) => boolean;
  /** True if the current user has all of the given permissions. */
  canAll: (...permissions: string[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
  can: () => false,
  canAny: () => false,
  canAll: () => false,
});

export const useAuth = () => useContext(AuthContext);

/** The permission-checking surface shared by guards and nav config. */
export interface PermissionChecks {
  can: (permission: string) => boolean;
  canAny: (...permissions: string[]) => boolean;
  canAll: (...permissions: string[]) => boolean;
}

// ── Pure permission helpers (usable outside React, e.g. guards/utils) ────────
export function hasPermission(permissions: string[] | undefined, permission: string): boolean {
  return permissions?.includes(permission) ?? false;
}

export function hasAnyPermission(permissions: string[] | undefined, wanted: string[]): boolean {
  return wanted.some((p) => permissions?.includes(p));
}

export function hasAllPermissions(permissions: string[] | undefined, wanted: string[]): boolean {
  return wanted.every((p) => permissions?.includes(p));
}

/**
 * Friendly identity label derived from permissions + site (not raw role string).
 * Used in the Topbar / avatar chip.
 */
export function roleLabel(user: AuthUser | null): string {
  if (!user) return "";
  const p = user.permissions ?? [];
  if (p.includes("can_view_ho_dashboard")) return "HO · Super Admin";
  if (p.includes("can_respond_inquiry")) return "UT · Supplier";
  if (p.includes("can_manage_master") || p.includes("can_manage_employees")) return `Admin · ${user.site}`;
  if (p.includes("can_approve_inquiry")) return `Planner · ${user.site}`;
  if (p.includes("can_view_team_inquiry")) return `Group Leader · ${user.site}`;
  if (p.includes("can_request_class_g")) return `Mechanic · ${user.site}`;
  if (p.includes("can_submit_inquiry")) return `User · ${user.site}`;
  return user.site;
}

/** Decode permissions[] from a JWT payload without verifying the signature. */
export function permissionsFromToken(token: string | null): string[] {
  if (!token) return [];
  try {
    const payload = token.split(".")[1];
    if (!payload) return [];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const data = JSON.parse(json) as { permissions?: string[] };
    return Array.isArray(data.permissions) ? data.permissions : [];
  } catch {
    return [];
  }
}

const TOKEN_KEY = "ut_stock_token";
const USER_KEY = "ut_stock_user";

export function saveSession(token: string, user: AuthUser) {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function loadSession(): { token: string | null; user: AuthUser | null } {
  if (typeof window === "undefined") return { token: null, user: null };
  const token = localStorage.getItem(TOKEN_KEY);
  const userStr = localStorage.getItem(USER_KEY);
  if (!token || !userStr) return { token: null, user: null };
  try {
    return { token, user: JSON.parse(userStr) };
  } catch {
    return { token: null, user: null };
  }
}

export function clearSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
