/**
 * Card detail panel (PLAN §9 / DESIGN §7.8, §8.5). Click any card → tabs:
 * Card Info (readable oracle text + deck controls) · More Info (set line,
 * legality grid, meta, printings) · Rulings (lazy, server-cached).
 * Context-adaptive: in-deck shows qty/printing/board/category/commander
 * controls; bare mode shows + Add to Deck.
 */
import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { Crown, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { ManaCost } from "../../components/mtg/ManaCost";
import { OracleText } from "../../components/mtg/OracleText";
import { ColorPipBar } from "../../components/mtg/ColorPipBar";
import type { DeckCardRow, DeckFull, DeckListItem } from "../../lib/types";
import { useCardDetail, useRulings, type PrintingOut } from "./api";
import styles from "./CardPanel.module.css";

const RARITY_COLOR: Record<string, string> = {
  common: "var(--color-text-muted)",
  uncommon: "#b7c7d3",
  rare: "#d9b65b",
  mythic: "#e07a3c",
  special: "#d08bc4",
  bonus: "#d08bc4",
};

const FORMAT_ORDER = [
  "standard", "pioneer", "modern", "legacy", "vintage",
  "commander", "oathbreaker", "brawl", "pauper", "penny",
];

export interface CardPanelState {
  oracleId: string;
  /** present → in-deck mode with edit controls */
  row?: DeckCardRow;
}

export interface CardPanelActions {
  setQuantity?: (row: DeckCardRow, quantity: number) => void;
  remove?: (row: DeckCardRow) => void;
  moveBoard?: (row: DeckCardRow, board: string) => void;
  moveCategory?: (row: DeckCardRow, categoryId: string | null) => void;
  setPrinting?: (row: DeckCardRow, printingId: string | null) => void;
  setCommander?: (oracleId: string | null) => void;
  addToDeck?: (oracleId: string) => void;
  /** home context: pick a target deck, then add */
  addToTarget?: (deckId: string, oracleId: string) => void;
  runQuery?: (query: string) => void;
}

const BOARDS = [
  { key: "main", label: "Main" },
  { key: "side", label: "Side" },
  { key: "maybe", label: "Maybe" },
];

export function CardPanel({
  state,
  deck,
  decks,
  actions,
  onClose,
}: {
  state: CardPanelState | null;
  deck?: DeckFull | null;
  /** home context: available target decks for Add-to-Deck */
  decks?: DeckListItem[];
  actions: CardPanelActions;
  onClose: () => void;
}) {
  const detail = useCardDetail(state?.oracleId ?? null).data;
  const [rulingsOpen, setRulingsOpen] = useState(false);
  const [targetDeck, setTargetDeck] = useState("");

  // row from the live deck (fresh after mutations)
  const row = useMemo(() => {
    if (!state?.row || !deck) return state?.row;
    return deck.cards.find((c) => c.id === state.row!.id) ?? undefined;
  }, [state, deck]);

  const selectedPrinting: PrintingOut | undefined = useMemo(() => {
    if (!detail) return undefined;
    const pid = row?.printing_id ?? detail.default_printing_id;
    return detail.printings.find((p) => p.id === pid) ?? detail.printings[0];
  }, [detail, row]);

  const rulings = useRulings(
    selectedPrinting?.id ?? detail?.default_printing_id ?? null,
    rulingsOpen,
  );

  if (!state) return null;

  const image =
    selectedPrinting?.image?.normal ??
    selectedPrinting?.image?.large ??
    detail?.image?.normal ??
    detail?.image?.large;

  const inDeck = !!row && !!deck;
  const isCommander = !!deck && deck.commander_oracle_id === state.oracleId;
  const commanderEligible =
    !!detail &&
    ((detail.type_line ?? "").toLowerCase().includes("legendary") &&
      (detail.type_line ?? "").toLowerCase().includes("creature")) ||
    (detail?.oracle_text ?? "").toLowerCase().includes("can be your commander");
  const singleton = !!deck?.format_info.singleton;
  const canIncrease = !singleton || row?.card.multiples_ok === true;

  return (
    <Dialog.Root open={!!state} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            {detail?.name ?? "Card"}
          </Dialog.Title>
          <Dialog.Close asChild>
            <button type="button" className={styles.close} aria-label="Close">
              <X size={16} />
            </button>
          </Dialog.Close>

          {/* left: the card (selected printing) */}
          <div className={styles.left}>
            {image ? (
              <img
                src={image}
                alt={detail?.name ?? "card"}
                style={{ width: "100%", borderRadius: "4.8%/3.4%" }}
              />
            ) : (
              <div
                style={{
                  aspectRatio: "63/88",
                  background: "var(--color-surface-sunken)",
                  borderRadius: 8,
                }}
              />
            )}
            {inDeck ? (
              <div className={styles.controls}>
                <div className={styles.controlRow}>
                  <span className={styles.controlLabel}>Qty</span>
                  <span className={styles.stepperRow}>
                    <button
                      type="button"
                      className={styles.stepBtn}
                      onClick={() =>
                        row!.quantity <= 1
                          ? (actions.remove?.(row!), onClose())
                          : actions.setQuantity?.(row!, row!.quantity - 1)
                      }
                    >
                      −
                    </button>
                    <span className={styles.stepQty}>{row!.quantity}</span>
                    <button
                      type="button"
                      className={styles.stepBtn}
                      disabled={!canIncrease}
                      onClick={() =>
                        canIncrease && actions.setQuantity?.(row!, row!.quantity + 1)
                      }
                    >
                      +
                    </button>
                  </span>
                </div>

                {row!.board !== "command" && (
                  <div className={styles.controlRow}>
                    <span className={styles.controlLabel}>Board</span>
                    <div className={styles.segmented}>
                      {BOARDS.map((b) => (
                        <button
                          key={b.key}
                          type="button"
                          className={styles.segment}
                          data-active={row!.board === b.key}
                          onClick={() =>
                            row!.board !== b.key && actions.moveBoard?.(row!, b.key)
                          }
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {deck!.categories.length > 0 && row!.board === "main" && (
                  <div className={styles.controlRow}>
                    <span className={styles.controlLabel}>Category</span>
                    <select
                      className={styles.select}
                      value={row!.category_id ?? ""}
                      onChange={(e) =>
                        actions.moveCategory?.(row!, e.target.value || null)
                      }
                    >
                      <option value="">Uncategorized</option>
                      {deck!.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {detail && detail.printings.length > 1 && (
                  <div className={styles.controlRow}>
                    <span className={styles.controlLabel}>Printing</span>
                    <select
                      className={styles.select}
                      value={selectedPrinting?.id ?? ""}
                      onChange={(e) => actions.setPrinting?.(row!, e.target.value || null)}
                    >
                      {detail.printings.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.set_name} ({p.set_code.toUpperCase()}) · {p.collector_number}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {commanderEligible && deck!.format_info.requires_commander && (
                  <Button
                    variant={isCommander ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() =>
                      actions.setCommander?.(isCommander ? null : state.oracleId)
                    }
                  >
                    <Crown size={14} aria-hidden="true" />
                    {isCommander ? "Unset commander" : "Set as commander"}
                  </Button>
                )}
              </div>
            ) : actions.addToDeck ? (
              <Button
                variant="primary"
                fullWidth
                onClick={() => {
                  actions.addToDeck!(state.oracleId);
                  onClose();
                }}
              >
                + Add to Deck
              </Button>
            ) : actions.addToTarget && decks && decks.length > 0 ? (
              <div className={styles.controls}>
                <select
                  className={styles.select}
                  value={targetDeck}
                  onChange={(e) => setTargetDeck(e.target.value)}
                  aria-label="Target deck"
                >
                  <option value="">Choose a deck…</option>
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  fullWidth
                  disabled={!targetDeck}
                  onClick={() => {
                    actions.addToTarget!(targetDeck, state.oracleId);
                    onClose();
                  }}
                >
                  + Add to Deck
                </Button>
              </div>
            ) : null}
          </div>

          {/* right: tabs */}
          <div className={styles.right}>
            <Tabs.Root
              defaultValue="info"
              onValueChange={(v) => v === "rulings" && setRulingsOpen(true)}
              style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
            >
              <Tabs.List className={styles.tabList}>
                <Tabs.Trigger className={styles.tab} value="info">
                  Card Info
                </Tabs.Trigger>
                <Tabs.Trigger className={styles.tab} value="more">
                  More Info
                </Tabs.Trigger>
                <Tabs.Trigger className={styles.tab} value="rulings">
                  Rulings
                </Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="info" className={styles.tabContent}>
                {detail && (
                  <>
                    <div className={styles.nameRow}>
                      <h3 className={styles.cardName}>{detail.name}</h3>
                      <ManaCost cost={detail.mana_cost} />
                    </div>
                    <div className={styles.typeLine}>
                      <span>{detail.type_line}</span>
                      <span>
                        {detail.power != null && detail.toughness != null
                          ? `${detail.power}/${detail.toughness}`
                          : detail.loyalty != null
                            ? `Loyalty ${detail.loyalty}`
                            : ""}
                      </span>
                    </div>
                    <div className={styles.hairline} />
                    <OracleText text={detail.oracle_text} />
                  </>
                )}
              </Tabs.Content>

              <Tabs.Content value="more" className={styles.tabContent}>
                {detail && (
                  <>
                    {selectedPrinting && (
                      <div className={styles.metaGrid}>
                        <span className={styles.metaKey}>Set</span>
                        <span>
                          <button
                            type="button"
                            className={styles.setLink}
                            onClick={() => {
                              actions.runQuery?.(`set:${selectedPrinting.set_code}`);
                              onClose();
                            }}
                            title={`Search set:${selectedPrinting.set_code}`}
                          >
                            {selectedPrinting.set_name}
                          </button>{" "}
                          ({selectedPrinting.set_code.toUpperCase()}) · #
                          {selectedPrinting.collector_number}
                          {selectedPrinting.released_at
                            ? ` · ${selectedPrinting.released_at}`
                            : ""}
                        </span>
                        <span className={styles.metaKey}>Rarity</span>
                        <span
                          style={{
                            color:
                              RARITY_COLOR[selectedPrinting.rarity ?? ""] ??
                              "var(--color-text)",
                            textTransform: "capitalize",
                          }}
                        >
                          {selectedPrinting.rarity}
                        </span>
                        {selectedPrinting.artist && (
                          <>
                            <span className={styles.metaKey}>Artist</span>
                            <span>{selectedPrinting.artist}</span>
                          </>
                        )}
                      </div>
                    )}
                    <div className={styles.hairline} />
                    <div className={styles.metaGrid}>
                      <span className={styles.metaKey}>Mana value</span>
                      <span>{detail.cmc ?? 0}</span>
                      <span className={styles.metaKey}>Identity</span>
                      <span>
                        <ColorPipBar identity={detail.color_identity} />
                      </span>
                      {detail.keywords && detail.keywords.length > 0 && (
                        <>
                          <span className={styles.metaKey}>Keywords</span>
                          <span>{detail.keywords.join(", ")}</span>
                        </>
                      )}
                      {detail.edhrec_rank != null && (
                        <>
                          <span className={styles.metaKey}>EDHREC</span>
                          <span>#{detail.edhrec_rank}</span>
                        </>
                      )}
                      {detail.reserved && (
                        <>
                          <span className={styles.metaKey}>Reserved</span>
                          <span>Reserved List</span>
                        </>
                      )}
                    </div>
                    <div className={styles.hairline} />
                    <span className={styles.sectionLabel}>Legalities</span>
                    <div className={styles.legalityGrid}>
                      {FORMAT_ORDER.filter((f) => detail.legalities?.[f]).map((f) => {
                        const status = detail.legalities![f];
                        return (
                          <span key={f} className={styles.legalRow}>
                            <span style={{ textTransform: "capitalize" }}>{f}</span>
                            <span
                              className={
                                status === "legal"
                                  ? styles.legalYes
                                  : status === "banned"
                                    ? styles.legalBanned
                                    : styles.legalNo
                              }
                            >
                              {status === "not_legal" ? "not legal" : status}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                    {detail.printings.length > 0 && (
                      <>
                        <div className={styles.hairline} />
                        <span className={styles.sectionLabel}>
                          All printings ({detail.printings.length})
                        </span>
                        <div>
                          {detail.printings.slice(0, 12).map((p) => (
                            <div key={p.id} className={styles.printingRow}>
                              <span>
                                {p.set_name} ({p.set_code.toUpperCase()})
                              </span>
                              <span>#{p.collector_number}</span>
                            </div>
                          ))}
                          {detail.printings.length > 12 && (
                            <div className={styles.quietNote}>
                              +{detail.printings.length - 12} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </Tabs.Content>

              <Tabs.Content value="rulings" className={styles.tabContent}>
                {rulings.isLoading ? (
                  <span className={styles.quietNote}>Loading rulings…</span>
                ) : rulings.data && !rulings.data.available ? (
                  <span className={styles.quietNote}>Rulings unavailable.</span>
                ) : rulings.data && rulings.data.rulings.length === 0 ? (
                  <span className={styles.quietNote}>No rulings for this card.</span>
                ) : (
                  rulings.data?.rulings.map((r, i) => (
                    <div key={i} className={styles.ruling}>
                      {r.comment}
                      {r.published_at && (
                        <div className={styles.rulingDate}>{r.published_at}</div>
                      )}
                    </div>
                  ))
                )}
              </Tabs.Content>
            </Tabs.Root>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
