"""Randomized MTG-flavored deck names (Scryfall lineage — name is optional and
a random one is offered/persisted if blank). Fully local, no external calls.
"""

import random

_ADJECTIVES = [
    "Frosted", "Molten", "Verdant", "Arcane", "Grim", "Radiant", "Feral", "Ancient",
    "Sunken", "Gilded", "Storming", "Whispering", "Ravenous", "Eternal", "Shattered",
    "Blighted", "Luminous", "Rambling", "Spiteful", "Wandering", "Thundering", "Hallowed",
]
_NOUNS = [
    "Aggro", "Sanctum", "Menagerie", "Reliquary", "Covenant", "Bloom", "Gambit", "Requiem",
    "Warren", "Ascension", "Verdict", "Rally", "Tempest", "Machinations", "Overrun",
    "Coven", "Legion", "Devotion", "Uprising", "Procession", "Conclave", "Onslaught",
]


def random_deck_name() -> str:
    return f"{random.choice(_ADJECTIVES)} {random.choice(_NOUNS)} {random.randint(2, 99)}"
