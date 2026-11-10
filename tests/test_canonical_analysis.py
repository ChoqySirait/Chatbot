"""
Tests for Canonical Analysis Schema, Multi-URL Inspection, and Message Intelligence.
100% offline with deterministic mocks.
"""

import pytest
import asyncio
from unittest.mock import patch, AsyncMock
from app.core.heuristics import analyze_heuristics
from app.core.message_intel import analyze_message_text
from app.schemas import CanonicalAnalysisResult, AnalysisFinding, ChatResponse


def test_message_intel_social_engineering():
    # Test urgency and credential harvest detection
    text = "Akun rekening diblokir segera hubungi kami dalam waktu 1x24 jam dan kirimkan kode otp anda"
    res = analyze_message_text(text)
    assert res["is_suspicious"] is True
    assert res["score"] >= 40
    rule_ids = [f["rule_id"] for f in res["findings"]]
    assert "MSG-URGENCY-001" in rule_ids
    assert "MSG-OTP-HARVEST-001" in rule_ids


def test_message_intel_trojan_apk():
    text = "Silakan unduh dokumen surat tilang berikut di berkas tilang-elektronik.apk"
    res = analyze_message_text(text)
    assert res["is_suspicious"] is True
    rule_ids = [f["rule_id"] for f in res["findings"]]
    assert "MSG-TROJAN-APK-001" in rule_ids


@pytest.mark.asyncio
async def test_multi_url_inspection():
    text = "Silakan bandingkan promo di https://bca.co.id dan https://tokopedia.com sekarang!"
    
    with patch("app.core.heuristics.inspect_ssl_certificate", new_callable=AsyncMock) as mock_ssl, \
         patch("app.core.heuristics.inspect_domain_registration", new_callable=AsyncMock) as mock_rdap, \
         patch("app.core.heuristics.scrape_web_sample", new_callable=AsyncMock) as mock_scrape:
        mock_ssl.return_value = {"valid": True, "issuer": "DigiCert", "days_remaining": 100}
        mock_rdap.return_value = {"age_days": 2000, "creation_date": "01 Jan 2020", "registrar": "PANDI"}
        mock_scrape.return_value = {"accessible": True, "title": "Situs Resmi", "sample": "konten resmi"}

        res = await analyze_heuristics(text)
        assert res["inspection_performed"] is True
        assert res["inspected_urls_count"] == 2
        assert len(res["multi_network_intel"]) == 2
        domains = [d["domain"] for d in res["multi_network_intel"]]
        assert "bca.co.id" in domains
        assert "tokopedia.com" in domains


@pytest.mark.asyncio
async def test_canonical_result_structure():
    text = "Cek tagihan pln segera di link https://pln-palsu.online atau rekening diblokir"
    
    with patch("app.core.heuristics.inspect_ssl_certificate", new_callable=AsyncMock) as mock_ssl, \
         patch("app.core.heuristics.inspect_domain_registration", new_callable=AsyncMock) as mock_rdap, \
         patch("app.core.heuristics.scrape_web_sample", new_callable=AsyncMock) as mock_scrape:
        mock_ssl.return_value = {"valid": False, "issuer": "None", "days_remaining": 0}
        mock_rdap.return_value = {"age_days": 5, "creation_date": "01 Jan 2026", "registrar": "NameCheap"}
        mock_scrape.return_value = {"accessible": True, "title": "Phishing PLN", "sample": "login pln"}

        res = await analyze_heuristics(text)
        canonical = res["canonical_result"]
        assert isinstance(canonical, CanonicalAnalysisResult)
        assert canonical.risk_score > 50
        assert canonical.classification in ("needs_caution", "high_risk")
        assert len(canonical.findings) > 0
        assert len(canonical.recommended_actions) > 0
        assert len(canonical.limitations) > 0
