/** Shared API types. Mirrors backend `_user_out` (auth.py). */

export type Theme = "dark" | "light";

export interface CurrentUser {
  id: string; // UUID
  username: string;
  display_name: string;
  is_admin: boolean;
  theme_pref: Theme | null;
}
