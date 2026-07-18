"""FastAPI entrypoint.

Serves the JSON API under ``/api`` and the built React SPA (present in the
container image at ``./static``) for everything else, with a catch-all that
falls back to ``index.html`` so client-side routing works.
"""

from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings

settings = get_settings()
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

app = FastAPI(title="vermilion — deckbuilder API")

api = APIRouter(prefix="/api")


@api.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "app": settings.app_name,
        "environment": settings.environment,
    }


app.include_router(api)


# --- Serve the built SPA (present in the image; absent during bare backend dev) ---
if (STATIC_DIR / "index.html").is_file():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str) -> FileResponse:
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
