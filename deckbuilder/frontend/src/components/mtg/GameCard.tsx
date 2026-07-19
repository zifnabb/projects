import type { CardSummary } from "../../lib/types";
import { ManaCost } from "./ManaCost";
import styles from "./GameCard.module.css";

/** Pick the best CDN image for a ~200-320px wide rendering. */
export function cardImage(card: CardSummary | undefined): string | null {
  const img = card?.image;
  if (!img) return null;
  return img.normal ?? img.large ?? img.small ?? img.png ?? null;
}

/**
 * GameCard (DESIGN §7.6-1) — an actual MTG card. Image when available
 * (hotlinked from Scryfall CDN, PLAN §5), styled text fallback otherwise.
 */
export function GameCard({
  card,
  quantity,
  className,
}: {
  card: CardSummary;
  quantity?: number;
  className?: string;
}) {
  const src = cardImage(card);
  return (
    <div className={`${styles.frame} ${className ?? ""}`}>
      {src ? (
        <img src={src} alt={card.name ?? "card"} loading="lazy" />
      ) : (
        <div className={styles.fallback}>
          <span className={styles.fallbackName}>
            {card.name} <ManaCost cost={card.mana_cost} />
          </span>
          <span className={styles.fallbackType}>{card.type_line}</span>
        </div>
      )}
      {quantity != null && quantity > 1 && (
        <span className={styles.qtyBadge}>×{quantity}</span>
      )}
    </div>
  );
}
