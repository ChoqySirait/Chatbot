"""
Performance Budgets & Deterministic Baseline Tests (Milestone 7 - REL-07).
Verifies frontend compiled bundle size budgets (when dist/ exists), payload/image bounds,
and offline deterministic endpoint p95 latency targets without calling external network APIs.
"""

import base64
import gzip
import io
import os
import time
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image

from app.config import settings
from app.core.middleware import RateLimitAndPayloadMiddleware, api_rate_limiter
from app.main import DIST_ASSETS, DIST_DIR, app
from app.services import ai_service

client = TestClient(app)


def _measure_p95_ms(fn, iterations: int = 15) -> tuple[float, float]:
    """Run deterministic endpoint warmup + N calls and return (p50_ms, p95_ms)."""
    api_rate_limiter.reset()
    warmup = fn()
    assert warmup.status_code == 200
    latencies: list[float] = []
    for _ in range(iterations):
        api_rate_limiter.reset()
        t0 = time.perf_counter()
        resp = fn()
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        assert resp.status_code == 200
        latencies.append(elapsed_ms)

    ordered = sorted(latencies)
    p50 = ordered[len(ordered) // 2]
    p95_idx = min(len(ordered) - 1, max(0, int(0.95 * len(ordered)) - 1))
    return p50, ordered[p95_idx]


def test_configured_payload_and_image_budgets():
    assert RateLimitAndPayloadMiddleware.MAX_PAYLOAD_BYTES == 5 * 1024 * 1024
    assert settings.MAX_IMAGE_SIZE_BYTES == 3 * 1024 * 1024
    assert settings.MAX_IMAGE_DIMENSION == 4096
    assert settings.MAX_IMAGE_PIXELS == 4096 * 4096


def test_frontend_dist_asset_budgets():
    if not os.path.isdir(DIST_ASSETS):
        return

    index_path = os.path.join(DIST_DIR, "index.html")
    assert os.path.isfile(index_path)
    assert os.path.getsize(index_path) <= 5 * 1024

    js_raw = 0
    js_gzip = 0
    css_raw = 0

    for fname in os.listdir(DIST_ASSETS):
        fpath = os.path.join(DIST_ASSETS, fname)
        if not os.path.isfile(fpath):
            continue
        with open(fpath, "rb") as fh:
            data = fh.read()
        if fname.endswith(".js"):
            js_raw += len(data)
            js_gzip += len(gzip.compress(data))
        elif fname.endswith(".css"):
            css_raw += len(data)

    assert js_raw > 0 and js_raw <= 650 * 1024, f"JS raw budget exceeded: {js_raw} bytes"
    assert js_gzip <= 200 * 1024, f"JS gzip budget exceeded: {js_gzip} bytes"
    assert css_raw > 0 and css_raw <= 100 * 1024, f"CSS raw budget exceeded: {css_raw} bytes"


def test_offline_deterministic_endpoint_p95_budgets():
    buf = io.BytesIO()
    Image.new("RGB", (16, 16), (10, 20, 30)).save(buf, format="PNG")
    img_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

    with patch.object(ai_service.settings, "GEMINI_API_KEY", None):
        health_p50, health_p95 = _measure_p95_ms(lambda: client.get("/api/v1/health"))
        msg_p50, msg_p95 = _measure_p95_ms(
            lambda: client.post(
                "/api/v1/analyze/message",
                json={"message": "Segera verifikasi OTP BCA anda via http://bca-promo.top"},
            )
        )
        chat_p50, chat_p95 = _measure_p95_ms(
            lambda: client.post(
                "/api/v1/chat",
                json={"message": "halo", "history": [], "mode": "consumer", "language": "id"},
            )
        )
        img_p50, img_p95 = _measure_p95_ms(
            lambda: client.post(
                "/api/v1/analyze/image",
                json={"image_base64": img_b64, "external_ai_consent": False},
            )
        )

    assert health_p95 < 100.0, f"health latency too high: p50={health_p50:.2f}ms p95={health_p95:.2f}ms"
    assert msg_p95 < 150.0, f"message latency too high: p50={msg_p50:.2f}ms p95={msg_p95:.2f}ms"
    assert chat_p95 < 150.0, f"chat fallback latency too high: p50={chat_p50:.2f}ms p95={chat_p95:.2f}ms"
    assert img_p95 < 200.0, f"image local latency too high: p50={img_p50:.2f}ms p95={img_p95:.2f}ms"
