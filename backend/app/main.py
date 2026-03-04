from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import import_export

app = FastAPI(title="GoodAnki API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(import_export.router, prefix="/api", tags=["import-export"])


@app.get("/health")
async def health():
    return {"status": "ok"}
