"""
Automated tests for Security Headers, Payload Size Limit, and Rate Limiting (SEC-08, SEC-09).
"""

from fastapi.testclient import TestClient
from app.main import app
from app.core.middleware import InMemoryRateLimiter, api_rate_limiter

client = TestClient(app)


def test_security_headers_present():
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    headers = resp.headers

    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert "geolocation=()" in headers.get("permissions-policy", "")
    assert "frame-ancestors 'none'" in headers.get("content-security-policy", "")


def test_payload_too_large_rejected():
    # Attempting to send a payload header exceeding the 5 MB threshold
    resp = client.post(
        "/api/v1/analyze/message",
        headers={"content-length": "6000000"},
        content="x",
    )
    assert resp.status_code == 413
    assert "Payload too large" in resp.json()["detail"]


def test_rate_limiter_unit_logic():
    limiter = InMemoryRateLimiter(requests_per_minute=3, window_seconds=60)
    ip = "192.0.2.1"

    # First 3 requests should pass
    assert limiter.is_allowed(ip)[0] is True
    assert limiter.is_allowed(ip)[0] is True
    assert limiter.is_allowed(ip)[0] is True

    # 4th request must be rejected
    allowed, retry_after = limiter.is_allowed(ip)
    assert allowed is False
    assert retry_after >= 1

    # Reset allows again
    limiter.reset()
    assert limiter.is_allowed(ip)[0] is True


def test_api_rate_limiter_integration():
    # Save original state and reset
    api_rate_limiter.reset()
    original_limit = api_rate_limiter.requests_per_minute
    api_rate_limiter.requests_per_minute = 5

    try:
        for _ in range(5):
            resp = client.get("/api/v1/health")
            assert resp.status_code == 200

        # 6th request should trigger HTTP 429
        blocked_resp = client.get("/api/v1/health")
        assert blocked_resp.status_code == 429
        assert "Retry-After" in blocked_resp.headers
    finally:
        api_rate_limiter.requests_per_minute = original_limit
        api_rate_limiter.reset()
