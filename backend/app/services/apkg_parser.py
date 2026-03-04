"""Parse .apkg files (Anki deck packages) into structured JSON.

An .apkg file is a zip archive containing:
- collection.anki2 or collection.anki21: SQLite database with notes, cards, models
- media: JSON mapping of numeric filenames to original names
- 0, 1, 2...: media files
"""

import json
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

        # Determine front/back from first template or first two fields
        front, back = _extract_front_back(fields_dict, model)

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


def _extract_front_back(fields: dict[str, str], model: dict) -> tuple[str, str]:
    """Extract front and back text from note fields.

    Uses simple heuristics:
    - If the model has fields named Front/Back, use those
    - Otherwise use the first two fields
    """
    field_names = list(fields.keys())

    # Try common field name patterns
    for front_key in ["Front", "front", "Question", "question"]:
        if front_key in fields:
            for back_key in ["Back", "back", "Answer", "answer"]:
                if back_key in fields:
                    return _clean_html(fields[front_key]), _clean_html(fields[back_key])

    # Fallback: first field = front, rest = back
    if len(field_names) >= 2:
        front = fields[field_names[0]]
        back = fields[field_names[1]]
        return _clean_html(front), _clean_html(back)
    elif len(field_names) == 1:
        return _clean_html(fields[field_names[0]]), ""

    return "", ""


def _clean_html(text: str) -> str:
    """Strip basic HTML tags from Anki field content."""
    import re

    # Remove HTML tags
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<div[^>]*>", "\n", text)
    text = re.sub(r"</div>", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    # Clean up whitespace
    text = text.strip()
    # Unescape HTML entities
    text = text.replace("&amp;", "&")
    text = text.replace("&lt;", "<")
    text = text.replace("&gt;", ">")
    text = text.replace("&nbsp;", " ")
    text = text.replace("&quot;", '"')
    return text
