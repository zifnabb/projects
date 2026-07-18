#!/bin/sh
set -e
echo "[entrypoint] running database migrations..."
alembic upgrade head
echo "[entrypoint] starting uvicorn on :${DECKBUILDER_PORT:-8099}"
exec uvicorn app.main:app --host 0.0.0.0 --port "${DECKBUILDER_PORT:-8099}"
