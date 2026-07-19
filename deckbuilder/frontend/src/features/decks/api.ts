import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type {
  AutocompleteResult,
  DeckFull,
  DeckListItem,
  FormatCatalog,
} from "../../lib/types";

export const decksApi = {
  list: () => api.get<DeckListItem[]>("/api/decks"),
  get: (id: string) => api.get<DeckFull>(`/api/decks/${id}`),
  create: (body: {
    name?: string;
    format: string;
    commander_oracle_id?: string;
    use_template: boolean;
    visibility?: "private" | "shared";
    description?: string;
  }) => api.post<DeckFull>("/api/decks", body),
  randomName: () => api.get<{ name: string }>("/api/decks/random-name"),

  update: (id: string, body: Partial<{ name: string; description: string; commander_oracle_id: string | null; deck_art_oracle_id: string | null }>) =>
    api.patch<DeckFull>(`/api/decks/${id}`, body),
  addCard: (id: string, body: { oracle_id: string; board?: string; quantity?: number; category_id?: string | null }) =>
    api.post<DeckFull>(`/api/decks/${id}/cards`, body),
  updateCard: (id: string, rowId: string, body: Partial<{ board: string; quantity: number; category_id: string | null }>) =>
    api.patch<DeckFull>(`/api/decks/${id}/cards/${rowId}`, body),
  removeCard: (id: string, rowId: string) =>
    api.del<DeckFull>(`/api/decks/${id}/cards/${rowId}`),
};

export function useDeck(id: string | undefined) {
  return useQuery({
    queryKey: ["deck", id],
    queryFn: () => decksApi.get(id!),
    enabled: !!id,
  });
}

/**
 * Every deck mutation returns the full serialized deck — write it straight
 * into the cache so the board re-renders in one hop (silent autosave,
 * PLAN §11; "updated X ago" ticks from the response's updated_at).
 */
export function useDeckMutation<TArgs>(
  deckId: string,
  fn: (args: TArgs) => Promise<DeckFull>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (deck) => {
      qc.setQueryData(["deck", deckId], deck);
      qc.invalidateQueries({ queryKey: ["decks"] }); // dashboard tiles
    },
  });
}

export function useDecks() {
  return useQuery({ queryKey: ["decks"], queryFn: decksApi.list });
}

/** Format catalog is server config — cache for the session. */
export function useFormats() {
  return useQuery({
    queryKey: ["formats"],
    queryFn: () => api.get<FormatCatalog>("/api/formats"),
    staleTime: Infinity,
  });
}

/** Debounce-friendly card autocomplete (local pg_trgm, cheap). */
export function useAutocomplete(q: string, commandersOnly = false, limit = 15) {
  return useQuery({
    queryKey: ["autocomplete", q, commandersOnly, limit],
    queryFn: () =>
      api.get<{ results: AutocompleteResult[] }>(
        `/api/search/autocomplete?q=${encodeURIComponent(q)}&commanders_only=${commandersOnly}&limit=${limit}`,
      ),
    enabled: q.trim().length >= 2,
    staleTime: 10 * 60 * 1000,
    placeholderData: (prev) => prev, // keep old list while typing
  });
}
