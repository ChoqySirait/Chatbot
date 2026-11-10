"""
Unit and Integration tests for Threat Reputation Adapter (ANA-09, SEC-04).
Ensures deterministic local intelligence, conservative scoring, and graceful offline degradation.
"""

import pytest
from unittest.mock import patch, AsyncMock
from app.integrations.reputation import ThreatReputationAdapter, default_reputation_adapter
from app.core.heuristics import analyze_heuristics


@pytest.mark.asyncio
async def test_curated_threat_domain_flagged_malicious():
    adapter = ThreatReputationAdapter()
    res = await adapter.check_reputation("malware-test.top")

    assert res["status"] == "malicious"
    assert "Trojan" in res["threat_category"]
    assert res["risk_contribution"] >= 40
    assert len(res["limitations"]) > 0


@pytest.mark.asyncio
async def test_curated_phishing_domain_flagged():
    adapter = ThreatReputationAdapter()
    res = await adapter.check_reputation("bca-login-palsu.xyz")

    assert res["status"] == "malicious"
    assert "Credential Harvesting" in res["threat_category"]
    assert res["risk_contribution"] >= 30


@pytest.mark.asyncio
async def test_benign_unregistered_domain_returns_inconclusive_conservative():
    adapter = ThreatReputationAdapter()
    res = await adapter.check_reputation("domain-random-tidak-dikenal.com")

    # In accordance with product principles: absence of report is not proof of 100% safety
    assert res["status"] == "inconclusive"
    assert res["risk_contribution"] == 0
    assert "Ketiadaan laporan bukan jaminan" in res["limitations"][0]


@pytest.mark.asyncio
async def test_reputation_network_exception_degrades_gracefully():
    adapter = ThreatReputationAdapter(api_key="mock-api-key")

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = Exception("Simulated connection timeout")
        res = await adapter.check_reputation("unknown-remote-domain.com")

        assert res["status"] == "inconclusive"
        assert res["risk_contribution"] == 0
        assert "Fallback aman" in res["limitations"][0]


@pytest.mark.asyncio
async def test_heuristics_integration_with_threat_feed():
    with patch("app.core.heuristics.validate_url_for_ssrf") as mock_ssrf, \
         patch("app.core.heuristics.inspect_ssl_certificate", new_callable=AsyncMock) as mock_ssl, \
         patch("app.core.heuristics.inspect_domain_registration", new_callable=AsyncMock) as mock_rdap, \
         patch("app.core.heuristics.scrape_web_sample", new_callable=AsyncMock) as mock_scrape:

        mock_ssrf.return_value = (True, "OK", {"resolved_ip": "93.184.216.34"})
        mock_ssl.return_value = {"valid": True, "issuer": "Let's Encrypt"}
        mock_rdap.return_value = {"age_days": 150, "creation_date": "2024-01-01", "registrar": "Test Registrar"}
        mock_scrape.return_value = {"accessible": True, "title": "Test Title", "sample": "Harmless text"}

        result = await analyze_heuristics("Silakan kunjungi http://malware-test.top untuk melihat paket")

        assert result["heuristic_score"] >= 45
        assert any("Intelijen Ancaman" in flag for flag in result["risk_flags"])
        assert result["canonical_result"] is not None
        assert result["canonical_result"].classification in ("high_risk", "needs_caution")
