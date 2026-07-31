"""Search + card-detail API (Phase 2)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.db import get_session
from app.scryfall import search as sf
from app.search_compiler import compile_query

# Login-gated like decks/io/admin: card data is public MTG info, but /search
# proxies Scryfall under our User-Agent, so leaving it open is an unauthenticated
# request amplifier that can saturate the shared throttle. The only public view
# (/shared/<token>, in decks.py) renders from its own payload and calls nothing
# here. (Security review 2026-07-30, finding #1.)
router = APIRouter(prefix="/api", tags=["search"], dependencies=[Depends(get_current_user)])


class CompileRequest(BaseModel):
    filters: dict = Field(default_factory=dict)
    run: bool = False
    page: int = 1
    order: str = "name"
    unique: str = "cards"


@router.get("/search/autocomplete")
async def autocomplete(
    q: str = Query(..., min_length=1),
    limit: int = Query(15, ge=1, le=50),
    commanders_only: bool = Query(False),
    identity: str | None = Query(None, description="WUBRG letters; results must fit inside ('' = colorless)"),
    format_legal: str | None = Query(None, description="format key; only legal/restricted cards returned"),
    session: AsyncSession = Depends(get_session),
) -> dict:
    return {
        "results": await sf.autocomplete(
            session,
            q,
            limit,
            commanders_only=commanders_only,
            identity=identity,
            format_legal=format_legal,
        )
    }


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    order: str = "name",
    unique: str = "cards",
    session: AsyncSession = Depends(get_session),
) -> dict:
    return await sf.full_search(session, q, page=page, order=order, unique=unique)


@router.post("/search/compile")
async def compile_and_optionally_run(
    body: CompileRequest,
    session: AsyncSession = Depends(get_session),
) -> dict:
    query = compile_query(body.filters)
    result: dict = {"query": query}
    if body.run and query:
        result["search"] = await sf.full_search(
            session, query, page=body.page, order=body.order, unique=body.unique
        )
    return result


@router.get("/cards/{oracle_id}")
async def card_detail(
    oracle_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    detail = await sf.card_detail(session, oracle_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="card not found")
    return detail


@router.get("/printings/{scryfall_id}/rulings")
async def card_rulings(scryfall_id: str) -> dict:
    result = await sf.rulings(scryfall_id)
    if result is None:
        return {"available": False, "rulings": []}
    return {"available": True, "rulings": result}
