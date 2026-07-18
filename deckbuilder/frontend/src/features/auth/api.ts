import { api } from "../../lib/api";
import type { CurrentUser } from "../../lib/types";

export interface InviteCheck {
  valid: boolean;
  note: string | null;
}

export const authApi = {
  me: () => api.get<CurrentUser>("/api/auth/me"),

  login: (username: string, password: string) =>
    api.post<CurrentUser>("/api/auth/login", { username, password }),

  logout: () => api.post<{ ok: boolean }>("/api/auth/logout"),

  checkInvite: (code: string) =>
    api.get<InviteCheck>(`/api/auth/invite/${encodeURIComponent(code)}`),

  register: (body: {
    invite: string;
    username: string;
    password: string;
    display_name?: string;
  }) => api.post<CurrentUser>("/api/auth/register", body),

  reset: (token: string, new_password: string) =>
    api.post<CurrentUser>("/api/auth/reset", { token, new_password }),
};
