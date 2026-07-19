/**
 * Mana cost string → mana-font pips (DESIGN §5). "{2}{R}" → ⓶🔴 etc.
 * Handles hybrids {W/U}, phyrexian {W/P}, split costs "A // B".
 */

const SYMBOL_RE = /\{([^}]+)\}/g;

function symbolClass(raw: string): string {
  // "W/U" → "wu", "W/P" → "wp", "2/W" → "2w", "T" → "tap"
  const token = raw.replace(/\//g, "").toLowerCase();
  return token === "t" ? "tap" : token === "q" ? "untap" : token;
}

export function ManaCost({
  cost,
  className,
}: {
  cost: string | null | undefined;
  className?: string;
}) {
  if (!cost) return null;

  const parts = cost.split(" // ");
  return (
    <span className={className} aria-label={`Mana cost ${cost}`} role="img">
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden="true"> // </span>}
          {Array.from(part.matchAll(SYMBOL_RE), (m, j) => (
            <i
              key={j}
              className={`ms ms-${symbolClass(m[1])} ms-cost`}
              aria-hidden="true"
            />
          ))}
        </span>
      ))}
    </span>
  );
}
