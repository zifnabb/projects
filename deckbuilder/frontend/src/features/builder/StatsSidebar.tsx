/**
 * Stats sidebar (PLAN §11 / DESIGN §7.9) — all computed locally from the
 * loaded deck; no external calls. Curve · totals · color cost & production ·
 * type counts · category counts vs target.
 */
import { X } from "lucide-react";
import type { ColorLetter, DeckFull } from "../../lib/types";
import { columnQty, primaryType, type BoardColumn } from "./grouping";
import styles from "./StatsSidebar.module.css";

const WUBRG: ColorLetter[] = ["W", "U", "B", "R", "G"];
const COLOR_SYMBOL_RE = /\{([^}]*)\}/g;

interface Stats {
  curve: number[]; // buckets 0..7+
  totalMV: number;
  avgMV: number;
  nonlandCount: number;
  cost: Record<string, number>;
  production: Record<string, number>;
  types: [string, number][];
}

function computeStats(deck: DeckFull): Stats {
  const counted = deck.cards.filter((c) => c.board === "main" || c.board === "command");
  const curve = new Array(8).fill(0);
  let totalMV = 0;
  let nonland = 0;
  const cost: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const production: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const types = new Map<string, number>();

  for (const row of counted) {
    const t = primaryType(row.card.type_line);
    types.set(t, (types.get(t) ?? 0) + row.quantity);

    if (t !== "Land") {
      const mv = Math.floor(row.card.cmc ?? 0);
      curve[Math.min(mv, 7)] += row.quantity;
      totalMV += (row.card.cmc ?? 0) * row.quantity;
      nonland += row.quantity;
    }

    for (const m of (row.card.mana_cost ?? "").matchAll(COLOR_SYMBOL_RE)) {
      for (const ch of m[1].toUpperCase()) {
        if (ch in cost) cost[ch] += row.quantity;
      }
    }
    for (const p of row.card.produced_mana ?? []) {
      const key = p.toUpperCase();
      if (key in production) production[key] += row.quantity;
    }
  }

  return {
    curve,
    totalMV: Math.round(totalMV),
    avgMV: nonland ? Math.round((totalMV / nonland) * 100) / 100 : 0,
    nonlandCount: nonland,
    cost,
    production,
    types: [...types.entries()].sort((a, b) => b[1] - a[1]),
  };
}

function ColorBar({
  label,
  data,
  includeColorless,
}: {
  label: string;
  data: Record<string, number>;
  includeColorless?: boolean;
}) {
  const keys = includeColorless ? [...WUBRG, "C"] : WUBRG;
  const total = keys.reduce((n, k) => n + (data[k] ?? 0), 0);
  return (
    <div>
      <div className={styles.colorBarLabel}>
        <span>{label}</span>
        <span>{total || "—"}</span>
      </div>
      <div className={styles.colorBar} role="img" aria-label={`${label}: ${keys.map((k) => `${k} ${data[k] ?? 0}`).join(", ")}`}>
        {total > 0 &&
          keys
            .filter((k) => (data[k] ?? 0) > 0)
            .map((k) => (
              <span
                key={k}
                className={styles.colorSeg}
                style={{
                  width: `${((data[k] ?? 0) / total) * 100}%`,
                  background: `var(--wubrg-${k.toLowerCase()}-solid)`,
                }}
                title={`${k}: ${data[k]}`}
              />
            ))}
      </div>
    </div>
  );
}

export function StatsSidebar({
  deck,
  columns,
  onClose,
}: {
  deck: DeckFull;
  columns: BoardColumn[];
  onClose: () => void;
}) {
  const s = computeStats(deck);
  const max = Math.max(1, ...s.curve);
  const categoryCols = columns.filter((c) => c.categoryId);

  return (
    <aside className={styles.panel} aria-label="Deck stats">
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Deck stats</h2>
        <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close stats">
          <X size={16} />
        </button>
      </div>

      <div>
        <div className={styles.sectionLabel}>Mana curve (nonland)</div>
        <div className={styles.curve}>
          {s.curve.map((count, mv) => (
            <div key={mv} className={styles.curveCol}>
              <span className={styles.curveCount}>{count || ""}</span>
              <div
                className={styles.curveBar}
                style={{ height: `${(count / max) * 64}px` }}
                title={`MV ${mv === 7 ? "7+" : mv}: ${count}`}
              />
              <span className={styles.curveLabel}>{mv === 7 ? "7+" : mv}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.totalsRow}>
        <span>
          Avg MV <strong>{s.avgMV}</strong>
        </span>
        <span>
          Total <strong>{s.totalMV}</strong>
        </span>
        <span>
          Cards <strong>{deck.legality.size}</strong>
          {deck.legality.target_size ? `/${deck.legality.target_size}` : ""}
        </span>
      </div>

      <div>
        <div className={styles.sectionLabel}>Color cost &amp; production</div>
        <ColorBar label="Cost (pips)" data={s.cost} />
        <ColorBar label="Production" data={s.production} includeColorless />
      </div>

      <div>
        <div className={styles.sectionLabel}>Types</div>
        {s.types.map(([t, n]) => (
          <div key={t} className={styles.countRow}>
            <span>{t}</span>
            <span>{n}</span>
          </div>
        ))}
      </div>

      {categoryCols.length > 0 && (
        <div>
          <div className={styles.sectionLabel}>Categories</div>
          {categoryCols.map((col) => {
            const qty = columnQty(col);
            const under = col.targetMin != null && qty < col.targetMin;
            const over = col.targetMax != null && qty > col.targetMax;
            return (
              <div
                key={col.key}
                className={`${styles.countRow} ${under || over ? styles.outOfRange : ""}`}
              >
                <span>
                  {col.name}
                  {col.targetMin != null || col.targetMax != null
                    ? ` (${col.targetMin ?? 0}–${col.targetMax ?? "∞"})`
                    : ""}
                </span>
                <span>{qty}</span>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
