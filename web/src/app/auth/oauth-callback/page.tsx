"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthSession } from "@/features/auth/auth-session";

function OAuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshMe } = useAuthSession();

  useEffect(() => {
    const run = async () => {
      const next = params.get("next") ?? "/workspace";
      try {
        // server should have set cookie or token; refresh session from context
        await refreshMe();
      } catch {
        // ignore
      }

      const safeNext = next && next.startsWith("/") ? next : "/workspace";
      router.replace(safeNext);
    };

    void run();
  }, [params, router, refreshMe]);

  return <div className="p-8">Signing you in...</div>;
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="p-8">Preparing sign-in...</div>}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
