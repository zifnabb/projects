/**
 * Readable oracle text (DESIGN §4 `oracle` treatment, Moxfield lineage):
 * larger size, looser leading, inline mana-font symbols for {X} tokens.
 */
import { Fragment, type ReactNode } from "react";

const SYMBOL_RE = /\{([^}]+)\}/g;

function symbolClass(raw: string): string {
  const token = raw.replace(/\//g, "").toLowerCase();
  return token === "t" ? "tap" : token === "q" ? "untap" : token;
}

function renderLine(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of line.matchAll(SYMBOL_RE)) {
    if (m.index! > last) out.push(line.slice(last, m.index));
    out.push(
      <i
        key={`s${i++}`}
        className={`ms ms-${symbolClass(m[1])} ms-cost`}
        style={{ fontSize: "0.85em", verticalAlign: "baseline" }}
        aria-label={m[0]}
      />,
    );
    last = m.index! + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function OracleText({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <div
      style={{
        fontSize: 15,
        lineHeight: "23px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {text.split("\n").map((line, i) => (
        <p key={i} style={{ margin: 0 }}>
          {renderLine(line).map((node, j) => (
            <Fragment key={j}>{node}</Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
