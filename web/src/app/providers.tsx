"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect } from "react";

const queryClient = new QueryClient();

async function enableMocking() {
  const isDev = process.env.NODE_ENV === "development";
  const enableMsw = process.env.NEXT_PUBLIC_ENABLE_MSW === "true";

  if (!isDev || !enableMsw) {
    console.log("[LexGraph] Production mode: MSW disabled, using live backend only");
    return;
  }

  console.log("[LexGraph] Development mode: MSW enabled for intercepting local requests");
  const { worker } = await import("@/mocks/browser");

  try {
    await worker.start({ 
      onUnhandledRequest: "bypass",  // Pass through unhandled requests to backend
    });
    console.log("[LexGraph] MSW successfully started");
  } catch (error) {
    console.warn("[LexGraph] MSW initialization failed:", error);
    // In development, warn but continue - will call backend directly
  }
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
