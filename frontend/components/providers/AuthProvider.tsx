"use client";

import { useState, useEffect, useCallback } from "react";
import { AuthContext, saveSession, loadSession, clearSession } from "@/lib/auth";
import { setToken } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { token: t, user: u } = loadSession();
    if (t && u) {
      setTokenState(t);
      setUser(u);
      setToken(t);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    setTokenState(newToken);
    setUser(newUser);
    setToken(newToken);
    saveSession(newToken, newUser);
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
