#!/bin/sh
set -e
echo "[entrypoint] running database migrations..."
alembic upgrade head
echo "[entrypoint] starting uvicorn on :${DECKBUILDER_PORT:-8099}"
# --proxy-headers + a trusted-proxy allowlist so request.client.host is the real
# client (from X-Forwarded-For) rather than NPM's address — otherwise the auth
# rate-limiter's per-IP buckets all collapse into one global bucket (security
# review 2026-07-30, finding #3). NPM is host-networked and proxies to
# 192.168.1.222:8099, so it connects from loopback or the host IP; trusting only
# those means a direct LAN hit can't spoof its rate-limit identity. Override with
# FORWARDED_ALLOW_IPS if the proxy source ever changes.
exec uvicorn app.main:app --host 0.0.0.0 --port "${DECKBUILDER_PORT:-8099}" \
  --proxy-headers --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-127.0.0.1,192.168.1.222}"
