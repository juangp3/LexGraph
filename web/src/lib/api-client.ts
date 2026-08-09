export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export const AUTH_TOKEN_STORAGE_KEY = "lexgraph:auth-token";

export interface ApiErrorShape {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function readTokenFromStorage(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function persistAuthToken(token: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!token) {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function getPersistedAuthToken(): string | null {
  return readTokenFromStorage();
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, authToken?: string | null): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  const resolvedToken = authToken ?? getPersistedAuthToken();
  if (resolvedToken) {
    headers.set("Authorization", `Bearer ${resolvedToken}`);
  }
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let payload: ApiErrorShape | null = null;
    try {
      payload = (await response.json()) as ApiErrorShape;
    } catch {
      payload = null;
    }

    const code = payload?.error?.code ?? "REQUEST_FAILED";
    const message = payload?.error?.message ?? payload?.message ?? `Request failed (${response.status})`;
    throw new ApiError(response.status, code, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
