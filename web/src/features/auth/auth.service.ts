import { apiFetch, persistAuthToken } from "@/lib/api-client";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: string;
}

export interface AuthPayload {
  user: AuthUser;
  session: AuthSession;
}

export async function register(input: { email: string; password: string; displayName?: string }): Promise<AuthPayload> {
  const payload = await apiFetch<AuthPayload>("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  persistAuthToken(payload.session.accessToken);
  return payload;
}

export async function login(input: { email: string; password: string }): Promise<AuthPayload> {
  const payload = await apiFetch<AuthPayload>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  persistAuthToken(payload.session.accessToken);
  return payload;
}

export async function fetchMe(token?: string | null): Promise<AuthUser> {
  return apiFetch<AuthUser>("/v1/me", { method: "GET" }, token);
}

export async function logout(token?: string | null): Promise<void> {
  try {
    await apiFetch<void>("/v1/auth/logout", { method: "POST" }, token);
  } finally {
    persistAuthToken(null);
  }
}

export async function deleteMyAccount(password: string, token?: string | null): Promise<void> {
  try {
    await apiFetch<void>("/v1/me", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    }, token);
  } finally {
    persistAuthToken(null);
  }
}
