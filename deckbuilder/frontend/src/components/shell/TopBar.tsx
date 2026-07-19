import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LayoutGrid, LogOut, Moon, Plus, Settings, Shield, Sun } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Button } from "../ui/Button";
import { Wordmark } from "../ui/Wordmark";
import { useTheme } from "../../theme/ThemeProvider";
import { authApi } from "../../features/auth/api";
import { useSession, useSetSession } from "../../features/auth/session";
import { UnifiedSearch } from "./UnifiedSearch";
import styles from "./TopBar.module.css";

/** App-shell top bar (DESIGN §6.2-A): wordmark · unified search · theme ·
 * + New Deck · user menu (Account / Admin / sign out). */
export function TopBar({
  onNewDeck,
  onOpenCard,
}: {
  onNewDeck: () => void;
  onOpenCard: (oracleId: string) => void;
}) {
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

  const initials = (user?.display_name || user?.username || "?")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className={styles.bar}>
      <Link to="/" className={styles.brandLink} aria-label="Home">
        <Wordmark size="sm" />
      </Link>

      <Button variant="ghost" size="sm" asChild>
        <Link to="/">
          <LayoutGrid size={15} aria-hidden="true" />
          Your decks
        </Link>
      </Button>

      <span className={styles.spacer} />
      <UnifiedSearch onOpenCard={onOpenCard} />
      <span className={styles.spacer} />

      <div className={styles.right}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={toggle}
          aria-label={
            theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
          }
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <Button variant="primary" size="md" onClick={onNewDeck}>
          <Plus size={16} aria-hidden="true" />
          New Deck
        </Button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className={styles.avatar} aria-label="User menu">
              {initials}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={styles.menuContent}
              align="end"
              sideOffset={8}
            >
              <div className={styles.menuHeader}>
                <div className={styles.menuName}>{user?.display_name}</div>
                <div className={styles.menuUsername}>@{user?.username}</div>
              </div>
              <DropdownMenu.Item
                className={styles.menuItem}
                onSelect={() => navigate("/account")}
              >
                <Settings size={16} aria-hidden="true" />
                Account
              </DropdownMenu.Item>
              {user?.is_admin && (
                <DropdownMenu.Item
                  className={styles.menuItem}
                  onSelect={() => navigate("/admin")}
                >
                  <Shield size={16} aria-hidden="true" />
                  Admin
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item
                className={styles.menuItem}
                onSelect={() => logout.mutate()}
              >
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
