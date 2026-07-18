import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";

/**
 * App-wide query defaults. Card/search data is highly cacheable (PLAN §5/§8
 * cache ≥24h); the client keeps a generous staleTime and never retries auth
 * failures (a 401 means "log in", not "try again").
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5m default; per-query overrides for card data
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
