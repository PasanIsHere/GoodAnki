"""Parse .apkg files (Anki deck packages) into structured JSON.

An .apkg file is a zip archive containing:
- collection.anki2 or collection.anki21: SQLite database with notes, cards, models
- media: JSON mapping of numeric filenames to original names
- 0, 1, 2...: the actual media files
"""

import base64
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

        with zipfile.ZipFile(file_path, "r") as zf:
            zf.extractall(tmpdir)
            media_dict = _load_media(zf)

        # Find the SQLite database
        db_path = tmpdir / "collection.anki21"
        if not db_path.exists():
            db_path = tmpdir / "collection.anki2"
        if not db_path.exists():
            raise ValueError("No collection database found in .apkg file")

        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        try:
            return _extract_data(conn, media_dict)
        finally:
            conn.close()


def _load_media(zf: zipfile.ZipFile) -> dict[str, bytes]:
    """Return {original_filename: file_bytes} for every media file in the archive."""
    names = zf.namelist()
    if "media" not in names:
        return {}

    media_index: dict[str, str] = json.loads(zf.read("media"))
    # media_index maps numeric zip entry names → original filenames
    result: dict[str, bytes] = {}
    for num_name, orig_name in media_index.items():
        if num_name in names:
            result[orig_name] = zf.read(num_name)
    return result


def _extract_data(conn: sqlite3.Connection, media_dict: dict[str, bytes]) -> dict[str, Any]:
    """Extract decks, models, and notes from the Anki SQLite database."""
    cursor = conn.cursor()

    col_row = cursor.execute("SELECT models, decks FROM col").fetchone()
    models = json.loads(col_row["models"])
    decks_config = json.loads(col_row["decks"])

    # Build model map: model_id -> { name, fields, templates }
    model_map: dict[str, dict] = {}
    for mid, model in models.items():
        field_names = [f["name"] for f in model["flds"]]
        templates = [
            {"name": t["name"], "qfmt": t["qfmt"], "afmt": t["afmt"]}
            for t in model["tmpls"]
        ]
        model_map[mid] = {"name": model["name"], "fields": field_names, "templates": templates}

    deck_map: dict[str, str] = {did: d["name"] for did, d in decks_config.items()}

    notes = cursor.execute("SELECT id, mid, flds, tags FROM notes").fetchall()
    cards = cursor.execute("SELECT id, nid, did FROM cards").fetchall()
    note_to_deck: dict[int, str] = {card["nid"]: str(card["did"]) for card in cards}

    decks_data: dict[str, dict] = {}

    for note in notes:
        nid = note["id"]
        mid = str(note["mid"])
        tags = note["tags"].strip()

        model = model_map.get(mid)
        if not model:
            continue

        field_values = note["flds"].split("\x1f")
        fields_dict = {
            name: field_values[i] if i < len(field_values) else ""
            for i, name in enumerate(model["fields"])
        }

        front, back = _extract_front_back(fields_dict, model, media_dict)

        if not front and not back:
            continue

        did = note_to_deck.get(nid, "1")
        deck_name = deck_map.get(did, "Default")

        if did not in decks_data:
            decks_data[did] = {"name": deck_name, "description": "", "cards": []}

        decks_data[did]["cards"].append({"front": front, "back": back, "tags": tags})

    result_decks = list(decks_data.values())
    return {
        "decks": result_decks,
        "total_cards": sum(len(d["cards"]) for d in result_decks),
    }


def _extract_field_refs(template_str: str) -> list[str]:
    """Extract {{FieldName}} references, excluding special directives."""
    special = {"FrontSide", "Tags", "Type", "Deck", "Subdeck", "Card", "CardFlag"}
    matches = re.findall(r"\{\{(?![#/\^!])([^}]+)\}\}", template_str)
    return [m.strip() for m in matches if m.strip() and m.strip() not in special]


