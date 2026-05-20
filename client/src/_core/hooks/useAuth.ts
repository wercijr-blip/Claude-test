import { useState, useEffect, useCallback } from "react";
import type { AuthUser } from "@shared/types.ts";

const TOKEN_KEY = "cis_token";

export function isJwtExpired(token: string): boolean {
  try {
    const [, part] = token.split(".");
    const { exp } = JSON.parse(
      atob(part.replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (!exp) return true;
    return exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function useAuth() {
  const [token, setTokenState] = useState<string | null>(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return null;
    if (isJwtExpired(stored)) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return stored;
  });

  const setToken = useCallback((t: string | null) => {
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setTokenState(t);
  }, []);

  const logout = useCallback(() => setToken(null), [setToken]);

  // Read directly from localStorage so the reference is stable and the tRPC
  // client (created once via useState) always gets the current token.
  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY), []);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      if (isJwtExpired(token)) {
        localStorage.removeItem(TOKEN_KEY);
        setTokenState(null);
        if (window.location.pathname !== "/") window.location.href = "/";
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [token]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === TOKEN_KEY && !e.newValue) {
        setTokenState(null);
        if (window.location.pathname !== "/") window.location.href = "/";
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { token, setToken, logout, getToken, isAuthenticated: !!token };
}

export function parseJwtPayload(token: string): AuthUser | null {
  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return decoded as AuthUser;
  } catch {
    return null;
  }
}
