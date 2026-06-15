"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AuthContext,
  saveSession,
  loadSession,
  clearSession,
  permissionsFromToken,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from "@/lib/auth";
import { setToken } from "@/lib/api";
import type { AuthUser, Role } from "@/lib/types";

// Normalize legacy role strings that the DB may have stored with different casing
function normalizeRole(role: string): Role {
  const map: Record<string, Role> = {
    GL:           "group_leader",
    Supplier:     "supplier",
    Admin:        "admin",
    Group_leader: "group_leader",
  };
  return (map[role] ?? role.toLowerCase()) as Role;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { token: t, user: u } = loadSession();
    if (t && u) {
      // Token is authoritative for permissions — always re-derive on load.
      const normalized = {
        ...u,
        role: normalizeRole(u.role),
        permissions: permissionsFromToken(t),
      };
      setTokenState(t);
      setUser(normalized);
      setToken(t);
      // persist normalized role + permissions back so next load is already clean
      saveSession(t, normalized);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const org = user?.role === "supplier" ? "ut" : "kpp";
    document.documentElement.setAttribute("data-org", org);
  }, [user]);

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    const normalized = {
      ...newUser,
      role: normalizeRole(newUser.role),
      permissions: permissionsFromToken(newToken),
    };
    setTokenState(newToken);
    setUser(normalized);
    setToken(newToken);
    saveSession(newToken, normalized);
  }, []);

  const logout = useCallback(() => {
    setTokenState(null);
    setUser(null);
    setToken(null);
    clearSession();
  }, []);

  const can = useCallback((permission: string) => hasPermission(user?.permissions, permission), [user]);
  const canAny = useCallback((...permissions: string[]) => hasAnyPermission(user?.permissions, permissions), [user]);
  const canAll = useCallback((...permissions: string[]) => hasAllPermissions(user?.permissions, permissions), [user]);

  const value = useMemo(
    () => ({ user, token, login, logout, isLoading, can, canAny, canAll }),
    [user, token, login, logout, isLoading, can, canAny, canAll]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
