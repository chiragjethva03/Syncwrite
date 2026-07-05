"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

/**
 * TanStack Query client for server state (documents list, versions, AI).
 * The offline document *body* is NOT managed here — that lives in IndexedDB and
 * the sync engine. Query handles the classic request/response server state
 * (lists, metadata) where stale-while-revalidate caching shines.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
