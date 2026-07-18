/**
 * Theme context (DESIGN §10). Owns the `data-theme` attribute on <html>,
 * persists to localStorage for flash-free first paint, and mirrors the choice
 * to the server (`users.theme_pref`) when a session exists. First paint is set
 * by an inline script in index.html BEFORE React mounts — this provider just
 * takes over and keeps state in sync.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Theme } from "../lib/types";

const STORAGE_KEY = "vermilion-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme, opts?: { persistServer?: boolean }) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/** Persist theme to the server; best-effort (dropped if logged out / offline). */
async function persistThemeToServer(theme: Theme): Promise<void> {
  try {
    await fetch("/api/auth/me", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme_pref: theme }),
    });
  } catch {
    /* not logged in or offline — localStorage still holds the pref */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback(
    (t: Theme, opts?: { persistServer?: boolean }) => {
      setThemeState(t);
      if (opts?.persistServer) void persistThemeToServer(t);
    },
    [],
  );

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      void persistThemeToServer(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
