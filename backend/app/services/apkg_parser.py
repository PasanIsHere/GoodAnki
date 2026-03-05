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

        # Find the SQLite database (prefer newer formats)
        db_path = None
        for name in ("collection.anki21b", "collection.anki21", "collection.anki2"):
            candidate = tmpdir / name
            if candidate.exists():
                db_path = candidate
                break
        if db_path is None:
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

    # Build model map: model_id -> { name, type, css, fields, templates }
    model_map: dict[str, dict] = {}
    for mid, model in models.items():
        field_names = [f["name"] for f in model["flds"]]
        templates = [
            {"name": t["name"], "qfmt": t["qfmt"], "afmt": t["afmt"]}
            for t in model["tmpls"]
        ]
        model_map[mid] = {
            "name": model["name"],
            "type": model.get("type", 0),  # 0=Standard, 1=Cloze
            "css": model.get("css", ""),
            "fields": field_names,
            "templates": templates,
        }

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

        if model["type"] == 1:  # Cloze
            note_cards = _extract_cloze_cards(fields_dict, model, media_dict)
        else:
            note_cards = _extract_standard_cards(fields_dict, model, media_dict)

        if not note_cards:
            continue

        did = note_to_deck.get(nid, "1")
        deck_name = deck_map.get(did, "Default")

        if did not in decks_data:
            decks_data[did] = {"name": deck_name, "description": "", "cards": []}

        for front, back in note_cards:
            if not front and not back:
                continue
            decks_data[did]["cards"].append({"front": front, "back": back, "tags": tags})

    result_decks = list(decks_data.values())
    return {
        "decks": result_decks,
        "total_cards": sum(len(d["cards"]) for d in result_decks),
    }


def _render_template(template: str, fields: dict[str, str]) -> str:
    """Render an Anki template string against a fields dict.

    Handles:
    - {{#Field}}...{{/Field}}  — include block only when Field is non-empty
    - {{^Field}}...{{/Field}}  — include block only when Field is empty
    - {{Field}} → field value substitution
    - Strips remaining {{...}} directives
    """
    # Conditional blocks (DOTALL so content can span lines)
    def replace_conditional(m: re.Match) -> str:
        field_name = m.group(1).strip()
        content = m.group(2)
        return content if fields.get(field_name, "").strip() else ""

    def replace_negated(m: re.Match) -> str:
        field_name = m.group(1).strip()
        content = m.group(2)
        return "" if fields.get(field_name, "").strip() else content

    text = re.sub(
        r"\{\{#([^}]+)\}\}(.*?)\{\{/\1\}\}",
        replace_conditional,
        template,
        flags=re.DOTALL,
    )
    text = re.sub(
        r"\{\{\^([^}]+)\}\}(.*?)\{\{/\1\}\}",
        replace_negated,
        text,
        flags=re.DOTALL,
    )

    # Field substitution (skip special directives: #, /, ^, !, and named specials)
    _SPECIAL = {"FrontSide", "Tags", "Type", "Deck", "Subdeck", "Card", "CardFlag"}

    def replace_field(m: re.Match) -> str:
        name = m.group(1).strip()
        if name in _SPECIAL:
            return m.group(0)
        return fields.get(name, "")

    text = re.sub(r"\{\{(?![#/^!])([^}]+)\}\}", replace_field, text)

    # Strip any remaining directives
    text = re.sub(r"\{\{[^}]+\}\}", "", text)
    return text


def _inject_css(html: str, css: str) -> str:
    """Prepend a <style> block to html if css is non-empty."""
    if not css or not css.strip():
        return html
    return f"<style>{css}</style>{html}"


