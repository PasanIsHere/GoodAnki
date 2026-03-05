"""Parse .apkg files (Anki deck packages) into structured JSON.

An .apkg file is a zip archive containing:
- collection.anki2 or collection.anki21: SQLite database with notes, cards, models
- media: JSON mapping of numeric filenames to original names
- 0, 1, 2...: media files
"""

import html as html_lib
import json
import re
import sqlite3
import tempfile
import zipfile
from pathlib import Path
from typing import Any


def parse_apkg(file_path: str | Path) -> dict[str, Any]:
    """Parse an .apkg file and return structured deck data."""
    file_path = Path(file_path)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)

        # Extract zip
        with zipfile.ZipFile(file_path, "r") as zf:
            zf.extractall(tmpdir)

        # Find the SQLite database
        db_path = tmpdir / "collection.anki21"
        if not db_path.exists():
            db_path = tmpdir / "collection.anki2"
        if not db_path.exists():
            raise ValueError("No collection database found in .apkg file")

        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        try:
            return _extract_data(conn)
        finally:
            conn.close()


def _extract_data(conn: sqlite3.Connection) -> dict[str, Any]:
    """Extract decks, models, and notes from the Anki SQLite database."""
    cursor = conn.cursor()

    # Get collection metadata (models and decks config)
    col_row = cursor.execute("SELECT models, decks FROM col").fetchone()
    models = json.loads(col_row["models"])
    decks_config = json.loads(col_row["decks"])

    # Build model map: model_id -> { name, fields, templates }
    model_map: dict[str, dict] = {}
    for mid, model in models.items():
        field_names = [f["name"] for f in model["flds"]]
        templates = []
        for tmpl in model["tmpls"]:
            templates.append({
                "name": tmpl["name"],
                "qfmt": tmpl["qfmt"],
                "afmt": tmpl["afmt"],
            })
        model_map[mid] = {
            "name": model["name"],
            "fields": field_names,
            "templates": templates,
        }

    # Build deck map
    deck_map: dict[str, str] = {}
    for did, deck in decks_config.items():
        deck_map[did] = deck["name"]

    # Get all notes
    notes = cursor.execute("SELECT id, mid, flds, tags FROM notes").fetchall()

    # Get all cards to map note -> deck
    cards = cursor.execute("SELECT id, nid, did FROM cards").fetchall()
    note_to_deck: dict[int, str] = {}
    for card in cards:
        note_to_deck[card["nid"]] = str(card["did"])

    # Group notes by deck
    decks_data: dict[str, dict] = {}

    for note in notes:
        nid = note["id"]
        mid = str(note["mid"])
        fields_raw = note["flds"]
        tags = note["tags"].strip()

        model = model_map.get(mid)
        if not model:
            continue

        # Split fields by Anki's \x1f separator
        field_values = fields_raw.split("\x1f")
        fields_dict = {}
        for i, name in enumerate(model["fields"]):
            fields_dict[name] = field_values[i] if i < len(field_values) else ""

        # Determine front/back from template or field names
        front, back = _extract_front_back(fields_dict, model)

        # Skip cards with no meaningful content
        if not front and not back:
            continue

        did = note_to_deck.get(nid, "1")
        deck_name = deck_map.get(did, "Default")

        if did not in decks_data:
            decks_data[did] = {
                "name": deck_name,
                "description": "",
                "cards": [],
            }

        decks_data[did]["cards"].append({
            "front": front,
            "back": back,
            "tags": tags,
        })

    # Convert to list
    result_decks = list(decks_data.values())

    return {
        "decks": result_decks,
        "total_cards": sum(len(d["cards"]) for d in result_decks),
    }


def _extract_field_refs(template_str: str) -> list[str]:
    """Extract {{FieldName}} references from an Anki template string.

    Excludes conditionals ({{#...}}, {{^...}}, {{/...}}) and special
    directives like {{FrontSide}}, {{Tags}}, {{Type}}, {{Deck}}, etc.
    """
    special = {"FrontSide", "Tags", "Type", "Deck", "Subdeck", "Card", "CardFlag"}
    matches = re.findall(r"\{\{(?![#/\^!])([^}]+)\}\}", template_str)
    return [m.strip() for m in matches if m.strip() and m.strip() not in special]


def _extract_front_back(fields: dict[str, str], model: dict) -> tuple[str, str]:
    """Extract front and back text from note fields.

    Strategy (in order):
    1. Standard Front/Back or Question/Answer field names
    2. Template-based: use qfmt field refs as front, afmt refs as back
    3. Fallback: first non-empty field as front, combine remaining as back
    """
    field_names = list(fields.keys())

    # 1. Try standard naming conventions first
    for front_key in ("Front", "front", "Question", "question"):
        if front_key in fields and fields[front_key].strip():
            for back_key in ("Back", "back", "Answer", "answer"):
                if back_key in fields:
                    return _clean_html(fields[front_key]), _clean_html(fields[back_key])

    # 2. Template-based extraction — collect all valid (front, back) pairs from all templates,
    #    then pick the pair whose front is most compact (shortest = most likely a word/character
    #    rather than a long definition sentence).
    candidates: list[tuple[str, str]] = []
    for tmpl in model.get("templates", []):
        front_refs = _extract_field_refs(tmpl.get("qfmt", ""))
        back_refs = _extract_field_refs(tmpl.get("afmt", ""))

        # Find front: first referenced field with non-empty content
        front_val = ""
        used_front_refs: set[str] = set()
        for ref in front_refs:
            val = fields.get(ref, "").strip()
            if val:
                front_val = _clean_html(val)
                used_front_refs.add(ref)
                break

        if not front_val:
            continue

        # Find back: back_refs minus front refs, combined
        back_parts = []
        for ref in back_refs:
            if ref in used_front_refs:
                continue
            val = fields.get(ref, "").strip()
            if val:
                back_parts.append(_clean_html(val))

        back_val = "\n".join(back_parts)
        if back_val:
            candidates.append((front_val, back_val))

    if candidates:
        # Prefer the card where the front is shortest (a single word/character,
        # not a long definition). This makes language decks show word → meaning
        # rather than definition → word.
        candidates.sort(key=lambda pair: len(pair[0]))
        return candidates[0]

    # 3. Fallback: first non-empty field as front, combine the rest as back
    non_empty = [(name, val) for name, val in fields.items() if val.strip()]
    if len(non_empty) >= 2:
        front = _clean_html(non_empty[0][1])
        back_parts = [_clean_html(v) for _, v in non_empty[1:] if v.strip()]
        return front, "\n".join(back_parts)
    elif len(non_empty) == 1:
        return _clean_html(non_empty[0][1]), ""

    return "", ""


def _clean_html(text: str) -> str:
    """Strip HTML from Anki field content and produce clean readable text."""
    # Remove Anki template directives {{...}}
    text = re.sub(r"\{\{[^}]+\}\}", "", text)

    # Convert ordered/unordered list items to bullet points
    text = re.sub(r"<li[^>]*>", "• ", text, flags=re.IGNORECASE)
    text = re.sub(r"</li>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[ou]l[^>]*>\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"</[ou]l>", "", text, flags=re.IGNORECASE)

    # Convert block-level elements to newlines
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<div[^>]*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</div>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<p[^>]*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<hr[^>]*/?>", "", text, flags=re.IGNORECASE)

    # Remove all remaining HTML tags (span, b, i, etc.)
    text = re.sub(r"<[^>]+>", "", text)

    # Unescape HTML entities (&amp; &lt; &nbsp; &ensp; etc.)
    text = html_lib.unescape(text)

    # Normalize whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()

    return text