def _extract_front_back(
    fields: dict[str, str],
    model: dict,
    media_dict: dict[str, bytes],
) -> tuple[str, str]:
    """Extract front and back content from note fields.

    Returns plain text for text-only cards, or HTML strings (with inline
    data-URI media) when the card contains images or audio.
    """
    # 1. Standard naming
    for front_key in ("Front", "front", "Question", "question"):
        if front_key in fields and fields[front_key].strip():
            for back_key in ("Back", "back", "Answer", "answer"):
                if back_key in fields:
                    return (
                        _process_field(fields[front_key], media_dict),
                        _process_field(fields[back_key], media_dict),
                    )

    # 2. Template-based: pick the candidate whose front is shortest (most compact)
    candidates: list[tuple[str, str]] = []
    for tmpl in model.get("templates", []):
        front_refs = _extract_field_refs(tmpl.get("qfmt", ""))
        back_refs = _extract_field_refs(tmpl.get("afmt", ""))

        front_val = ""
        used_front_refs: set[str] = set()
        for ref in front_refs:
            raw = fields.get(ref, "").strip()
            if raw:
                front_val = _process_field(raw, media_dict)
                used_front_refs.add(ref)
                break

        if not front_val:
            continue

        back_parts = []
        for ref in back_refs:
            if ref in used_front_refs:
                continue
            raw = fields.get(ref, "").strip()
            if raw:
                back_parts.append(_process_field(raw, media_dict))

        back_val = "\n".join(back_parts)
        if back_val:
            candidates.append((front_val, back_val))

    if candidates:
        # Prefer card where the front is shortest plain-text (word/character, not long definition)
        candidates.sort(key=lambda pair: len(_strip_html(pair[0])))
        return candidates[0]

    # 3. Fallback: first non-empty field as front, rest as back
    non_empty = [(name, val) for name, val in fields.items() if val.strip()]
    if len(non_empty) >= 2:
        front = _process_field(non_empty[0][1], media_dict)
        back_parts = [_process_field(v, media_dict) for _, v in non_empty[1:] if v.strip()]
        return front, "\n".join(back_parts)
    elif len(non_empty) == 1:
        return _process_field(non_empty[0][1], media_dict), ""

    return "", ""


# ── Field processing ──────────────────────────────────────────────────────────

def _process_field(text: str, media_dict: dict[str, bytes]) -> str:
    """Process a single field value.

    - With media: replaces [sound:…] with <audio> and <img src="fname"> with
      inline data URIs, then lightly cleans surrounding HTML.
    - Without media: fully strips HTML to plain text.
    """
    if not media_dict:
        return _clean_html(text)

    # Replace [sound:fname] → <audio> with data URI (or text placeholder)
    text = _replace_sound_refs(text, media_dict)

    # Replace <img src="fname"> → <img src="data:…;base64,…">
    text = _replace_img_srcs(text, media_dict)

    # If we embedded any media, keep light HTML; otherwise strip fully
    if re.search(r"<img\s|<audio\s", text, re.IGNORECASE):
        return _light_clean_html(text)
    return _clean_html(text)


def _replace_sound_refs(text: str, media_dict: dict[str, bytes]) -> str:
    _AUDIO_MIME = {
        "mp3": "audio/mpeg",
        "ogg": "audio/ogg",
        "wav": "audio/wav",
        "m4a": "audio/mp4",
        "aac": "audio/aac",
    }

    def replace(match: re.Match) -> str:
        fname = match.group(1)
        data = media_dict.get(fname)
        if data:
            ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else "mp3"
            mime = _AUDIO_MIME.get(ext, "audio/mpeg")
            b64 = base64.b64encode(data).decode()
            return f'<audio controls src="data:{mime};base64,{b64}"></audio>'
        return f"🔊 {fname}"

    return re.sub(r"\[sound:([^\]]+)\]", replace, text)


def _replace_img_srcs(text: str, media_dict: dict[str, bytes]) -> str:
    _IMAGE_MIME = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
        "webp": "image/webp",
        "svg": "image/svg+xml",
        "bmp": "image/bmp",
    }

    def replace(match: re.Match) -> str:
        before = match.group(1)
        fname = match.group(2)
        after = match.group(3)
        data = media_dict.get(fname)
        if data:
            ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else "jpg"
            mime = _IMAGE_MIME.get(ext, "image/jpeg")
            b64 = base64.b64encode(data).decode()
            return f'<img {before}src="data:{mime};base64,{b64}" {after}style="max-width:100%;height:auto">'
        return match.group(0)

    return re.sub(
        r'<img\s([^>]*?)src=["\']([^"\']+)["\']([^>]*)>',
        replace,
        text,
        flags=re.IGNORECASE,
    )


# ── HTML cleaning ─────────────────────────────────────────────────────────────

def _strip_html(text: str) -> str:
    """Strip all HTML tags — used for length measurement only."""
    return re.sub(r"<[^>]+>", "", text).strip()


def _light_clean_html(text: str) -> str:
    """Clean HTML while preserving <img> and <audio> tags for rich display."""
    # Remove Anki template directives
    text = re.sub(r"\{\{[^}]+\}\}", "", text)
    # Remove style/script blocks entirely
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.IGNORECASE | re.DOTALL)
    # Convert block elements to line breaks
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</?(?:div|p|hr|li|ul|ol)[^>]*>", "\n", text, flags=re.IGNORECASE)
    # Strip all tags EXCEPT img and audio
    text = re.sub(r"<(?!/?(?:img|audio)\b)[^>]+>", "", text, flags=re.IGNORECASE)
    # Unescape HTML entities
    text = html_lib.unescape(text)
    # Normalize whitespace (but keep newlines around media)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


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

    # Remove all remaining HTML tags
    text = re.sub(r"<[^>]+>", "", text)

    # Unescape HTML entities
    text = html_lib.unescape(text)

    # Normalize whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
