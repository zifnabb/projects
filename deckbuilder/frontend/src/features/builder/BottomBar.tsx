import { BarChart3, Search, Tags } from "lucide-react";
import styles from "./BottomBar.module.css";

/**
 * Phone-only sticky bottom action bar (DESIGN §6.4). Thumb-reach summoners for
 * the three full-screen sheets that otherwise live in the top toolbar — so you
 * can add cards / manage categories / check stats without scrolling back up.
 * Hidden ≥768px (the desktop toolbar is always visible). Sits at --z-rail, so an
 * open sheet (--z-overlay) or modal (--z-modal) covers it.
 */
export function BottomBar({
  searchOpen,
  statsOpen,
  onToggleSearch,
  onToggleStats,
  onManageCategories,
}: {
  searchOpen: boolean;
  statsOpen: boolean;
  onToggleSearch: () => void;
  onToggleStats: () => void;
  onManageCategories: () => void;
}) {
  return (
    <nav className={styles.bar} aria-label="Deck actions">
      <button
        type="button"
        className={styles.item}
        data-active={searchOpen}
        onClick={onToggleSearch}
      >
        <Search size={20} aria-hidden="true" />
        <span className={styles.label}>Search</span>
      </button>
      <button type="button" className={styles.item} onClick={onManageCategories}>
        <Tags size={20} aria-hidden="true" />
        <span className={styles.label}>Categories</span>
      </button>
      <button
        type="button"
        className={styles.item}
        data-active={statsOpen}
        onClick={onToggleStats}
      >
        <BarChart3 size={20} aria-hidden="true" />
        <span className={styles.label}>Stats</span>
      </button>
    </nav>
  );
}
