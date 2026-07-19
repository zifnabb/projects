import type { ColorLetter } from "../../lib/types";
import styles from "./ColorPipBar.module.css";

const WUBRG: ColorLetter[] = ["W", "U", "B", "R", "G"];

const COLOR_NAMES: Record<string, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
  C: "Colorless",
};

/** WUBRG-ordered identity pips; colorless → a single C pip (DESIGN §3.4). */
export function ColorPipBar({
  identity,
  className,
}: {
  identity: ColorLetter[] | null | undefined;
  className?: string;
}) {
  const colors: string[] =
    identity && identity.length > 0
      ? WUBRG.filter((c) => identity.includes(c))
      : ["C"];

  const label = colors.map((c) => COLOR_NAMES[c]).join(", ");

  return (
    <span
      className={`${styles.bar} ${className ?? ""}`}
      role="img"
      aria-label={`Color identity: ${label}`}
    >
      {colors.map((c) => (
        <span
          key={c}
          className={styles.pip}
          style={{
            background: `var(--wubrg-${c.toLowerCase()}-fill)`,
            borderColor: `var(--wubrg-${c.toLowerCase()}-glyph)`,
          }}
        />
      ))}
    </span>
  );
}
