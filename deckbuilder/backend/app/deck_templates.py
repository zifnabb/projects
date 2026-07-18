"""Deckbuilding-template catalog (config, not a table). Seeds deck_categories
on New Deck when "Start from deckbuilding template" is on (default ON, PLAN §11).
"""

from typing import Any

DECK_TEMPLATES: dict[str, dict[str, Any]] = {
    "commander_skeleton": {
        "name": "Commander skeleton",
        "format": "commander",
        "categories": [
            {"name": "Commander", "target_min": 1, "target_max": 1},
            {"name": "Lands", "target_min": 35, "target_max": 38},
            {"name": "Ramp / Mana Rocks", "target_min": 8, "target_max": 12},
            {"name": "Card Draw", "target_min": 8, "target_max": 12},
            {"name": "Removal", "target_min": 5, "target_max": 10},
            {"name": "Board Wipes", "target_min": 2, "target_max": 4},
            {"name": "Main Theme", "target_min": 20, "target_max": 30},
            {"name": "Flex / Optional", "target_min": 0, "target_max": 10},
        ],
    },
}

DEFAULT_TEMPLATE_FOR: dict[str, str] = {"commander": "commander_skeleton"}


def template_for_format(format_key: str) -> dict[str, Any] | None:
    key = DEFAULT_TEMPLATE_FOR.get(format_key)
    return DECK_TEMPLATES.get(key) if key else None
