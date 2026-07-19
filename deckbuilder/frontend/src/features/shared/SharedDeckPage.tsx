/**
 * Shared read-only deck view (PLAN §13 / DESIGN §8.7) — public, token-gated,
 * no auth, no edit chrome. A visibly reduced builder: wordmark, deck header
 * facts, the board (list view), basic stats.
 */
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Wordmark } from "../../components/ui/Wordmark";
import { ColorPipBar } from "../../components/mtg/ColorPipBar";
import { LegalityPill } from "../../components/mtg/Pill";
import { ManaCost } from "../../components/mtg/ManaCost";
import { decksApi } from "../decks/api";
import { buildColumns, columnQty } from "../builder/grouping";
import { timeAgo } from "../../lib/timeAgo";
import styles from "./SharedDeckPage.module.css";

export function SharedDeckPage() {
  const { token } = useParams<{ token: string }>();
  const { data: deck, isLoading, isError } = useQuery({
    queryKey: ["shared", token],
    queryFn: () => decksApi.shared(token!),
    enabled: !!token,
    retry: false,
  });

  if (isLoading) return null;

  if (isError || !deck) {
    return (
      <div className={styles.shell}>
        <Wordmark size="lg" />
        <p className={styles.missing}>
          This shared deck doesn't exist — the link may have been revoked.
        </p>
      </div>
    );
  }

  const columns = buildColumns(
    deck,
    deck.categories.length > 0 ? "categories" : "type",
    "mv",
  );

  return (
    <div className={styles.shell}>
      <Wordmark size="md" />
      <header className={styles.header}>
        <h1 className={styles.title}>{deck.name}</h1>
        <ColorPipBar identity={deck.color_identity} />
        <LegalityPill legal={deck.legality.legal} />
        <span className={styles.meta}>
          {deck.format_info.name} · {deck.legality.size}
          {deck.legality.target_size ? `/${deck.legality.target_size}` : ""} cards ·
          updated {timeAgo(deck.updated_at)}
        </span>
      </header>
      {deck.description && <p className={styles.description}>{deck.description}</p>}

      <div className={styles.columns}>
        {columns
          .filter((c) => c.rows.length > 0)
          .map((col) => (
            <section key={col.key} className={styles.column}>
              <div className={styles.colHeader}>
                <span className={styles.colName}>{col.name}</span>
                <span className={styles.colQty}>{columnQty(col)}</span>
              </div>
              {col.rows.map((row) => (
                <div key={row.id} className={styles.row}>
                  <span className={styles.qty}>{row.quantity}</span>
                  <span className={styles.name}>{row.card.name}</span>
                  <ManaCost cost={row.card.mana_cost} className={styles.cost} />
                </div>
              ))}
            </section>
          ))}
      </div>

      <footer className={styles.footer}>read-only · shared from vermilion</footer>
    </div>
  );
}
