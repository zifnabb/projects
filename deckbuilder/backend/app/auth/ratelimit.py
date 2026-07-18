"""In-memory rate-limit + lockout for auth endpoints (PLAN §15).

Single uvicorn worker, handful of users — an in-process limiter is sufficient.
Lockouts reset on restart, which is acceptable. Applied per-IP and per-account
on login, and per-IP on register/reset (deters credential-stuffing + token
guessing). Cloudflare sits in front for network-level DDoS/WAF.
"""

import time
from collections import defaultdict, deque


class TooManyAttempts(Exception):
    def __init__(self, retry_after: int) -> None:
        self.retry_after = retry_after
        super().__init__(f"locked for {retry_after}s")


class RateLimiter:
    def __init__(self, limit: int = 5, window: float = 300.0, lockout: float = 900.0) -> None:
        self.limit = limit
        self.window = window
        self.lockout = lockout
        self._fails: dict[str, deque[float]] = defaultdict(deque)
        self._locked: dict[str, float] = {}

    def guard(self, key: str) -> None:
        """Raise TooManyAttempts if `key` is currently locked out."""
        unlock = self._locked.get(key, 0.0)
        now = time.monotonic()
        if unlock > now:
            raise TooManyAttempts(int(unlock - now) + 1)

    def fail(self, key: str) -> None:
        now = time.monotonic()
        dq = self._fails[key]
        dq.append(now)
        while dq and dq[0] < now - self.window:
            dq.popleft()
        if len(dq) >= self.limit:
            self._locked[key] = now + self.lockout
            dq.clear()

    def succeed(self, key: str) -> None:
        self._fails.pop(key, None)
        self._locked.pop(key, None)


limiter = RateLimiter()
