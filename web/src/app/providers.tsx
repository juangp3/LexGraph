"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect } from "react";

const queryClient = new QueryClient();

async function enableMocking() {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const { worker } = await import("@/mocks/browser");

  // `worker.start()` returns a Promise that resolves
  // once the Service Worker is up and running.
  return worker.start({ onUnhandledRequest: "bypass" });
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    enableMocking();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
