"""Compile the Advanced-search form's structured filters into a Scryfall query
string (PLAN §8: the form "automatically converts to Scryfall syntax" and shows
it back as a live teaching tool). Pure function, no I/O.
"""

from typing import Any

_CMP_OPS = {"=", "!=", ">", "<", ">=", "<="}
# color mode -> Scryfall operator for c: / id:
_COLOR_MODE = {"exactly": "=", "including": ">=", "at-most": "<=", "at_most": "<="}


def _quote(value: str) -> str:
    value = value.strip()
    return f'"{value}"' if any(ch.isspace() for ch in value) else value


def _cmp(field: str, op: str, value: Any) -> str | None:
    if value in (None, ""):
        return None
    op = op if op in _CMP_OPS else "="
    return f"{field}{op}{value}"


def compile_query(f: dict) -> str:
    """Return a Scryfall query string built from Advanced-form fields.

    Recognised keys: name, text, type, colors{colors,mode},
    color_identity{colors,mode}, mana_cost, cmc{op,value}, power{op,value},
    toughness{op,value}, rarity, set, keyword, format, is, sort ignored here.
    Unknown/blank keys are skipped.
    """
    tokens: list[str] = []

    if name := (f.get("name") or "").strip():
        # bare words match names; quote multiword to keep them together
        tokens.append(f"name:{_quote(name)}" if " " in name else name)

    if text := (f.get("text") or "").strip():
        tokens.append(f"o:{_quote(text)}")

    if type_line := (f.get("type") or "").strip():
        for part in type_line.split():
            tokens.append(f"t:{part.lower()}")

    for key, sfield in (("colors", "c"), ("color_identity", "id")):
        block = f.get(key) or {}
        colors = (block.get("colors") or "").strip().upper().replace(" ", "")
        if colors:
            op = _COLOR_MODE.get(block.get("mode", "including"), ">=")
            tokens.append(f"{sfield}{op}{colors.lower()}")

    if mana := (f.get("mana_cost") or "").strip():
        tokens.append(f"m:{mana}")

    for key, sfield in (("cmc", "cmc"), ("power", "pow"), ("toughness", "tou")):
        block = f.get(key) or {}
        token = _cmp(sfield, block.get("op", "="), block.get("value"))
        if token:
            tokens.append(token)

    if rarity := (f.get("rarity") or "").strip():
        tokens.append(f"r:{rarity.lower()}")

    if set_code := (f.get("set") or "").strip():
        tokens.append(f"set:{set_code.lower()}")

    if keyword := (f.get("keyword") or "").strip():
        tokens.append(f"keyword:{_quote(keyword)}")

    if fmt := (f.get("format") or "").strip():
        tokens.append(f"legal:{fmt.lower()}")

    for flag in f.get("is") or []:
        flag = (flag or "").strip()
        if flag:
            tokens.append(f"is:{flag.lower()}")

    return " ".join(tokens)
