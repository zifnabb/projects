import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { ColorLetter } from "../../lib/types";

export interface PrintingOut {
  id: string;
  set_code: string;
  set_name: string;
  collector_number: string;
  rarity: string | null;
  finishes: string[] | null;
  released_at: string | null;
  artist: string | null;
  image: Record<string, string>;
}

export interface CardDetail {
  oracle_id: string;
  name: string;
  mana_cost: string | null;
  cmc: number | null;
  type_line: string | null;
  oracle_text: string | null;
  colors: ColorLetter[] | null;
  color_identity: ColorLetter[];
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  keywords: string[] | null;
  legalities: Record<string, string> | null;
  edhrec_rank: number | null;
  image: Record<string, string>;
  reserved: boolean;
  layout: string | null;
  default_printing_id: string | null;
  printings: PrintingOut[];
}

export interface Ruling {
  source: string | null;
  published_at: string | null;
  comment: string | null;
}

export function useCardDetail(oracleId: string | null) {
  return useQuery({
    queryKey: ["card-detail", oracleId],
    queryFn: () => api.get<CardDetail>(`/api/cards/${oracleId}`),
    enabled: !!oracleId,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/** Rulings are on-demand + server-cached (PLAN §9); lazy-fetched per tab open. */
export function useRulings(printingId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["rulings", printingId],
    queryFn: () =>
      api.get<{ available: boolean; rulings: Ruling[] }>(
        `/api/printings/${printingId}/rulings`,
      ),
    enabled: enabled && !!printingId,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
