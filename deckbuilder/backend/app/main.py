"""FastAPI entrypoint.

Serves the JSON API under ``/api`` and the built React SPA (present in the
container image at ``./static``) for everything else, with a catch-all that
falls back to ``index.html`` so client-side routing works.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_admin
from app.bootstrap import ensure_admin
from app.config import get_settings
from app.db import get_session
from app.http_adapter import aclose as http_aclose
from app.models import Card, Printing
from app.routers.admin import router as admin_router
from app.routers.auth import router as auth_router
from app.routers.decks import router as decks_router
from app.routers.io import router as io_router
from app.routers.search import router as search_router
from app.scryfall.bulk import sync_bulk

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("app")

settings = get_settings()
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

scheduler = BackgroundScheduler()
_sync_lock = asyncio.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Nightly Scryfall bulk sync (runs sync_bulk in the scheduler's worker thread).
    scheduler.add_job(
        sync_bulk,
        CronTrigger(hour=4, minute=0),
        id="scryfall_nightly",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.start()
    log.info("scheduler started (scryfall nightly sync @ 04:00)")
    await ensure_admin()
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        await http_aclose()


app = FastAPI(title="vermilion — deckbuilder API", lifespan=lifespan)

api = APIRouter(prefix="/api")


@api.get("/health")
async def health() -> dict:
    return {"status": "ok", "app": settings.app_name, "environment": settings.environment}


@api.get("/cards/stats")
async def card_stats(session: AsyncSession = Depends(get_session)) -> dict:
    cards = await session.scalar(select(func.count()).select_from(Card))
    printings = await session.scalar(select(func.count()).select_from(Printing))
    return {"cards": cards, "printings": printings}


@api.post("/sync/scryfall")
async def trigger_sync(
    kinds: str = "oracle_cards,default_cards",
    _admin=Depends(get_current_admin),
) -> dict:
    kind_tuple = tuple(k.strip() for k in kinds.split(",") if k.strip())
    if _sync_lock.locked():
        raise HTTPException(status_code=409, detail="sync already running")

    async def _run() -> None:
        async with _sync_lock:
            try:
                counts = await asyncio.to_thread(sync_bulk, kind_tuple)
                log.info("manual scryfall sync done: %s", counts)
            except Exception:  # noqa: BLE001
                log.exception("manual scryfall sync failed")

    asyncio.create_task(_run())
    return {"started": True, "kinds": kind_tuple}


app.include_router(api)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(decks_router)
app.include_router(io_router)
app.include_router(search_router)


# --- Serve the built SPA (present in the image; absent during bare backend dev) ---
if (STATIC_DIR / "index.html").is_file():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str) -> FileResponse:
        # Never let unmatched API paths fall through to the SPA — 404 them.
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="not found")
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
