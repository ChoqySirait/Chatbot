"""
Offline security and AI integration tests for Screenshot Validation (SEC-06),
External AI Consent (AI-07), Model Configuration (AI-01), and /api/v1/analyze/image.
"""

import io
import json
import base64
import hashlib
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.core.image_security import validate_and_inspect_image, ImageValidationError
from app.core.middleware import api_rate_limiter

client = TestClient(app)


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    api_rate_limiter.reset()
    yield
    api_rate_limiter.reset()


def _make_image_bytes(fmt: str = "PNG", size: tuple[int, int] = (32, 32)) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=(24, 144, 255))
    img.save(buf, format=fmt)
    return buf.getvalue()


@pytest.mark.parametrize(
    ("fmt", "expected_mime", "with_data_uri"),
    [
        ("PNG", "image/png", True),
        ("JPEG", "image/jpeg", True),
        ("WEBP", "image/webp", False),
    ],
)
def test_validate_valid_images_and_sha256_manifest(fmt: str, expected_mime: str, with_data_uri: bool):
    raw_bytes = _make_image_bytes(fmt=fmt, size=(48, 24))
    b64_payload = base64.b64encode(raw_bytes).decode("ascii")
    if with_data_uri:
        b64_payload = f"data:{expected_mime};base64,{b64_payload}"

    validated = validate_and_inspect_image(b64_payload)
    expected_sha256 = hashlib.sha256(raw_bytes).hexdigest()

    assert validated.mime_type == expected_mime
    assert validated.image_format == fmt
    assert validated.width == 48
    assert validated.height == 24
    assert validated.size_bytes == len(raw_bytes)
    assert validated.sha256_hash == expected_sha256
    assert len(validated.sha256_hash) == 64
    assert validated.manifest["raw_sha256"] == expected_sha256
    assert validated.manifest["mime_type"] == expected_mime


def test_validate_rejects_malformed_base64():
    with pytest.raises(ImageValidationError) as exc_info:
        validate_and_inspect_image("data:image/png;base64,!!!not-valid-base64!!!")
    assert exc_info.value.status_code == 400


def test_validate_rejects_svg_and_spoofed_png_magic_bytes():
    svg_bytes = b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"
    svg_b64 = base64.b64encode(svg_bytes).decode("ascii")

    # Declared SVG mime rejected
    with pytest.raises(ImageValidationError) as exc_svg:
        validate_and_inspect_image(f"data:image/svg+xml;base64,{svg_b64}")
    assert exc_svg.value.status_code == 400

    # HTML/SVG disguised as PNG mime rejected by magic-byte sniffing
    with pytest.raises(ImageValidationError) as exc_spoof:
        validate_and_inspect_image(f"data:image/png;base64,{svg_b64}")
    assert exc_spoof.value.status_code == 400

    # Valid PNG header with corrupt trailing container bytes rejected by Pillow verify
    corrupt_png = b"\x89PNG\r\n\x1a\ncorrupt-payload-not-an-image"
    corrupt_b64 = base64.b64encode(corrupt_png).decode("ascii")
    with pytest.raises(ImageValidationError) as exc_corrupt:
        validate_and_inspect_image(f"data:image/png;base64,{corrupt_b64}")
    assert exc_corrupt.value.status_code == 400


def test_validate_rejects_oversized_image(monkeypatch):
    raw_bytes = _make_image_bytes(fmt="PNG", size=(64, 64))
    b64_payload = base64.b64encode(raw_bytes).decode("ascii")

    monkeypatch.setattr(settings, "MAX_IMAGE_SIZE_BYTES", max(10, len(raw_bytes) - 10))
    with pytest.raises(ImageValidationError) as exc_info:
        validate_and_inspect_image(f"data:image/png;base64,{b64_payload}")
    assert exc_info.value.status_code == 413


def test_validate_rejects_excessive_dimensions_and_pixel_bomb(monkeypatch):
    raw_bytes = _make_image_bytes(fmt="PNG", size=(64, 64))
    b64_payload = base64.b64encode(raw_bytes).decode("ascii")

    # Dimension threshold test
    monkeypatch.setattr(settings, "MAX_IMAGE_DIMENSION", 32)
    with pytest.raises(ImageValidationError) as exc_dim:
        validate_and_inspect_image(f"data:image/png;base64,{b64_payload}")
    assert exc_dim.value.status_code == 400

    # Pixel bomb threshold test
    monkeypatch.setattr(settings, "MAX_IMAGE_DIMENSION", 4096)
    monkeypatch.setattr(settings, "MAX_IMAGE_PIXELS", 1024)
    with pytest.raises(ImageValidationError) as exc_bomb:
        validate_and_inspect_image(f"data:image/png;base64,{b64_payload}")
    assert exc_bomb.value.status_code == 400


