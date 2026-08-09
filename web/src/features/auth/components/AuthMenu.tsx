"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAuthSession } from "@/features/auth/auth-session";

export function AuthMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useToast();
  const { user, isLoading, isAuthenticated, signOut } = useAuthSession();
  const authHref = useMemo(() => {
    const query = searchParams.toString();
    const nextPath = `${pathname}${query ? `?${query}` : ""}`;
    return `/auth?next=${encodeURIComponent(nextPath)}`;
  }, [pathname, searchParams]);

  if (isLoading) {
    return <span className="text-xs text-muted-foreground">Checking session...</span>;
  }

  if (!isAuthenticated || !user) {
    return (
      <Link href={authHref} className="inline-flex">
        <Button type="button" variant="outline" size="sm" data-testid="auth-open-button">
          Sign in
        </Button>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-muted-foreground md:inline">{user.email}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          await signOut();
          showToast({ title: "Signed out", description: "Session closed." });
          router.push("/");
        }}
        data-testid="auth-signout-button"
      >
        Sign out
      </Button>
    </div>
  );
}
