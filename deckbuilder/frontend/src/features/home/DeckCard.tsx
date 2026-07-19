import { ImageOff } from "lucide-react";
import { Link } from "react-router-dom";
import { ColorPipBar } from "../../components/mtg/ColorPipBar";
import { LegalityPill, TagPill } from "../../components/mtg/Pill";
import type { DeckListItem } from "../../lib/types";
import { timeAgo } from "../../lib/timeAgo";
import styles from "./DeckCard.module.css";

const FORMAT_LABELS: Record<string, string> = {
  commander: "Commander",
  freeform: "Freeform",
};

export function DeckCard({ deck }: { deck: DeckListItem }) {
  const legal = deck.tags.includes("Legal");
  const userTags = deck.tags.filter((t) => t !== "Legal" && t !== "Draft");

  return (
    <Link to={`/decks/${deck.id}`} className={styles.card}>
      <div className={styles.art}>
        {deck.art ? (
          <img src={deck.art} alt="" loading="lazy" />
        ) : (
          <ImageOff size={28} className={styles.artEmpty} aria-hidden="true" />
        )}
      </div>
      <div className={styles.body}>
        <h3 className={styles.name}>{deck.name}</h3>
        <div className={styles.metaRow}>
          <ColorPipBar identity={deck.color_identity} />
          <span>{FORMAT_LABELS[deck.format] ?? deck.format}</span>
          <span>·</span>
          <span>{deck.size} cards</span>
          <span>·</span>
          <span>{timeAgo(deck.updated_at)}</span>
        </div>
        <div className={styles.tagsRow}>
          <LegalityPill legal={legal} />
          {userTags.slice(0, 3).map((t) => (
            <TagPill key={t} tag={t} />
          ))}
        </div>
      </div>
    </Link>
  );
}