def test_analyze_image_endpoint_enforces_external_ai_consent(monkeypatch):
    raw_bytes = _make_image_bytes(fmt="PNG", size=(20, 20))
    expected_sha256 = hashlib.sha256(raw_bytes).hexdigest()
    data_uri = f"data:image/png;base64,{base64.b64encode(raw_bytes).decode('ascii')}"

    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-api-key")
    with patch("app.services.ai_service.genai.Client") as mock_client_cls:
        resp = client.post(
            "/api/v1/analyze/image",
            json={
                "image_base64": data_uri,
                "context_note": "Tangkapan layar SMS mencurigakan",
                "mode": "consumer",
                "external_ai_consent": False,
            },
        )
        assert resp.status_code == 200
        mock_client_cls.assert_not_called()

    body = resp.json()
    assert body["analysis_type"] == "image"
    assert body["classification"] == "inconclusive"
    assert body["provider_status"]["image_guard"] == "verified"
    assert body["provider_status"]["ai_provider"] == "skipped_no_consent"
    assert body["provider_status"]["external_data_sent"] is False
    assert body["provider_status"]["sha256_hash"] == expected_sha256
    assert any(f["rule_id"] == "IMG-METADATA-001" for f in body["findings"])


def test_analyze_image_endpoint_uses_configured_model_when_consented(monkeypatch):
    raw_bytes = _make_image_bytes(fmt="JPEG", size=(24, 24))
    data_uri = f"data:image/jpeg;base64,{base64.b64encode(raw_bytes).decode('ascii')}"

    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-api-key")
    monkeypatch.setattr(settings, "MODEL_NAME", "gemini-2.5-custom-test")

    mock_response = MagicMock()
    mock_response.text = json.dumps(
        {
            "reply": "Tangkapan layar menunjukkan halaman login palsu yang meniru bank.",
            "mitre_tags": ["MITRE T1566 (Phishing)"],
            "threat_category": "Aktif Berbahaya (Malicious)",
            "risk_summary": "Formulir kredensial meniru merek perbankan resmi.",
            "recommended_actions": ["Tutup halaman segera dan jangan masukkan PIN."],
        }
    )

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("app.services.ai_service.genai.Client", return_value=mock_client):
        resp = client.post(
            "/api/v1/analyze/image",
            json={
                "image_base64": data_uri,
                "context_note": "Cek halaman login ini",
                "mode": "analyst",
                "external_ai_consent": True,
            },
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["classification"] == "high_risk"
    assert body["risk_score"] == 75
    assert body["provider_status"]["ai_provider"] == "gemini"
    assert body["provider_status"]["model"] == "gemini-2.5-custom-test"
    assert body["provider_status"]["external_data_sent"] is True
    assert "MITRE T1566 (Phishing)" in body["mitre_techniques"]

    call_kwargs = mock_client.models.generate_content.call_args.kwargs
    assert call_kwargs["model"] == "gemini-2.5-custom-test"


def test_chat_endpoint_rejects_invalid_image_and_forwards_mode():
    spoof_b64 = base64.b64encode(b"<html>fake</html>").decode("ascii")
    bad_resp = client.post(
        "/api/chat",
        json={
            "message": "Periksa lampiran",
            "history": [],
            "image_base64": f"data:image/png;base64,{spoof_b64}",
            "mode": "analyst",
        },
    )
    assert bad_resp.status_code == 400

    with patch(
        "app.main.process_chat_with_gemini",
        return_value=("Analisis mode analis selesai.", ["MITRE T1566"], "Resmi/Aman"),
    ) as mock_chat:
        ok_resp = client.post(
            "/api/chat",
            json={
                "message": "Evaluasi pesan keamanan sederhana ini",
                "history": [],
                "mode": "analyst",
            },
        )
    assert ok_resp.status_code == 200
    assert mock_chat.call_args.args[4] == "analyst"
