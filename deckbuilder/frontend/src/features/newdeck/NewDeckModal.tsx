/**
 * New Deck modal (PLAN §12 / DESIGN §8.3). Compact create step: optional name
 * with a live random suggestion (🎲 re-roll), format picker with inline rules
 * info, optional commander picker ("legal only" toggle default-on), template
 * toggle (default ON) with bucket preview, collapsed Extra Options.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import { ChevronRight, Dices, Info, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { ColorPipBar } from "../../components/mtg/ColorPipBar";
import type { AutocompleteResult } from "../../lib/types";
import { decksApi, useAutocomplete, useFormats } from "../decks/api";
import styles from "./NewDeckModal.module.css";

function useDebounced(value: string, ms = 200): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function NewDeckModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: catalog } = useFormats();

  const [name, setName] = useState("");
  const [format, setFormat] = useState<string>("commander");
  const [commander, setCommander] = useState<AutocompleteResult | null>(null);
  const [commanderQuery, setCommanderQuery] = useState("");
  const [legalOnly, setLegalOnly] = useState(true);
  const [useTemplate, setUseTemplate] = useState(false);
  const [visibility, setVisibility] = useState<"private" | "shared">("private");
  const nameTouched = useRef(false);

  // Random-name suggestion: fetched on open, re-rolled via the dice.
  const randomName = useQuery({
    queryKey: ["random-deck-name"],
    queryFn: decksApi.randomName,
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });
  const suggested = randomName.data?.name ?? "";

  const debouncedQuery = useDebounced(commanderQuery);
  // 7 rows fit the dropdown without an internal scrollbar
  const autocomplete = useAutocomplete(debouncedQuery, legalOnly, 7);

  const fmt = catalog?.formats[format];
  const showCommander = fmt?.requires_commander ?? format === "commander";
  const template = fmt?.template ?? null;
  const templateAvailable = useTemplate && !!template;

  const create = useMutation({
    mutationFn: () =>
      decksApi.create({
        // blank → persist the shown suggestion (what you saw is what you get)
        name: name.trim() || suggested || undefined,
        format,
        commander_oracle_id: commander?.oracle_id,
        use_template: !!template && useTemplate,
        visibility,
      }),
    onSuccess: (deck) => {
      qc.invalidateQueries({ queryKey: ["decks"] });
      reset();
      onOpenChange(false);
      navigate(`/decks/${deck.id}`);
    },
  });

  function reset() {
    setName("");
    setFormat("commander");
    setCommander(null);
    setCommanderQuery("");
    setLegalOnly(true);
    setUseTemplate(false);
    setVisibility("private");
    nameTouched.current = false;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  const results = autocomplete.data?.results ?? [];
  const showResults =
    commanderQuery.trim().length >= 2 && !commander && results.length > 0;

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
              <h1 className={styles.title}>New Deck</h1>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className={styles.close} aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <form className={styles.form} onSubmit={onSubmit} noValidate>
            {/* Name — optional; placeholder is the live random suggestion */}
            <TextField
              label="Name"
              value={name}
              placeholder={suggested || "…"}
              onChange={(e) => {
                nameTouched.current = true;
                setName(e.target.value);
              }}
              hint={name.trim() ? undefined : "Leave blank to keep the suggested name"}
              trailing={
                <button
                  type="button"
                  className={styles.diceButton}
                  aria-label="Re-roll suggested name"
                  onClick={() => randomName.refetch()}
                >
                  <Dices size={16} />
                </button>
              }
            />

            {/* Format + inline rules info */}
            <div>
              <label className={styles.fieldLabel} htmlFor="nd-format">
                Format
              </label>
              <select
                id="nd-format"
                className={styles.select}
                value={format}
                onChange={(e) => {
                  setFormat(e.target.value);
                  setCommander(null);
                  setCommanderQuery("");
                }}
              >
                {catalog
                  ? Object.entries(catalog.formats).map(([key, f]) => (
                      <option key={key} value={key}>
                        {f.name}
                      </option>
                    ))
                  : null}
              </select>
              {fmt && (
                <div className={styles.rulesInfo} style={{ marginTop: 6 }}>
                  <Info size={14} aria-hidden="true" />
                  <span>{fmt.description}</span>
                </div>
              )}
            </div>

            {/* Commander (when the format wants one; optional either way) */}
            {showCommander && (
              <div>
                <label className={styles.fieldLabel} htmlFor="nd-commander">
                  Commander <span style={{ opacity: 0.6 }}>(optional — set later)</span>
                </label>
                {commander ? (
                  <div className={styles.chosen}>
                    <ColorPipBar identity={commander.color_identity} />
                    <span className={styles.chosenName}>{commander.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => {
                        setCommander(null);
                        setCommanderQuery("");
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className={styles.pickerWrap}>
                    <TextField
                      id="nd-commander"
                      placeholder="Search legendary creatures…"
                      value={commanderQuery}
                      onChange={(e) => setCommanderQuery(e.target.value)}
                      autoComplete="off"
                    />
                    {showResults && (
                      <div className={styles.results} role="listbox">
                        {results.map((r) => (
                          <button
                            key={r.oracle_id}
                            type="button"
                            className={styles.resultRow}
                            role="option"
                            aria-selected="false"
                            onClick={() => setCommander(r)}
                          >
                            <ColorPipBar identity={r.color_identity} />
                            <span className={styles.resultName}>
                              <span>{r.name}</span>
                              <span className={styles.resultType}>{r.type_line}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className={styles.toggleRow} style={{ marginTop: 8 }}>
                  <Switch.Root
                    className={styles.switch}
                    id="nd-legal-only"
                    checked={legalOnly}
                    onCheckedChange={setLegalOnly}
                  >
                    <Switch.Thumb className={styles.thumb} />
                  </Switch.Root>
                  <label className={styles.toggleLabel} htmlFor="nd-legal-only">
                    Legal commanders only
                  </label>
                </div>
              </div>
            )}

            {/* Template toggle (default OFF, 2026-07-20) + bucket preview */}
            {template && (
              <div>
                <div className={styles.toggleRow}>
                  <Switch.Root
                    className={styles.switch}
                    id="nd-template"
                    checked={useTemplate}
                    onCheckedChange={setUseTemplate}
                  >
                    <Switch.Thumb className={styles.thumb} />
                  </Switch.Root>
                  <label className={styles.toggleLabel} htmlFor="nd-template">
                    Start from deckbuilding template
                  </label>
                </div>
                {templateAvailable && (
                  <p className={styles.toggleHint}>
                    {template.categories.map((c) => c.name).join(" · ")}
                  </p>
                )}
              </div>
            )}

            {/* Extra Options — collapsed by default (Archidekt); description
                is deliberately absent (it's an inline edit on the deck page) */}
            <details className={styles.extra}>
              <summary className={styles.extraSummary}>
                <ChevronRight size={14} aria-hidden="true" />
                Extra Options
              </summary>
              <div className={styles.extraBody}>
                <div>
                  <label className={styles.fieldLabel} htmlFor="nd-visibility">
                    Visibility
                  </label>
                  <select
                    id="nd-visibility"
                    className={styles.select}
                    value={visibility}
                    onChange={(e) =>
                      setVisibility(e.target.value as "private" | "shared")
                    }
                  >
                    <option value="private">Private (only you)</option>
                    <option value="shared">Shared (read-only link)</option>
                  </select>
                </div>
              </div>
            </details>

            {create.isError && (
              <p className={styles.formError} role="alert">
                {(create.error as Error).message}
              </p>
            )}

            <div className={styles.footer}>
              <Dialog.Close asChild>
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button variant="primary" type="submit" loading={create.isPending}>
                Create
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
