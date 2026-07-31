"""Format catalog (config, not a table) + the legality engine.

Drives three things at once (PLAN §6): the New-Deck format picker (rules info),
the header legality validator (✓/✗ + reasons), and the Draft→Legal auto-tag.
Card-level banned/legal status comes from the synced Scryfall `legalities` field
(authoritative, self-maintaining) rather than a hand-kept banlist.
"""

from typing import Any

FORMATS: dict[str, dict[str, Any]] = {
    "commander": {
        "name": "Commander",
        "description": "100-card singleton. One legendary commander; every card must fit "
        "the commander's color identity. Highlander (one copy of each card except basic lands).",
        "deck_size": 100,
        "singleton": True,
        "requires_commander": True,
        "enforce_color_identity": True,
    },
    "freeform": {
        "name": "Freeform / Other",
        "description": "No restrictions — any cards, any counts, any size.",
        "deck_size": None,
        "singleton": False,
        "requires_commander": False,
        "enforce_color_identity": False,
    },
}

DEFAULT_FORMAT = "commander"


def get_format(key: str) -> dict[str, Any]:
    return FORMATS.get(key, FORMATS["freeform"])


def can_be_commander(card) -> bool:
    type_line = (card.type_line or "").lower()
    text = (card.oracle_text or "").lower()
    if "can be your commander" in text:
        return True
    return "legendary" in type_line and "creature" in type_line


def allows_any_number(card) -> bool:
    """Basic lands + 'a deck can have any number' cards (Shadowborn Apostle…)."""
    type_line = (card.type_line or "").lower()
    text = (card.oracle_text or "").lower()
    return "basic" in type_line or "a deck can have any number of cards named" in text


_any_number_allowed = allows_any_number  # internal alias used by validate_deck


def validate_deck(format_key: str, deck, card_map: dict, deck_cards: list) -> dict:
    """Return {legal, reasons, size, target_size}. `card_map` maps oracle_id -> Card."""
    fmt = get_format(format_key)
    reasons: list[str] = []

    counted = [dc for dc in deck_cards if dc.board in ("main", "command")]
    total = sum(dc.quantity for dc in counted)

    # Aggregate quantity per card. Singleton is a per-CARD rule, and one card can
    # occupy several rows when copies carry different printings (same oracle_id),
    # so a per-row `quantity > 1` check misses 1+1 duplicates. Evaluating every
    # card-level rule per unique oracle_id also stops reasons double-listing when
    # a card is split across rows. (Security review 2026-07-30, finding #2.)
    qty_by_oracle: dict[str, int] = {}
    for dc in counted:
        qty_by_oracle[dc.oracle_id] = qty_by_oracle.get(dc.oracle_id, 0) + dc.quantity

    if fmt["requires_commander"]:
        cmd_id = deck.commander_oracle_id
        if not cmd_id:
            reasons.append("No commander set.")
        else:
            cc = card_map.get(cmd_id)
            if cc is not None and not can_be_commander(cc):
                reasons.append(f"{cc.name} can't be a commander.")

    target = fmt["deck_size"]
    if target and total != target:
        reasons.append(f"Deck has {total} cards; {fmt['name']} needs {target}.")

    identity = set(deck.color_identity or [])
    enforce_ci = fmt["enforce_color_identity"] and bool(deck.commander_oracle_id)

    for oracle_id, qty in qty_by_oracle.items():
        card = card_map.get(oracle_id)
        if card is None:
            continue
        status = (card.legalities or {}).get(format_key)
        if status == "banned":
            reasons.append(f"{card.name} is banned in {fmt['name']}.")
        elif status == "not_legal":
            reasons.append(f"{card.name} is not legal in {fmt['name']}.")

        if enforce_ci and not set(card.color_identity or []) <= identity:
            reasons.append(f"{card.name} is outside the commander's color identity.")

        if fmt["singleton"] and qty > 1 and not _any_number_allowed(card):
            reasons.append(f"{card.name} appears {qty}× (singleton allows one).")

    return {
        "legal": not reasons,
        "reasons": reasons,
        "size": total,
        "target_size": target,
    }
