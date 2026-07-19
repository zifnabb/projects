import { useState } from "react";
import { FlipHorizontal, Sparkles } from "lucide-react";
import type { CardSummary } from "../../lib/types";
import { ManaCost } from "./ManaCost";
import styles from "./GameCard.module.css";

function pickImage(img: Record<string, string> | undefined): string | null {
  if (!img) return null;
  return img.normal ?? img.large ?? img.small ?? img.png ?? null;
}

/** Pick the best CDN image for a ~200-320px wide rendering. Falls back to the
 * front face for double-faced cards (their top-level image is null). */
export function cardImage(card: CardSummary | undefined): string | null {
  const top = pickImage(card?.image);
  if (top) return top;
  const faces = card?.faces;
  if (faces && faces.length > 0) return pickImage(faces[0].image);
  return null;
}

/** True for cards with two renderable faces (transform / modal_dfc / flip). */
export function isDoubleFaced(card: CardSummary | undefined): boolean {
  const faces = card?.faces;
  return !!faces && faces.length >= 2 && !!pickImage(faces[0].image) && !!pickImage(faces[1].image);
}

/**
 * GameCard (DESIGN §7.6-1) — an actual MTG card. Image when available
 * (hotlinked from Scryfall CDN, PLAN §5), styled text fallback otherwise.
 * Double-faced cards get a flip button; Game Changers get a corner label.
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
  const [face, setFace] = useState(0);
  const flippable = isDoubleFaced(card);
  // front face uses the printing-aware image (card.image reflects the selected
  // printing); the back face uses the oracle face art (no per-printing back art
  // in the summary). Non-flippable cards just use the printing-aware image.
  const src =
    flippable && face === 1
      ? pickImage(card.faces![1].image)
      : cardImage(card);
  const faceName = flippable ? card.faces![face].name : card.name;

  return (
    <div className={`${styles.frame} ${className ?? ""}`}>
      {src ? (
        <img src={src} alt={faceName ?? "card"} loading="lazy" />
      ) : (
        <div className={styles.fallback}>
          <span className={styles.fallbackName}>
            {card.name} <ManaCost cost={card.mana_cost} />
          </span>
          <span className={styles.fallbackType}>{card.type_line}</span>
        </div>
      )}

      {card.game_changer && (
        <span className={styles.gameChanger} title="Commander Game Changer">
          <Sparkles size={10} strokeWidth={2.5} aria-hidden="true" />
          GC
        </span>
      )}

      {flippable && (
        <button
          type="button"
          className={styles.flipButton}
          // sit in the GC slot when there's no GC badge stacked above
          style={card.game_changer ? undefined : { top: "11%" }}
          title={`Flip to ${card.faces![face === 0 ? 1 : 0].name ?? "other face"}`}
          aria-label="Flip card"
          onClick={(e) => {
            e.stopPropagation();
            setFace((f) => (f === 0 ? 1 : 0));
          }}
        >
          <FlipHorizontal size={14} aria-hidden="true" />
        </button>
      )}

      {quantity != null && quantity > 1 && (
        <span className={styles.qtyBadge}>×{quantity}</span>
      )}
    </div>
  );
}
