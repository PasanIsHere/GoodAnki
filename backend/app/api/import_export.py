"""API routes for .apkg import and export."""

import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..services.apkg_exporter import export_apkg
from ..services.apkg_parser import parse_apkg

router = APIRouter()

# Folder that holds local test .apkg files (relative to project root)
_TEST_DECKS_DIR = Path(__file__).parent.parent.parent.parent / "testankidecks"


@router.post("/import")
async def import_apkg(file: UploadFile = File(...)) -> dict[str, Any]:
    """Import an .apkg file and return parsed deck data as JSON.

    The client receives the parsed data and saves it to local SQLite.
    Media (images, audio) is embedded inline as base64 data URIs so cards
    remain fully self-contained after import.
    """
    if not file.filename or not file.filename.endswith(".apkg"):
        raise HTTPException(status_code=400, detail="File must be an .apkg file")

    with tempfile.NamedTemporaryFile(suffix=".apkg", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        result = parse_apkg(tmp_path)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse .apkg: {e}")
    finally:
        tmp_path.unlink(missing_ok=True)


@router.get("/import/local")
async def import_local_apkg() -> dict[str, Any]:
    """Import the first .apkg found in the local testankidecks/ folder.

    Useful during development to load test decks without the file picker.
    Media is embedded as base64 data URIs — no backend needed to view cards.
    """
    if not _TEST_DECKS_DIR.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Test decks folder not found: {_TEST_DECKS_DIR}",
        )

    apkg_files = sorted(_TEST_DECKS_DIR.glob("*.apkg"))
    if not apkg_files:
        raise HTTPException(
            status_code=404,
            detail="No .apkg files found in the testankidecks/ folder",
        )

    target = apkg_files[0]
    try:
        return parse_apkg(target)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse {target.name}: {e}")


class CardExport(BaseModel):
    front: str
    back: str
    tags: str = ""


class DeckExport(BaseModel):
    name: str
    description: str = ""
    cards: list[CardExport]


@router.post("/export")
async def export_deck(deck: DeckExport) -> FileResponse:
    """Export deck data to an .apkg file for download."""
    try:
        output_path = export_apkg(deck.model_dump())
        return FileResponse(
            path=str(output_path),
            filename=f"{deck.name}.apkg",
            media_type="application/octet-stream",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export: {e}")
