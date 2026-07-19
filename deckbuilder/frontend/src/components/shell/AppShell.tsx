import { useState } from "react";
import { Outlet } from "react-router-dom";
import { NewDeckModal } from "../../features/newdeck/NewDeckModal";
import { TopBar } from "./TopBar";

export interface AppShellContext {
  openNewDeck: () => void;
}

/** Authenticated layout: top bar + content. New Deck modal is summonable from
 * the top bar and from child screens (via outlet context). */
export function AppShell() {
  const [newDeckOpen, setNewDeckOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar onNewDeck={() => setNewDeckOpen(true)} />
      <Outlet
        context={{ openNewDeck: () => setNewDeckOpen(true) } satisfies AppShellContext}
      />
      <NewDeckModal open={newDeckOpen} onOpenChange={setNewDeckOpen} />
    </div>
  );
}
