"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAuthSession } from "@/features/auth/auth-session";
import { ApiError } from "@/lib/api-client";
import { exportWorkspace, getPreferences, updatePreferences } from "@/features/workspace/workspace.service";

function message(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Operation failed.";
}

export default function WorkspaceSettingsPage() {
  const auth = useAuthSession();
  const showToast = useToast();
  const queryClient = useQueryClient();
  const MIN_DEPTH = 1;
  const MAX_DEPTH = 8;

  const [depth, setDepth] = useState<number>(3);
  const [layout, setLayout] = useState<string>("hierarchical");
  const [deletePassword, setDeletePassword] = useState("");

  const preferencesQuery = useQuery({
    queryKey: ["workspace-preferences"],
    queryFn: getPreferences,
    enabled: auth.isAuthenticated,
  });

  useEffect(() => {
    if (!preferencesQuery.data) return;
    const p = preferencesQuery.data;
    if (typeof p.defaultGraphDepth === 'number') setDepth(Math.max(MIN_DEPTH, Math.min(MAX_DEPTH, Math.trunc(p.defaultGraphDepth))));
    if (typeof p.graphLayout === 'string' && p.graphLayout.length) setLayout(p.graphLayout);
  }, [preferencesQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async () => updatePreferences({
      defaultGraphDepth: depth,
      graphLayout: layout,
    }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["workspace-preferences"], updated);
      void queryClient.invalidateQueries({ queryKey: ["workspace-preferences"] });
      showToast({ title: "Preferences saved", description: "Workspace settings updated." });
    },
    onError: (error) => {
      showToast({ title: "Save failed", description: message(error) });
    },
  });

  const exportMutation = useMutation({
    mutationFn: exportWorkspace,
    onSuccess: (payload) => {
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lexgraph-workspace-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast({ title: "Export ready", description: "Workspace export downloaded." });
    },
    onError: (error) => {
      showToast({ title: "Export failed", description: message(error) });
    },
  });

  if (!auth.isAuthenticated) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <section className="lex-panel rounded-[var(--radius-3xl)] p-6">
          <h1 className="text-2xl font-semibold tracking-tight">Workspace settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to manage account, preferences, and data export.</p>
          <Link href="/auth" className="mt-4 inline-flex">
            <Button type="button">Sign in</Button>
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10" data-testid="workspace-settings-page">
      <section className="lex-panel rounded-[var(--radius-3xl)] p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Workspace settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Account, preferences, and data ownership controls.</p>

        <div className="mt-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Preferences</h2>
            <p className="text-sm text-muted-foreground">Default graph behavior for your workspace.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input
                type="number"
                value={String(depth)}
                onChange={(event) => {
                  const v = Number(event.target.value);
                  if (Number.isNaN(v)) return setDepth(MIN_DEPTH);
                  setDepth(Math.max(MIN_DEPTH, Math.min(MAX_DEPTH, Math.trunc(v))));
                }}
                min={MIN_DEPTH}
                max={MAX_DEPTH}
                placeholder="Default graph depth"
                data-testid="settings-depth-input"
              />

              <select
                value={layout}
                onChange={(event) => setLayout(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                data-testid="settings-layout-input"
              >
                <option value="hierarchical">Hierarchical</option>
                <option value="force-directed">Force-directed</option>
                <option value="radial">Radial</option>
                <option value="grid">Grid</option>
              </select>
            </div>
            <Button
              type="button"
              className="mt-3"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || depth < MIN_DEPTH || depth > MAX_DEPTH}
              data-testid="settings-save-preferences-button"
            >
              Save preferences
            </Button>
            {preferencesQuery.data ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Current: depth {preferencesQuery.data.defaultGraphDepth}, layout {preferencesQuery.data.graphLayout}
              </p>
            ) : null}
          </div>

          <div>
            <h2 className="text-lg font-semibold">Data</h2>
            <p className="text-sm text-muted-foreground">Export your workspace as JSON.</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              data-testid="settings-export-button"
            >
              Export workspace
            </Button>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-destructive">Delete account</h2>
            <p className="text-sm text-muted-foreground">This will revoke your session and delete/anonymize account data.</p>
            <Input
              className="mt-3"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              type="password"
              placeholder="Confirm password"
              data-testid="settings-delete-password-input"
            />
            <Button
              type="button"
              variant="outline"
              className="mt-3 border-destructive/60 text-destructive"
              onClick={async () => {
                try {
                  await auth.removeAccount(deletePassword);
                  showToast({ title: "Account deleted", description: "Your account has been removed." });
                } catch (error) {
                  showToast({ title: "Delete failed", description: message(error) });
                }
              }}
              data-testid="settings-delete-account-button"
            >
              Delete account
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
