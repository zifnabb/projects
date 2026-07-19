/**
 * Deck builder — PLACEHOLDER. The full Builder shell (Stacks board, toolbar,
 * rails — PLAN §11 / DESIGN §8.4) is the next slice; this page proves the
 * route, the deck query, and the create→land flow.
 */
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ColorPipBar } from "../../components/mtg/ColorPipBar";
import { LegalityPill } from "../../components/mtg/Pill";
import { timeAgo } from "../../lib/timeAgo";
import { decksApi } from "../decks/api";

export function BuilderPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const { data: deck, isLoading } = useQuery({
    queryKey: ["deck", deckId],
    queryFn: () => decksApi.get(deckId!),
    enabled: !!deckId,
  });

  if (isLoading || !deck) return null;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "var(--space-9)" }}>
      <Link
        to="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          marginBottom: "var(--space-6)",
        }}
      >
        <ArrowLeft size={14} aria-hidden="true" /> Your decks
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
        <h1 className="t-h1" style={{ margin: 0 }}>
          {deck.name}
        </h1>
        <ColorPipBar identity={deck.color_identity} />
        <LegalityPill legal={deck.legality.legal} />
      </div>
      <p className="t-caption" style={{ marginTop: "var(--space-4)" }}>
        {deck.format_info.name} · {deck.legality.size}
        {deck.legality.target_size ? `/${deck.legality.target_size}` : ""} cards ·
        updated {timeAgo(deck.updated_at)}
      </p>
      <p className="t-caption" style={{ marginTop: "var(--space-6)" }}>
        {deck.categories.length > 0
          ? `Template categories seeded: ${deck.categories.map((c) => c.name).join(" · ")}`
          : "No categories — the board will group by Type."}
      </p>
      <p className="t-caption" style={{ opacity: 0.7 }}>
        The Stacks board lands here next.
      </p>
    </div>
  );
}
