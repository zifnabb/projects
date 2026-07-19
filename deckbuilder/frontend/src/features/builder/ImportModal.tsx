/**
 * Smart importer (PLAN §13): paste / upload / Archidekt URL → parse +
 * fuzzy-resolve server-side → review (unresolved flagged, skip-or-abort) →
 * commit as add | replace | new deck.
 */
import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Upload, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import {
  decksApi,
  type ImportCommitLine,
  type ImportParseResult,
} from "../decks/api";
import styles from "./ImportModal.module.css";

export function ImportModal({
  open,
  onOpenChange,
  deckId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** present → offers add/replace into this deck; always offers "new deck" */
  deckId?: string;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [review, setReview] = useState<ImportParseResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parse = useMutation({
    mutationFn: () =>
      decksApi.importParse(url.trim() ? { url: url.trim() } : { text }),
    onSuccess: setReview,
  });

  const commit = useMutation({
    mutationFn: (mode: "new" | "add" | "replace") => {
      const lines: ImportCommitLine[] = review!.lines
        .filter((l) => l.oracle_id)
        .map((l) => ({
          oracle_id: l.oracle_id!,
          quantity: l.quantity,
          board: l.board,
          category: l.category,
          set_code: l.set_code,
          collector_number: l.collector_number,
        }));
      return decksApi.importCommit({
        mode,
        deck_id: mode === "new" ? undefined : deckId,
        name: review!.deck_name ?? undefined,
        format: review!.format ?? "commander",
        lines,
        categories: review!.categories ?? [],
      });
    },
    onSuccess: (deck) => {
      qc.invalidateQueries({ queryKey: ["decks"] });
      qc.setQueryData(["deck", deck.id], deck);
      reset();
      onOpenChange(false);
      navigate(`/decks/${deck.id}`);
    },
  });

  function reset() {
    setText("");
    setUrl("");
    setReview(null);
    parse.reset();
    commit.reset();
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    file.text().then((content) => {
      setText(content);
      setUrl("");
    });
  }

  const resolvedCount = review ? review.lines.filter((l) => l.oracle_id).length : 0;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <div className={styles.titleRow}>
            <Dialog.Title asChild>
              <h1 className={styles.title}>Import cards</h1>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className={styles.close} aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          {!review ? (
            <div className={styles.form}>
              <textarea
                className={styles.textarea}
                placeholder={
                  "Paste a decklist — plain text, Arena, CSV, or a vermilion JSON backup…\n\n1 Sol Ring\n1 Arcane Signet\nSideboard\n1 Path to Exile"
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
              />
              <div className={styles.orRow}>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={14} aria-hidden="true" />
                  Upload file
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.csv,.json"
                  style={{ display: "none" }}
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <span className={styles.orText}>or pull from a URL</span>
                <input
                  className={styles.input}
                  placeholder="Archidekt or Moxfield deck URL…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              {parse.isError && (
                <p className={styles.formError} role="alert">
                  {(parse.error as Error).message}
                </p>
              )}
              <div className={styles.footer}>
                <Button
                  variant="primary"
                  loading={parse.isPending}
                  disabled={!text.trim() && !url.trim()}
                  onClick={() => parse.mutate()}
                >
                  Parse &amp; review
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.form}>
              <div className={styles.summary}>
                <strong>{resolvedCount}</strong> cards resolved
                {review.fuzzy > 0 && (
                  <span className={styles.fuzzyNote}> · {review.fuzzy} fuzzy-matched</span>
                )}
                {review.unresolved > 0 && (
                  <span className={styles.unresolvedNote}>
                    {" "}
                    · {review.unresolved} not found (will be skipped)
                  </span>
                )}
                {review.deck_name && <span> · “{review.deck_name}”</span>}
              </div>
              <div className={styles.reviewList}>
                {review.lines.map((l, i) => (
                  <div
                    key={i}
                    className={`${styles.reviewRow} ${
                      !l.oracle_id
                        ? styles.rowUnresolved
                        : l.fuzzy
                          ? styles.rowFuzzy
                          : ""
                    }`}
                  >
                    <span className={styles.reviewQty}>{l.quantity}</span>
                    <span className={styles.reviewName}>
                      {l.resolved_name ?? l.name}
                      {l.fuzzy && l.resolved_name !== l.name && (
                        <span className={styles.fuzzyFrom}> (from “{l.name}”)</span>
                      )}
                      {!l.oracle_id && <span className={styles.fuzzyFrom}> — not found</span>}
                    </span>
                    <span className={styles.reviewMeta}>
                      {l.board !== "main" ? l.board : (l.category ?? "")}
                    </span>
                  </div>
                ))}
              </div>
              {commit.isError && (
                <p className={styles.formError} role="alert">
                  {(commit.error as Error).message}
                </p>
              )}
              <div className={styles.footer}>
                <Button variant="ghost" onClick={() => setReview(null)}>
                  Back
                </Button>
                <span style={{ flex: 1 }} />
                {deckId && (
                  <>
                    <Button
                      variant="secondary"
                      loading={commit.isPending}
                      disabled={resolvedCount === 0}
                      onClick={() => commit.mutate("add")}
                    >
                      Add to deck
                    </Button>
                    <Button
                      variant="danger"
                      loading={commit.isPending}
                      disabled={resolvedCount === 0}
                      onClick={() => commit.mutate("replace")}
                    >
                      Replace deck
                    </Button>
                  </>
                )}
                <Button
                  variant="primary"
                  loading={commit.isPending}
                  disabled={resolvedCount === 0}
                  onClick={() => commit.mutate("new")}
                >
                  New deck
                </Button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
