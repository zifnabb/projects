import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CardPanel } from "../../features/cardpanel/CardPanel";
import { decksApi, useDecks } from "../../features/decks/api";
import { NewDeckModal } from "../../features/newdeck/NewDeckModal";
import { TopBar } from "./TopBar";

export interface AppShellContext {
  openNewDeck: () => void;
}

/** Authenticated layout: top bar + content. Hosts the New Deck modal and the
 * top-bar search's card panel (bare mode with a deck-picker Add). */
export function AppShell() {
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const { data: decks } = useDecks();
  const qc = useQueryClient();
  const location = useLocation();
  // inside a deck the builder hosts its own, richer panel
  const inBuilder = location.pathname.startsWith("/decks/");

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar
        onNewDeck={() => setNewDeckOpen(true)}
        onOpenCard={(oracleId) => setOpenCardId(oracleId)}
      />
      <Outlet
        context={{ openNewDeck: () => setNewDeckOpen(true) } satisfies AppShellContext}
      />
      <NewDeckModal open={newDeckOpen} onOpenChange={setNewDeckOpen} />
      {!inBuilder || openCardId ? (
        <CardPanel
          state={openCardId ? { oracleId: openCardId } : null}
          decks={decks}
          onClose={() => setOpenCardId(null)}
          actions={{
            addToTarget: (deckId, oracleId) => {
              void decksApi.addCard(deckId, { oracle_id: oracleId }).then((deck) => {
                qc.setQueryData(["deck", deckId], deck);
                qc.invalidateQueries({ queryKey: ["decks"] });
              });
            },
          }}
        />
      ) : null}
    </div>
  );
}
