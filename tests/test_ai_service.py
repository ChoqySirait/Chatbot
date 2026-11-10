"""
Unit tests for AI Service Orchestrator (Milestone 2).
Tests Structured JSON Output validation, dual-mode prompts, and graceful degradation fallback.
100% offline with deterministic mocks.
"""

import json
from unittest.mock import patch, MagicMock
from app.services.ai_service import (
    AIStructuredAnalysis,
    process_chat_with_gemini,
    _generate_deterministic_local_fallback
)
from app.schemas import Message


def test_ai_structured_analysis_schema_valid():
    payload = {
        "reply": "Tautan ini mengarah ke situs resmi PT Bank Central Asia (BCA).",
        "threat_category": "Resmi/Aman",
        "mitre_tags": [],
        "risk_summary": "Domain bca.co.id adalah domain resmi terdaftar dengan sertifikat SSL valid.",
        "recommended_actions": ["Aman untuk melakukan transaksi perbankan."]
    }
    model = AIStructuredAnalysis.model_validate(payload)
    assert model.threat_category == "Resmi/Aman"
    assert len(model.mitre_tags) == 0


def test_deterministic_fallback_high_risk():
    heuristic_data = {
        "heuristic_score": 75,
        "risk_flags": ["Domain sangat baru (2 hari).", "Mengandung berkas instalasi (.APK)"],
        "network_intel": {"domain": "resi-paket.online"}
    }
    reply, mitre_tags, cat = _generate_deterministic_local_fallback("cek paket resi.apk", heuristic_data)
    assert cat == "Aktif Berbahaya (Malicious)"
    assert any("T1566" in t for t in mitre_tags)
    assert "risiko TINGGI" in reply


def test_deterministic_fallback_safe_domain():
    heuristic_data = {
        "heuristic_score": 0,
        "risk_flags": [],
        "network_intel": {"domain": "bca.co.id", "ssl_valid": True, "ssl_issuer": "DigiCert"}
    }
    reply, mitre_tags, cat = _generate_deterministic_local_fallback("cek bca.co.id", heuristic_data)
    assert cat == "Resmi/Aman"
    assert len(mitre_tags) == 0
    assert "bca.co.id telah diperiksa" in reply


def test_gemini_structured_output_success():
    mock_json = json.dumps({
        "reply": "Website ini bukan penipuan, melainkan kanal resmi Tokopedia.",
        "threat_category": "Resmi/Aman",
        "mitre_tags": [],
        "risk_summary": "Domain resmi Tokopedia dengan SSL terverifikasi.",
        "recommended_actions": ["Aman digunakan."]
    })

    with patch("app.services.ai_service.settings.GEMINI_API_KEY", "fake-test-key"), \
         patch("google.genai.Client") as mock_client_cls:
        
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_response = MagicMock()
        mock_response.text = mock_json
        mock_client.models.generate_content.return_value = mock_response

        reply, mitre_tags, cat = process_chat_with_gemini(
            message="cek tokopedia.com",
            history=[],
            heuristic_data={"heuristic_score": 0, "risk_flags": []}
        )

        # Verification: despite word "penipuan" appearing in reply,
        # structured JSON output correctly keeps category as "Resmi/Aman" (NO false positive)!
        assert cat == "Resmi/Aman"
        assert "Tokopedia" in reply
        assert len(mitre_tags) == 0


def test_gemini_api_failure_activates_fallback_gracefully():
    with patch("app.services.ai_service.settings.GEMINI_API_KEY", "fake-test-key"), \
         patch("google.genai.Client") as mock_client_cls:
        
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        # Simulate network or quota exception
        mock_client.models.generate_content.side_effect = Exception("Google GenAI 503 Service Unavailable")

        heuristic_data = {
            "heuristic_score": 45,
            "risk_flags": ["Domain baru dibuat (45 hari lalu)."],
            "network_intel": {"domain": "promo-shopee.xyz"}
        }

        reply, mitre_tags, cat = process_chat_with_gemini(
            message="cek promo-shopee.xyz",
            history=[],
            heuristic_data=heuristic_data
        )

        # Graceful degradation activated without throwing error or crashing
        assert reply is not None
        assert "telemetri lokal" in reply
        assert cat in ("Ilegal (Risiko Iklan/Malvertising)", "Informasi Umum", "Aktif Berbahaya (Malicious)")
