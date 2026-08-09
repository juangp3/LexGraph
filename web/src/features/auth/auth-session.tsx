"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, getPersistedAuthToken, persistAuthToken } from "@/lib/api-client";
import { deleteMyAccount, fetchMe, login, logout, register, type AuthUser } from "./auth.service";

interface AuthSessionContextValue {
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

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((nextToken: string | null, nextUser: AuthUser | null) => {
    setToken(nextToken);
    setUser(nextUser);
    persistAuthToken(nextToken);
  }, []);

  const clearSession = useCallback(() => {
    applySession(null, null);
  }, [applySession]);

  const refreshMe = useCallback(async () => {
    const activeToken = token ?? getPersistedAuthToken();
    if (!activeToken) {
      clearSession();
      return;
    }

    try {
      const me = await fetchMe(activeToken);
      applySession(activeToken, me);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        return;
      }
      throw error;
    }
  }, [applySession, clearSession, token]);

  useEffect(() => {
    const run = async () => {
      try {
        const persisted = getPersistedAuthToken();
        if (!persisted) {
          clearSession();
          return;
        }

        const me = await fetchMe(persisted);
        applySession(persisted, me);
      } catch {
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, [applySession, clearSession]);

  const registerAndSignIn = useCallback(async (input: { email: string; password: string; displayName?: string }) => {
    const payload = await register(input);
    applySession(payload.session.accessToken, payload.user);
  }, [applySession]);

  const signIn = useCallback(async (input: { email: string; password: string }) => {
    const payload = await login(input);
    applySession(payload.session.accessToken, payload.user);
  }, [applySession]);

  const signOut = useCallback(async () => {
    try {
      await logout(token ?? getPersistedAuthToken());
    } finally {
      clearSession();
    }
  }, [clearSession, token]);

  const removeAccount = useCallback(async (password: string) => {
    await deleteMyAccount(password, token ?? getPersistedAuthToken());
    clearSession();
  }, [clearSession, token]);

  const value = useMemo<AuthSessionContextValue>(() => ({
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(user && token),
    registerAndSignIn,
    signIn,
    signOut,
    refreshMe,
    removeAccount,
  }), [user, token, isLoading, registerAndSignIn, signIn, signOut, refreshMe, removeAccount]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error("useAuthSession must be used within AuthSessionProvider");
  }

  return context;
}
