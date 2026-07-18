# syntax=docker/dockerfile:1
# Multi-stage build: Node builds the SPA, Python serves it + the API.
# No Node at runtime (mirrors the lavender-dashboard custom-build pattern).

# ---- Stage 1: build the React SPA ----
FROM node:22-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build          # → /frontend/dist

# ---- Stage 2: Python runtime ----
FROM python:3.12-slim AS runtime
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./alembic.ini
COPY backend/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
# Built SPA assets, served by FastAPI as static files.
COPY --from=frontend /frontend/dist ./static

ENV DECKBUILDER_PORT=8099
EXPOSE 8099
# entrypoint runs `alembic upgrade head` then execs uvicorn.
CMD ["./entrypoint.sh"]
