import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Wordmark } from "../../components/ui/Wordmark";
import { useTheme } from "../../theme/ThemeProvider";
import styles from "./AuthLayout.module.css";

/** Focused shell used by all logged-out surfaces (sign in / register / reset). */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { theme, toggle } = useTheme();
  return (
    <div className={styles.shell}>
      <button
        type="button"
        className={styles.themeToggle}
        onClick={toggle}
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className={styles.wordmarkRow}>
        <Wordmark size="lg" />
      </div>

      <div className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
