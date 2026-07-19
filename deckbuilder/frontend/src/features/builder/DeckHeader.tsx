/**
 * Deck header (PLAN §11/§13): back · inline-editable title · pips · legality
 * pill (clickable → "why" popover) · format · size/target · updated-ago.
 * Clone / export / import / visibility land with Phase 6.
 */
import { useEffect, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Globe,
  Lock,
  Upload,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ColorPipBar } from "../../components/mtg/ColorPipBar";
import { LegalityPill } from "../../components/mtg/Pill";
import type { DeckFull } from "../../lib/types";
import { timeAgo } from "../../lib/timeAgo";
import styles from "./DeckHeader.module.css";

export function DeckHeader({
  deck,
  onRename,
  onClone,
  onExport,
  onImport,
  onSetVisibility,
}: {
  deck: DeckFull;
  onRename: (name: string) => void;
  onClone: () => void;
  onExport: (fmt: "text" | "arena" | "json") => void;
  onImport: () => void;
  onSetVisibility: (v: "private" | "shared") => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl = deck.share_token
    ? `${window.location.origin}/shared/${deck.share_token}`
    : null;

  function copyShare() {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  const [title, setTitle] = useState(deck.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // stay in sync when a mutation refreshes the deck
  useEffect(() => setTitle(deck.name), [deck.name]);

  function commitTitle() {
    const next = title.trim();
    if (next && next !== deck.name) onRename(next);
    else setTitle(deck.name);
  }

  return (
    <div className={styles.header}>
      <Link to="/" className={styles.back}>
        <ArrowLeft size={14} aria-hidden="true" />
        Your decks
      </Link>

      <div className={styles.titleWrap}>
        <input
          ref={inputRef}
          className={styles.title}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") inputRef.current?.blur();
            if (e.key === "Escape") {
              setTitle(deck.name);
              requestAnimationFrame(() => inputRef.current?.blur());
            }
          }}
          aria-label="Deck name"
          size={Math.max(8, title.length)}
        />
        <ColorPipBar identity={deck.color_identity} />
      </div>

      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={styles.legalityButton}
            aria-label={
              deck.legality.legal
                ? "Deck is legal"
                : `Deck is a draft — ${deck.legality.reasons.length} issues`
            }
          >
            <LegalityPill legal={deck.legality.legal} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className={styles.popover} sideOffset={8} align="start">
            {deck.legality.legal ? (
              <span className={styles.legalNote}>
                Deck is legal for {deck.format_info.name}.
              </span>
            ) : (
              <>
                <p className={styles.popoverTitle}>
                  Why this deck is a draft ({deck.legality.reasons.length})
                </p>
                {deck.legality.reasons.map((r, i) => (
                  <div key={i} className={styles.reason}>
                    <XCircle
                      size={14}
                      aria-hidden="true"
                      style={{ color: "var(--color-danger)", flexShrink: 0, marginTop: 2 }}
                    />
                    {r}
                  </div>
                ))}
              </>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <div className={styles.meta}>
        <span>{deck.format_info.name}</span>
        <span>·</span>
        <span>
          {deck.legality.size}
          {deck.legality.target_size ? `/${deck.legality.target_size}` : ""} cards
        </span>
        <span>·</span>
        <span>updated {timeAgo(deck.updated_at)}</span>
      </div>

      <span className={styles.spacer} />

      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onClone}>
          <Copy size={14} aria-hidden="true" />
          Clone
        </Button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" size="sm">
              <Download size={14} aria-hidden="true" />
              Export
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={styles.menu} align="end" sideOffset={6}>
              <DropdownMenu.Item className={styles.menuItem} onSelect={() => onExport("text")}>
                Plain text
              </DropdownMenu.Item>
              <DropdownMenu.Item className={styles.menuItem} onSelect={() => onExport("arena")}>
                MTG Arena
              </DropdownMenu.Item>
              <DropdownMenu.Item className={styles.menuItem} onSelect={() => onExport("json")}>
                JSON backup (lossless)
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <Button variant="ghost" size="sm" onClick={onImport}>
          <Upload size={14} aria-hidden="true" />
          Import
        </Button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" size="sm">
              {deck.visibility === "shared" ? (
                <Globe size={14} aria-hidden="true" />
              ) : (
                <Lock size={14} aria-hidden="true" />
              )}
              {deck.visibility === "shared" ? "Shared" : "Private"}
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={styles.menu} align="end" sideOffset={6}>
              <DropdownMenu.Item
                className={styles.menuItem}
                onSelect={() => onSetVisibility("private")}
              >
                <Lock size={14} aria-hidden="true" />
                Private — only you
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={styles.menuItem}
                onSelect={() => onSetVisibility("shared")}
              >
                <Globe size={14} aria-hidden="true" />
                Shared — read-only link
              </DropdownMenu.Item>
              {shareUrl && (
                <DropdownMenu.Item
                  className={styles.menuItem}
                  onSelect={(e) => {
                    e.preventDefault();
                    copyShare();
                  }}
                >
                  {copied ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                  {copied ? "Copied!" : "Copy share link"}
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
