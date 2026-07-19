"""WotC Commander **Game Changers** list (bracket system).

Sourced from Scryfall `is:gamechanger` (2026-07-20). Keyed by oracle_id so it
is printing-independent. Surfaced as a per-card label in the builder (PLAN §11).
Refresh by re-querying Scryfall when WotC revises the list.
"""

GAME_CHANGER_ORACLE_IDS: frozenset[str] = frozenset({
    "981b0e21-e5e6-4a1e-bfde-679d56623f7f",  # Ad Nauseam
    "23467047-6dba-4498-b783-1ebc4f74b8c2",  # Ancient Tomb
    "8d03d050-391c-4311-8c42-4ee632d40fdc",  # Aura Shards
    "447de961-106c-4189-83ce-ca63d487e1cd",  # Biorhythm
    "2bd111bb-ce02-414c-b5b7-e0e037d8d96b",  # Bolas's Citadel
    "d85aa59b-c6aa-4b2f-885c-59d6e5e6e8b9",  # Braids, Cabal Minion
    "ec3d4466-547c-4e02-b1b5-a156ec4637e9",  # Chrome Mox
    "e9e25800-9ee7-40c9-b22d-611c7281c125",  # Coalition Victory
    "311a449d-dc74-46e6-9a47-6a597931f736",  # Consecrated Sphinx
    "28b46183-c62f-47b1-9fee-3ba148202cab",  # Crop Rotation
    "d75b9c82-1b49-4c3e-a1b5-aeef57d6644b",  # Cyclonic Rift
    "82004860-e589-4e38-8d61-8c0210e4ea39",  # Demonic Tutor
    "aadd10d0-6dd0-4bdc-8d93-ff08e29a5863",  # Drannith Magistrate
    "c5229c17-b7be-4b05-b683-f2277edc4849",  # Enlightened Tutor
    "4eb813fd-2d5a-4b02-8193-662681ef4e7d",  # Farewell
    "aa959340-c869-4caa-92c7-572bd8d23eef",  # Field of the Dead
    "d09c9cba-fdd2-479b-ad5d-d05181c3e3f9",  # Fierce Guardianship
    "956381ba-6d37-4a8a-846c-bad79222dbee",  # Force of Will
    "7c427c3d-ecd8-45ef-bebd-8f10f4a311db",  # Gaea's Cradle
    "a54f0869-94c8-42af-9080-166efb9486a4",  # Gamble
    "58aec411-167d-4709-8560-793eaaed62c5",  # Gifts Ungiven
    "73e7a2ad-d11c-4867-b97d-f971809da778",  # Glacial Chasm
    "1f8d4d5f-e82f-45f3-823e-1bb6b536eb18",  # Grand Arbiter Augustin IV
    "229d6627-1292-4ae1-8849-b0f956fa6540",  # Grim Monolith
    "ed7bdb3e-5c51-4547-9266-76a791e0b2b0",  # Humility
    "16cd0b90-f70c-4efa-b252-8de8784ef9a3",  # Imperial Seal
    "3c9faba7-f2d3-4978-be94-020dc8003dc0",  # Intuition
    "0fd114c4-092b-4e28-b0dc-ef529f3bc73e",  # Jeska's Will
    "ee6099b0-fb1f-42f1-b862-7708c6e36d05",  # Lion's Eye Diamond
    "736892cb-a34b-4bb9-b56c-e26e3db207a2",  # Mana Vault
    "ba284fe6-bb29-455c-8321-9714a0cdc05e",  # Mishra's Workshop
    "f3c5978a-70fa-431f-933b-b954bd0db0ea",  # Mox Diamond
    "fb81f95c-70f8-4eb7-8d15-15d0ae23ec03",  # Mystical Tutor
    "ab26fbe2-e808-48b9-8d0d-3fbb6c3d554f",  # Narset, Parter of Veils
    "8c1fe337-375a-4add-93b6-0ac39ed72b4f",  # Natural Order
    "94a844d2-0574-45a7-b347-e0e329767c42",  # Necropotence
    "f8dab16e-1d50-443e-9431-8b6f1cf61c9c",  # Notion Thief
    "1f438b8f-fe23-4f3b-ab2e-f6c33676c462",  # Opposition Agent
    "ea5103f5-27e0-4eb1-902c-7f34652d6bf3",  # Orcish Bowmasters
    "505cb78d-b292-4d16-b3f2-110164b4cc93",  # Panoptic Mirror
    "53236dd7-845a-444c-96d5-f41ed7325d8f",  # Rhystic Study
    "463865bc-087e-477b-9e86-84e77f1ad931",  # Seedborn Muse
    "34187c71-6033-4058-aadc-2bc266f762be",  # Serra's Sanctum
    "153376c9-dffd-458c-8ce3-a4c8269bc4e9",  # Smothering Tithe
    "119d719d-e965-45b4-9bc9-ac03211b10c2",  # Survival of the Fittest
    "0d4ecdb1-ec90-497f-a7a4-1c68092b8757",  # Teferi's Protection
    "8485cfaa-1dbf-432b-b5d0-92a6aa6a329b",  # Tergrid, God of Fright // Tergrid's Lantern
    "1de1b591-a73f-4974-b507-8c63e07a0868",  # Thassa's Oracle
    "3aa83ed2-f48b-4ce6-a614-2c54ddf50538",  # The One Ring
    "69b409b3-fa16-4c79-8b46-215a7036ed46",  # The Tabernacle at Pendrell Vale
    "27e0948b-9916-473b-8d8c-a51bdfbc7457",  # Underworld Breach
    "ededbdae-d9dc-4206-9335-d7158f2d7700",  # Vampiric Tutor
    "e8863518-0bfa-49c3-8c6e-6c9116a81051",  # Worldly Tutor
})
