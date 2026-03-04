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


@router.post("/import")
async def import_apkg(file: UploadFile = File(...)) -> dict[str, Any]:
    """Import an .apkg file and return parsed deck data as JSON.

    The client receives the parsed data and saves it to local SQLite.
    """
    if not file.filename or not file.filename.endswith(".apkg"):
        raise HTTPException(status_code=400, detail="File must be an .apkg file")

    # Save uploaded file to temp location
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
