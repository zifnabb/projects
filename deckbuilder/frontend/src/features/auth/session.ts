import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../lib/api";
import type { CurrentUser } from "../../lib/types";
import { authApi } from "./api";

export const SESSION_KEY = ["session"] as const;

/**
 * The current session. `/api/auth/me` returns 401 when logged out; we map that
 * to `null` (a valid "no session" state) rather than an error so screens can
 * branch on `user` cleanly. The result is cached indefinitely and mutated in
 * place by login/logout instead of refetching.
 */
export function useSession() {
  const query = useQuery<CurrentUser | null>({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/** Write the session cache after login/register (avoids a refetch round-trip). */
export function useSetSession() {
  const qc = useQueryClient();
  return (user: CurrentUser | null) => qc.setQueryData(SESSION_KEY, user);
}
