/** Shared API types, mirroring the backend serializers. */

export type Theme = "dark" | "light";

export interface CurrentUser {
  id: string; // UUID
  username: string;
  display_name: string;
  is_admin: boolean;
  theme_pref: Theme | null;
}

/* ---- formats (decks.py /api/formats) ------------------------------------ */
export interface TemplateCategory {
  name: string;
  target_min?: number | null;
  target_max?: number | null;
}

export interface DeckTemplate {
  name: string;
  format: string;
  categories: TemplateCategory[];
}

export interface FormatInfo {
  name: string;
  description: string;
  deck_size: number | null;
  singleton: boolean;
  requires_commander: boolean;
  enforce_color_identity: boolean;
  /** Present on /api/formats entries; absent in deck.format_info. */
  template?: DeckTemplate | null;
}

export interface FormatCatalog {
  default: string;
  formats: Record<string, FormatInfo>;
}

/* ---- decks (decks.py) ---------------------------------------------------- */
export type ColorLetter = "W" | "U" | "B" | "R" | "G";

export interface DeckListItem {
  id: string;
  name: string;
  format: string;
  color_identity: ColorLetter[];
  commander_oracle_id: string | null;
  deck_art_oracle_id: string | null;
  visibility: "private" | "shared";
  size: number;
  tags: string[];
  art: string | null;
  updated_at: string | null;
}

export interface Legality {
  legal: boolean;
  reasons: string[];
  size: number;
  target_size: number | null;
}

export interface DeckCategoryOut {
  id: string;
  name: string;
  position: number;
  target_min: number | null;
  target_max: number | null;
  color_tag: string | null;
  source: "template" | "user";
}

export interface CardFace {
  name?: string;
  image?: Record<string, string>;
  mana_cost?: string | null;
  type_line?: string | null;
  oracle_text?: string | null;
}

export interface CardSummary {
  name?: string;
  mana_cost?: string | null;
  cmc?: number | null;
  type_line?: string | null;
  color_identity?: ColorLetter[];
  image?: Record<string, string>;
  /** double-faced cards (transform/modal_dfc/flip): per-face name + image */
  faces?: CardFace[] | null;
  layout?: string | null;
  keywords?: string[] | null;
  /** WotC Commander Game Changer (per-card label) */
  game_changer?: boolean;
  /** singleton formats: only basics / "any number" cards may exceed 1 */
  multiples_ok?: boolean;
  /** mana this card can produce (stats sidebar; e.g. ["G"], ["C"]) */
  produced_mana?: string[] | null;
}

export interface DeckCardRow {
  id: string;
  oracle_id: string;
  board: "main" | "side" | "maybe" | "command";
  quantity: number;
  printing_id: string | null;
  finish: string | null;
  category_id: string | null;
  card: CardSummary;
  /** per-card legality problems (banned / not legal / off-identity / over cap) */
  issues?: string[];
}

export interface DeckFull {
  id: string;
  name: string;
  format: string;
  format_info: FormatInfo;
  commander_oracle_id: string | null;
  color_identity: ColorLetter[];
  description: string | null;
  deck_art_oracle_id: string | null;
  visibility: "private" | "shared";
  share_token: string | null;
  created_at: string | null;
  updated_at: string | null;
  legality: Legality;
  categories: DeckCategoryOut[];
  cards: DeckCardRow[];
  tags: { tag: string; source: "user" | "system" }[];
}

/* ---- search (search.py) -------------------------------------------------- */
export interface AutocompleteResult {
  name: string;
  oracle_id: string;
  mana_cost: string | null;
  type_line: string | null;
  color_identity: ColorLetter[];
  image: Record<string, string>;
}
