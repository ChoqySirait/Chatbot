"""
Security & Rate Limiting Middlewares for SecurAI (SEC-08, SEC-09).
Implements defensive response headers, payload size boundaries, and rate limiting.
"""

import time
from typing import Dict, List, Tuple
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Applies strict defensive HTTP security headers to all outbound responses (SEC-09).
    """

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Defensive security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=(self)"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none';"
        )
        return response


class InMemoryRateLimiter:
    """
    Sliding-window in-memory rate limiter per client IP (SEC-08).
    Thread-safe for single-process asyncio event loop.
    """

    def __init__(self, requests_per_minute: int = 120, window_seconds: int = 60):
        self.requests_per_minute = requests_per_minute
        self.window_seconds = window_seconds
        self._clients: Dict[str, List[float]] = {}

    def is_allowed(self, client_ip: str) -> Tuple[bool, int]:
        now = time.time()
        window_start = now - self.window_seconds

        timestamps = self._clients.get(client_ip, [])
        # Prune older timestamps
        valid_timestamps = [ts for ts in timestamps if ts > window_start]

        if len(valid_timestamps) >= self.requests_per_minute:
            self._clients[client_ip] = valid_timestamps
            retry_after = int(valid_timestamps[0] + self.window_seconds - now) + 1
            return False, max(1, retry_after)

        valid_timestamps.append(now)
        self._clients[client_ip] = valid_timestamps
        return True, 0

    def reset(self):
        """Clears all tracking (useful for automated testing)."""
        self._clients.clear()


# Global limiter instance for API routes
api_rate_limiter = InMemoryRateLimiter(requests_per_minute=settings.RATE_LIMIT_PER_MINUTE, window_seconds=60)


class RateLimitAndPayloadMiddleware(BaseHTTPMiddleware):
    """
    Enforces maximum payload size limit and rate limiting for API endpoints (SEC-08).
    """

    MAX_PAYLOAD_BYTES = 5 * 1024 * 1024  # 5 Megabytes

    async def dispatch(self, request: Request, call_next):
        # 1. Payload size check on POST / PUT
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                length_int = int(content_length)
                if length_int > self.MAX_PAYLOAD_BYTES:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": "Payload too large. Maximum allowed size is 5 MB."},
                    )
            except ValueError:
                pass

        # 2. Rate limiting only for API endpoints
        if request.url.path.startswith("/api/"):
            client_ip = request.client.host if request.client else "127.0.0.1"
            allowed, retry_after = api_rate_limiter.is_allowed(client_ip)
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Please wait before retrying."},
                    headers={"Retry-After": str(retry_after)},
                )

        return await call_next(request)
