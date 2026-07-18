/**
 * Home dashboard — PLACEHOLDER for the auth vertical slice. Proves the guarded
 * route, session identity, theme toggle, and logout. The real dashboard
 * (deck grid + unified search, PLAN §10 / DESIGN §8.2) replaces the body next.
 */
import { LogOut, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { Wordmark } from "../../components/ui/Wordmark";
import { useTheme } from "../../theme/ThemeProvider";
import { authApi } from "../auth/api";
import { useSession, useSetSession } from "../auth/session";

export function HomePage() {
  const { user } = useSession();
  const setSession = useSetSession();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      setSession(null);
      navigate("/login", { replace: true });
    },
  });

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--space-6)",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <Wordmark size="sm" />
        <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout.mutate()}
            loading={logout.isPending}
          >
            <LogOut size={16} />
            Sign out
          </Button>
        </div>
      </header>

      <main style={{ padding: "var(--space-9)", maxWidth: 960, margin: "0 auto" }}>
        <h2 className="t-h2">Your decks</h2>
        <p className="t-caption">
          Signed in as <strong>{user?.display_name}</strong> (@{user?.username})
          {user?.is_admin ? " · admin" : ""} — deck grid lands here next.
        </p>
      </main>
    </div>
  );
}
