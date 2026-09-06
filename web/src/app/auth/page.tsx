"use client";

import { useEffect, useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";
import { useAuthSession } from "@/features/auth/auth-session";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

interface AuthProvidersStatus {
  github: { configured: boolean };
  google: { configured: boolean };
}

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Authentication failed.";
}

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useToast();
  const { signIn, registerAndSignIn } = useAuthSession();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [providers, setProviders] = useState<AuthProvidersStatus>({
    github: { configured: false },
    google: { configured: false },
  });
  const nextTarget = searchParams.get("next");
  useEffect(() => {
    const requested = searchParams.get("mode");
    if (requested === "login" || requested === "register") {
      setMode(requested);
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    fetch(`${API_BASE}/v1/auth/providers`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load providers (${response.status})`);
        }
        return response.json() as Promise<AuthProvidersStatus>;
      })
      .then((data) => {
        if (!active) return;
        setProviders({
          github: { configured: Boolean(data?.github?.configured) },
          google: { configured: Boolean(data?.google?.configured) },
        });
      })
      .catch(() => {
        if (!active) return;
        setProviders({
          github: { configured: false },
          google: { configured: false },
        });
      });

    return () => {
      active = false;
    };
  }, []);

  const oauthNextSuffix = nextTarget ? `?next=${encodeURIComponent(nextTarget)}` : "";

  const startOauth = (provider: "github" | "google") => {
    const configured = provider === "github" ? providers.github.configured : providers.google.configured;
    if (!configured) {
      showToast({
        title: "OAuth unavailable",
        description: `${provider === "github" ? "GitHub" : "Google"} OAuth is not configured in this environment. Use email/password sign-in.`,
      });
      return;
    }

    window.location.href = `${API_BASE}/v1/auth/oauth/${provider}${oauthNextSuffix}`;
  };

  const submit = async () => {
    setIsBusy(true);
    try {
      if (mode === "register") {
        await registerAndSignIn({ email, password, displayName: displayName || undefined });
        showToast({ title: "Welcome", description: "Account created and signed in." });
      } else {
        await signIn({ email, password });
        showToast({ title: "Signed in", description: "Session restored." });
      }

      const safeNext = nextTarget && nextTarget.startsWith("/") ? nextTarget : "/workspace";
      router.push(safeNext);
    } catch (error) {
      showToast({ title: "Auth failed", description: formatError(error) });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-4 py-16">
      <section className="lex-panel w-full rounded-[var(--radius-3xl)] p-6" data-testid="auth-card">
        <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">LexGraph workspace</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{mode === "register" ? "Create account" : "Sign in"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Build your personal map of linguistic discoveries.</p>

        <div className="mt-4 flex gap-2">
          <Button type="button" variant={mode === "register" ? "default" : "outline"} onClick={() => setMode("register")}>
            Register
          </Button>
          <Button type="button" variant={mode === "login" ? "default" : "outline"} onClick={() => setMode("login")}>
            Login
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {mode === "register" ? (
            <Input
              placeholder="Display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              data-testid="auth-display-name-input"
            />
          ) : null}

          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            data-testid="auth-email-input"
          />

          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            data-testid="auth-password-input"
          />

          <Button type="button" className="w-full" onClick={submit} disabled={isBusy} data-testid="auth-submit-button">
            {isBusy ? "Submitting..." : mode === "register" ? "Create account" : "Sign in"}
          </Button>
          <div className="mt-2 space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              data-icon="inline-start"
              disabled={!providers.github.configured}
              onClick={() => startOauth("github")}
            >
              <span className="flex items-center gap-2">
                <img src="/icons/github.svg" alt="" className="size-4" />
                Continue with GitHub
              </span>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              data-icon="inline-start"
              disabled={!providers.google.configured}
              onClick={() => startOauth("google")}
            >
              <span className="flex items-center gap-2">
                <img src="/icons/google.svg" alt="" className="size-4" />
                Continue with Google
              </span>
            </Button>

            {!providers.github.configured || !providers.google.configured ? (
              <p className="text-xs text-muted-foreground">
                OAuth providers are disabled in this environment. Use email/password to sign in locally.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-4 py-16">Loading...</main>}>
      <AuthContent />
    </Suspense>
  );
}
