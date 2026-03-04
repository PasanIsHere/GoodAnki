"""Export deck data to .apkg format using genanki."""

import tempfile
from pathlib import Path
from typing import Any

import genanki


def export_apkg(deck_data: dict[str, Any], output_path: str | Path | None = None) -> Path:
    """Export deck data to an .apkg file.

    Args:
        deck_data: Dict with 'name', 'description', 'cards' (list of {front, back, tags})
        output_path: Optional output path. If None, creates a temp file.

    Returns:
        Path to the created .apkg file.
    """
    # Create a genanki model (Basic card type)
    model = genanki.Model(
        1607392319,  # Stable model ID
        "GoodAnki Basic",
        fields=[
            {"name": "Front"},
            {"name": "Back"},
        ],
        templates=[
            {
                "name": "Card 1",
                "qfmt": "{{Front}}",
                "afmt": '{{FrontSide}}<hr id="answer">{{Back}}',
            },
        ],
    )

    # Create deck with a hash-based ID from the name
    deck_id = abs(hash(deck_data["name"])) % (2**31)
    deck = genanki.Deck(deck_id, deck_data["name"])
    deck.description = deck_data.get("description", "")

    # Add cards
    for card in deck_data["cards"]:
        tags = card.get("tags", "").split() if card.get("tags") else []
        note = genanki.Note(
            model=model,
            fields=[card["front"], card["back"]],
            tags=tags,
        )
        deck.add_note(note)

    # Write to file
    if output_path is None:
        tmp = tempfile.NamedTemporaryFile(suffix=".apkg", delete=False)
        output_path = Path(tmp.name)
        tmp.close()
    else:
        output_path = Path(output_path)

    genanki.Package(deck).write_to_file(str(output_path))
    return output_path
