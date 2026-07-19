import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { ColorLetter } from "../../lib/types";

/** A serialized search result (scryfall/search.py _serialize). */
export interface SearchCard {
  oracle_id: string;
  name: string;
  mana_cost: string | null;
  cmc: number | null;
  type_line: string | null;
  oracle_text: string | null;
  color_identity: ColorLetter[];
  legalities: Record<string, string> | null;
  edhrec_rank: number | null;
  image: Record<string, string>;
  in_local: boolean;
}

export interface SearchResponse {
  total: number;
  has_more: boolean;
  page: number;
  results: SearchCard[];
  warning?: string;
  degraded?: boolean;
}

/** Advanced-form filters — mirrors search_compiler.compile_query's keys. */
export interface AdvancedFilters {
  name?: string;
  text?: string;
  type?: string;
  colors?: { colors: string; mode: "exactly" | "including" | "at-most" };
  color_identity?: { colors: string; mode: "exactly" | "including" | "at-most" };
  mana_cost?: string;
  cmc?: { op: string; value: string };
  power?: { op: string; value: string };
  toughness?: { op: string; value: string };
  rarity?: string;
  set?: string;
  keyword?: string;
  format?: string;
  is?: string[];
}

/** Paged full search (Scryfall proxy, cached server-side; PLAN §8). */
export function useCardSearch(query: string) {
  return useInfiniteQuery({
    queryKey: ["card-search", query],
    queryFn: ({ pageParam }) =>
      api.get<SearchResponse>(
        `/api/search?q=${encodeURIComponent(query)}&page=${pageParam}`,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
    enabled: query.trim().length > 0,
    staleTime: 24 * 60 * 60 * 1000, // matches the server's 24h cache guidance
  });
}

/** Live syntax preview: compile the Advanced form server-side (pure, cheap). */
export function useCompiledQuery(filters: AdvancedFilters, enabled: boolean) {
  return useQuery({
    queryKey: ["search-compile", filters],
    queryFn: () =>
      api.post<{ query: string }>("/api/search/compile", {
        filters: filters as Record<string, unknown>,
      }),
    enabled,
    staleTime: Infinity, // same filters → same query
    placeholderData: (prev) => prev,
  });
}
