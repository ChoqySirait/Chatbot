"""
Release Candidate Smoke Tests (Milestone 6 - REL-03 / REL-04 / GOV-01).
Verifies built frontend static bundle serving, security headers, CORS policy,
error containment, and deployment artifacts using deterministic offline state.
"""

import os
import re
import pytest
from fastapi.testclient import TestClient

from app.main import app, DIST_DIR
from app.core.middleware import api_rate_limiter

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
client = TestClient(app)


@pytest.fixture(autouse=True)
def _reset_limiter():
    api_rate_limiter.reset()
    yield
    api_rate_limiter.reset()


def test_release_governance_and_deployment_files_present():
    for rel_path in [
        "Dockerfile",
        ".dockerignore",
        "docker-compose.yml",
        "PRIVACY.md",
        "ARCHITECTURE.md",
        "LICENSE",
        "CHANGELOG.md",
    ]:
        full_path = os.path.join(ROOT_DIR, rel_path)
        assert os.path.isfile(full_path), f"Missing release artifact: {rel_path}"

    with open(os.path.join(ROOT_DIR, "Dockerfile"), "r", encoding="utf-8") as fh:
        dockerfile_text = fh.read()
    assert "USER appuser" in dockerfile_text
    assert "HEALTHCHECK" in dockerfile_text


def test_frontend_bundle_and_assets_served_cleanly():
    index_resp = client.get("/")
    assert index_resp.status_code == 200
    assert "text/html" in index_resp.headers.get("content-type", "")
    assert index_resp.headers.get("x-content-type-options") == "nosniff"
    assert index_resp.headers.get("x-frame-options") == "DENY"

    dist_index = os.path.join(DIST_DIR, "index.html")
    if os.path.isfile(dist_index):
        html = index_resp.text
        assert '<div id="root"></div>' in html

        asset_matches = re.findall(r'(?:src|href)="(/assets/[^"]+)"', html)
        assert len(asset_matches) >= 1, "Expected compiled Vite assets referenced in dist/index.html"

        for asset_path in asset_matches:
            asset_resp = client.get(asset_path)
            assert asset_resp.status_code == 200
            assert len(asset_resp.content) > 0

        fav_resp = client.get("/favicon.svg")
        assert fav_resp.status_code == 200
        assert "image/svg+xml" in fav_resp.headers.get("content-type", "")


def test_cors_respects_configured_origins():
    allowed_resp = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://127.0.0.1:8000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert allowed_resp.headers.get("access-control-allow-origin") == "http://127.0.0.1:8000"

    disallowed_resp = client.options(
        "/api/v1/health",
        headers={
            "Origin": "https://untrusted-external.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in disallowed_resp.headers


def test_invalid_inputs_fail_cleanly_without_tracebacks():
    empty_chat = client.post("/api/chat", json={"message": "   ", "history": []})
    assert empty_chat.status_code == 400
    detail = empty_chat.json().get("detail", "")
    assert "Traceback" not in detail

    bad_image = client.post(
        "/api/v1/analyze/image",
        json={"image_base64": "not-valid-base64", "external_ai_consent": False},
    )
    assert bad_image.status_code == 400
    assert "Traceback" not in bad_image.json().get("detail", "")