def _extract_standard_cards(
    fields: dict[str, str],
    model: dict,
    media_dict: dict[str, bytes],
) -> list[tuple[str, str]]:
    """Generate one (front, back) pair per template for a standard note type.

    Returns plain text for text-only cards, or HTML strings (with inline
    data-URI media) when the card contains images or audio.
    Falls back to heuristic extraction when no templates produce output.
    """
    css = model.get("css", "")
    results: list[tuple[str, str]] = []

    for tmpl in model.get("templates", []):
        qfmt = tmpl.get("qfmt", "")
        afmt = tmpl.get("afmt", "")

        front_raw = _render_template(qfmt, fields)
        front_processed = _process_field(front_raw, media_dict)

        if not _strip_html(front_processed).strip():
            continue  # skip templates that produce an empty front

        # Resolve {{FrontSide}} in the answer template
        back_raw = _render_template(afmt, fields)
        back_raw = back_raw.replace("{{FrontSide}}", front_raw)
        back_processed = _process_field(back_raw, media_dict)

        # Inject model CSS when there is HTML content
        if re.search(r"<[a-z]", front_processed, re.IGNORECASE):
            front_processed = _inject_css(front_processed, css)
        if re.search(r"<[a-z]", back_processed, re.IGNORECASE):
            back_processed = _inject_css(back_processed, css)

        results.append((front_processed, back_processed))

    if results:
        return results

    # Fallback: first non-empty field as front, rest as back
    non_empty = [(name, val) for name, val in fields.items() if val.strip()]
    if len(non_empty) >= 2:
        front = _process_field(non_empty[0][1], media_dict)
        back_parts = [_process_field(v, media_dict) for _, v in non_empty[1:] if v.strip()]
        return [(front, "\n".join(back_parts))]
    elif len(non_empty) == 1:
        return [(_process_field(non_empty[0][1], media_dict), "")]

    return []


def _extract_cloze_cards(
    fields: dict[str, str],
    model: dict,
    media_dict: dict[str, bytes],
) -> list[tuple[str, str]]:
    """Generate one (front, back) card per cloze number found in the note."""
    css = model.get("css", "")
    results: list[tuple[str, str]] = []

    # Find the cloze field name from the template: {{cloze:FieldName}}
    cloze_field: str | None = None
    for tmpl in model.get("templates", []):
        m = re.search(r"\{\{cloze:([^}]+)\}\}", tmpl.get("qfmt", ""))
        if m:
            cloze_field = m.group(1).strip()
            break

    if cloze_field is None:
        # Fall back to first field
        cloze_field = next(iter(fields), None)
    if cloze_field is None:
        return []

    cloze_text = fields.get(cloze_field, "")

    # Collect all cloze ordinal numbers present in the field
    ordinals = sorted(set(int(n) for n in re.findall(r"\{\{c(\d+)::", cloze_text)))
    if not ordinals:
        return []

    def render_cloze(text: str, ordinal: int, reveal: bool) -> str:
        """For a given ordinal, either hide (front) or reveal (back) the answer."""

        def replace(m: re.Match) -> str:
            n = int(m.group(1))
            answer = m.group(2)
            hint = m.group(3) or "..."
            if n == ordinal:
                return f"[{hint}]" if not reveal else f"<b><u>{answer}</u></b>"
            return answer  # other cloze deletions show their answer

        # Match {{cN::answer}} and {{cN::answer::hint}}
        return re.sub(r"\{\{c(\d+)::([^:}]+)(?:::([^}]+))?\}\}", replace, text)

    for n in ordinals:
        front_text = render_cloze(cloze_text, n, reveal=False)
        back_text = render_cloze(cloze_text, n, reveal=True)

        front_processed = _process_field(front_text, media_dict)
        back_processed = _process_field(back_text, media_dict)

        if re.search(r"<[a-z]", front_processed, re.IGNORECASE):
            front_processed = _inject_css(front_processed, css)
        if re.search(r"<[a-z]", back_processed, re.IGNORECASE):
            back_processed = _inject_css(back_processed, css)

        results.append((front_processed, back_processed))

    return results


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
    # Strip all tags EXCEPT img, audio, and basic inline formatting
    text = re.sub(r"<(?!/?(?:img|audio|b|u|i|strong|em)\b)[^>]+>", "", text, flags=re.IGNORECASE)
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
