import { Check } from "lucide-react";
import styles from "./Pill.module.css";

/** Legal ✓ / Draft • status pill — same footprint so the flip animates in place. */
export function LegalityPill({ legal }: { legal: boolean }) {
  return legal ? (
    <span className={`${styles.pill} ${styles.legal}`}>
      <Check size={11} strokeWidth={3} aria-hidden="true" />
      Legal
    </span>
  ) : (
    <span className={`${styles.pill} ${styles.draft}`}>
      <span className={styles.dot} aria-hidden="true" />
      Draft
    </span>
  );
}

/** Plain user-tag chip. */
export function TagPill({ tag }: { tag: string }) {
  return <span className={`${styles.pill} ${styles.tag}`}>{tag}</span>;
}
