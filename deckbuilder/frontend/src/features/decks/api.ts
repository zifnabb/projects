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
  updateCard: (id: string, rowId: string, body: Partial<{ board: string; quantity: number; category_id: string | null; printing_id: string | null }>) =>
    api.patch<DeckFull>(`/api/decks/${id}/cards/${rowId}`, body),
  removeCard: (id: string, rowId: string) =>
    api.del<DeckFull>(`/api/decks/${id}/cards/${rowId}`),

  addCategory: (id: string, body: CategoryBody) =>
    api.post<DeckFull>(`/api/decks/${id}/categories`, body),
  updateCategory: (id: string, categoryId: string, body: CategoryBody) =>
    api.patch<DeckFull>(`/api/decks/${id}/categories/${categoryId}`, body),
  deleteCategory: (id: string, categoryId: string) =>
    api.del<DeckFull>(`/api/decks/${id}/categories/${categoryId}`),
  reorderCategories: (id: string, order: string[]) =>
    api.post<DeckFull>(`/api/decks/${id}/categories/reorder`, { order }),

  clone: (id: string) => api.post<DeckFull>(`/api/decks/${id}/clone`),
  setVisibility: (id: string, visibility: "private" | "shared") =>
    api.post<{ visibility: string; share_token: string | null }>(
      `/api/decks/${id}/visibility`,
      { visibility },
    ),
  remove: (id: string) => api.del<{ ok: boolean }>(`/api/decks/${id}`),
  shared: (token: string) => api.get<DeckFull>(`/api/shared/${token}`),

  export: (id: string, fmt: "text" | "arena" | "json") =>
    api.get<{ format: string; filename: string; content: string }>(
      `/api/io/decks/${id}/export?fmt=${fmt}`,
    ),
  importParse: (body: { text?: string; url?: string }) =>
    api.post<ImportParseResult>("/api/io/import/parse", body),
  importCommit: (body: {
    mode: "new" | "add" | "replace";
    deck_id?: string;
    name?: string;
    format?: string;
    lines: ImportCommitLine[];
    categories?: { name: string; target_min?: number | null; target_max?: number | null }[];
  }) => api.post<DeckFull>("/api/io/import/commit", body),
};

/* type alias (not interface) so it satisfies api.post's Json record type */
export type CategoryBody = {
  name: string;
  target_min?: number | null;
  target_max?: number | null;
  color_tag?: string | null;
  position?: number | null;
};

export interface ImportLine {
  input: string;
  name: string;
  quantity: number;
  board: string;
  category: string | null;
  set_code: string | null;
  collector_number: string | null;
  oracle_id: string | null;
  resolved_name: string | null;
  fuzzy: boolean;
}

export interface ImportParseResult {
  lines: ImportLine[];
  unresolved: number;
  fuzzy: number;
  deck_name?: string | null;
  format?: string | null;
  categories?: { name: string; target_min?: number | null; target_max?: number | null }[];
}

export interface ImportCommitLine {
  oracle_id: string;
  quantity: number;
  board: string;
  category?: string | null;
  set_code?: string | null;
  collector_number?: string | null;
}

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

/** Debounce-friendly card autocomplete (local pg_trgm, cheap).
 * `identity` (WUBRG letters, "" = colorless) restricts results to cards that
 * fit inside that color identity — used by the builder's quick-add. */
export function useAutocomplete(
  q: string,
  commandersOnly = false,
  limit = 15,
  identity?: string,
) {
  const identityParam =
    identity !== undefined ? `&identity=${encodeURIComponent(identity)}` : "";
  return useQuery({
    queryKey: ["autocomplete", q, commandersOnly, limit, identity ?? null],
    queryFn: () =>
      api.get<{ results: AutocompleteResult[] }>(
        `/api/search/autocomplete?q=${encodeURIComponent(q)}&commanders_only=${commandersOnly}&limit=${limit}${identityParam}`,
      ),
    enabled: q.trim().length >= 2,
    staleTime: 10 * 60 * 1000,
    placeholderData: (prev) => prev, // keep old list while typing
  });
}
