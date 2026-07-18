import styles from "./Wordmark.module.css";

/** The VERMILION wordmark — Sanguine Frost, all-caps (DESIGN §2). Display only. */
export function Wordmark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span className={`${styles.wordmark} ${styles[size]} ${className ?? ""}`}>
      Vermilion
    </span>
  );
}
