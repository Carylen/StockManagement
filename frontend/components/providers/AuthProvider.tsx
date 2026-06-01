"use client";

import { useState, useEffect, useCallback } from "react";
import { AuthContext, saveSession, loadSession, clearSession } from "@/lib/auth";
import { setToken } from "@/lib/api";
import type { AuthUser, Role } from "@/lib/types";

// Normalize legacy role strings that the DB may have stored with different casing
function normalizeRole(role: string): Role {
  const map: Record<string, Role> = {
    Mekanik:      "mechanic",
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
      const normalized = { ...u, role: normalizeRole(u.role) };
      setTokenState(t);
      setUser(normalized);
      setToken(t);
      // persist normalized role back so next load is already clean
      saveSession(t, normalized);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const org = user?.role === "supplier" ? "ut" : "kpp";
    document.documentElement.setAttribute("data-org", org);
  }, [user]);

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    const normalized = { ...newUser, role: normalizeRole(newUser.role) };
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

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
