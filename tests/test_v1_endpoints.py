"""
Tests for API v1 Endpoints & Logging Privacy Filter (Milestone 2).
Uses FastAPI TestClient with deterministic mocks.
"""

from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
import logging

from app.main import app
from app.core.logging_config import PrivacyFilter

client = TestClient(app)


def test_v1_health_endpoint():
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "version" in data


def test_v1_ready_endpoint():
    resp = client.get("/api/v1/ready")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ready"
    assert "providers" in data
    assert data["providers"]["heuristics_engine"] == "operational"


def test_v1_analyze_url_endpoint():
    with patch("app.main.analyze_heuristics", new_callable=AsyncMock) as mock_analyze:
        from app.schemas import CanonicalAnalysisResult
        mock_canonical = CanonicalAnalysisResult(
            analysis_id="test1234",
            analysis_type="url",
            classification="no_major_indicator",
            risk_score=0,
            confidence="high",
            findings=[],
            mitre_techniques=[],
            recommended_actions=["Aman digunakan."],
            limitations=["Heuristik publik."],
            provider_status={"engine": "ok"}
        )
        mock_analyze.return_value = {"canonical_result": mock_canonical}

        resp = client.post("/api/v1/analyze/url", json={"url": "https://bca.co.id"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["analysis_id"] == "test1234"
        assert data["analysis_type"] == "url"
        assert data["classification"] == "no_major_indicator"
        assert data["risk_score"] == 0


def test_v1_analyze_message_endpoint():
    with patch("app.main.analyze_heuristics", new_callable=AsyncMock) as mock_analyze:
        from app.schemas import CanonicalAnalysisResult, AnalysisFinding
        mock_canonical = CanonicalAnalysisResult(
            analysis_id="msg5678",
            analysis_type="message",
            classification="high_risk",
            risk_score=70,
            confidence="high",
            findings=[
                AnalysisFinding(
                    rule_id="MSG-OTP-HARVEST-001",
                    title="Minta OTP",
                    severity="critical",
                    evidence="minta kode sms",
                    source="Message Heuristics",
                    observed_at="2026-11-10T00:00:00Z"
                )
            ],
            mitre_techniques=["T1056.003"],
            recommended_actions=["Jangan berikan OTP."],
            limitations=[],
            provider_status={}
        )
        mock_analyze.return_value = {"canonical_result": mock_canonical}

        resp = client.post("/api/v1/analyze/message", json={"message": "Segera kirim kode otp anda"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["analysis_id"] == "msg5678"
        assert data["classification"] == "high_risk"
        assert len(data["findings"]) == 1
        assert data["findings"][0]["rule_id"] == "MSG-OTP-HARVEST-001"


def test_logging_privacy_filter():
    f = PrivacyFilter()
    rec = logging.LogRecord(
        name="test", level=logging.INFO, pathname="", lineno=0,
        msg='User authenticated with api_key="secret12345" and bearer eyJhbGciOi...',
        args=(), exc_info=None
    )
    f.filter(rec)
    assert "secret12345" not in rec.msg
    assert "***REDACTED***" in rec.msg
