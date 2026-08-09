"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, getPersistedAuthToken, persistAuthToken } from "@/lib/api-client";
import { deleteMyAccount, fetchMe, login, logout, register, type AuthUser } from "./auth.service";

export interface AuthSessionContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  registerAndSignIn: (input: { email: string; password: string; displayName?: string }) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
  removeAccount: (password: string) => Promise<void>;
}

export const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    applySession(null);
  }, [applySession]);

  const refreshMe = useCallback(async () => {
    const persistedToken = getPersistedAuthToken();
    if (!persistedToken) {
      clearSession();
      return;
    }

    try {
      const me = await fetchMe(persistedToken);
      applySession(me);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        persistAuthToken(null);
        clearSession();
        return;
      }
      throw error;
    }
  }, [applySession, clearSession]);

  useEffect(() => {
    const run = async () => {
      const persistedToken = getPersistedAuthToken();
      if (!persistedToken) {
        clearSession();
        setIsLoading(false);
        return;
      }

      try {
        try {
          const me = await fetchMe(persistedToken);
          applySession(me);
        } catch {
          persistAuthToken(null);
          clearSession();
        }
      } catch {
        persistAuthToken(null);
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, [applySession, clearSession]);

  const registerAndSignIn = useCallback(async (input: { email: string; password: string; displayName?: string }) => {
    await register(input);
    const me = await fetchMe();
    applySession(me);
  }, [applySession]);

  const signIn = useCallback(async (input: { email: string; password: string }) => {
    await login(input);
    const me = await fetchMe();
    applySession(me);
  }, [applySession]);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const removeAccount = useCallback(async (password: string) => {
    await deleteMyAccount(password);
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthSessionContextValue>(() => ({
    user,
    token: null,
    isLoading,
    isAuthenticated: Boolean(user),
    registerAndSignIn,
    signIn,
    signOut,
    refreshMe,
    removeAccount,
  }), [user, isLoading, registerAndSignIn, signIn, signOut, refreshMe, removeAccount]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error("useAuthSession must be used within AuthSessionProvider");
  }

  return context;
}
