"use client";

import { useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";
import { useAuthSession } from "@/features/auth/auth-session";

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
  const nextTarget = searchParams.get("next");

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
