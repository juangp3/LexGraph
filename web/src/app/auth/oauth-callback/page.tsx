"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthSession } from "@/features/auth/auth-session";
import { fetchMe } from "@/features/auth/auth.service";

function OAuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { registerAndSignIn, signIn } = useAuthSession();

  useEffect(() => {
    const run = async () => {
      const next = params.get("next") ?? "/workspace";
      try {
        // server should have set cookie; fetch current user
        await fetchMe();
      } catch {
        // ignore
      }

      const safeNext = next && next.startsWith("/") ? next : "/workspace";
      router.replace(safeNext);
    };

    void run();
  }, [params, router, registerAndSignIn, signIn]);

  return <div className="p-8">Signing you in...</div>;
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="p-8">Preparing sign-in...</div>}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
