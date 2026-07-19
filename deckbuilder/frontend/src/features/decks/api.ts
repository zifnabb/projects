import { useQuery } from "@tanstack/react-query";
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
};

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
