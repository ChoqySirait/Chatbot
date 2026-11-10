"""
Curated Benchmark Evaluation Dataset & Regression Tests (AI-08, REL-02).
Evaluates system accuracy across Benign, Suspicious, Malicious, and Inconclusive cases.
"""

import pytest
from unittest.mock import patch, AsyncMock
from app.core.heuristics import analyze_heuristics
from app.schemas import CanonicalAnalysisResult

BENCHMARK_CASES = [
    # 1. Benign Scenarios
    {
        "id": "BENIGN-01",
        "category": "Official Bank Domain",
        "text": "Silakan cek saldo resmi Anda melalui portal https://bca.co.id kapan saja.",
        "expected_classification": "no_major_indicator",
        "expected_max_score": 10,
        "is_safe_ssrf": True,
        "mock_ssl": {"valid": True, "issuer": "DigiCert Global Root CA"},
        "mock_rdap": {"age_days": 7000, "creation_date": "2005-01-01", "registrar": "PANDI"},
        "mock_scrape": {"accessible": True, "title": "BCA - Senantiasa di Sisi Anda", "sample": "Selamat datang di BCA"},
    },
    {
        "id": "BENIGN-02",
        "category": "Official E-Commerce",
        "text": "Pesanan Anda sedang dikirim oleh kurir. Cek transaksi di https://www.tokopedia.com",
        "expected_classification": "no_major_indicator",
        "expected_max_score": 10,
        "is_safe_ssrf": True,
        "mock_ssl": {"valid": True, "issuer": "DigiCert"},
        "mock_rdap": {"age_days": 5500, "creation_date": "2009-08-17", "registrar": "PANDI"},
        "mock_scrape": {"accessible": True, "title": "Tokopedia - Jual Beli Online", "sample": "Promo belanja"},
    },

    # 2. Malicious Scenarios
    {
        "id": "MALICIOUS-01",
        "category": "Urgent Banking Impersonation Phishing",
        "text": "REKENING DIBLOKIR! Segera konfirmasi tarif baru Anda di https://bca-promo-login.com dalam 10 menit!",
        "expected_classification": "high_risk",
        "expected_min_score": 60,
        "is_safe_ssrf": True,
        "mock_ssl": {"valid": True, "issuer": "Let's Encrypt"},
        "mock_rdap": {"age_days": 4, "creation_date": "2026-11-06", "registrar": "Namecheap"},
        "mock_scrape": {"accessible": True, "title": "BCA Mobile Login", "sample": "Masukkan kode OTP anda"},
    },
    {
        "id": "MALICIOUS-02",
        "category": "Trojan APK Wedding Invite Scam",
        "text": "Halo kami mengundang di pernikahan kami. Buka surat undangan di Undangan_Pernikahan_Digital.apk ya",
        "expected_classification": "high_risk",
        "expected_min_score": 40,
        "is_safe_ssrf": True,
        "mock_ssl": {"valid": False},
        "mock_rdap": {"age_days": None},
        "mock_scrape": {"accessible": False},
    },
    {
        "id": "MALICIOUS-03",
        "category": "Social Engineering OTP Harvest",
        "text": "Selamat siang, kami dari tim verifikasi bank. Mohon segera kirimkan kode OTP 6 digit yang baru saja masuk ke SMS Anda.",
        "expected_classification": "high_risk",
        "expected_min_score": 40,
        "is_safe_ssrf": True,
        "mock_ssl": {"valid": False},
        "mock_rdap": {"age_days": None},
        "mock_scrape": {"accessible": False},
    },

    # 3. Suspicious / Needs Caution Scenarios
    {
        "id": "CAUTION-01",
        "category": "Unofficial Comic Media / Malvertising",
        "text": "Baca komik manga terbaru sub indo gratis chapter 100 di https://bacakomik-indo.xyz",
        "expected_classification": "needs_caution",
        "expected_min_score": 20,
        "is_safe_ssrf": True,
        "mock_ssl": {"valid": True, "issuer": "ZeroSSL"},
        "mock_rdap": {"age_days": 180, "creation_date": "2024-05-01", "registrar": "Public Domain Registry"},
        "mock_scrape": {"accessible": True, "title": "Baca Komik Manga", "sample": "baca komik chapter terbaru streaming"},
    },

    # 4. Inconclusive / Innocent Message Scenarios
    {
        "id": "INCONCLUSIVE-01",
        "category": "General Harmless Conversational Greeting",
        "text": "Selamat pagi, bagaimana kabar Anda hari ini?",
        "expected_classification": "no_major_indicator",
        "expected_max_score": 0,
        "is_safe_ssrf": True,
        "mock_ssl": {"valid": False},
        "mock_rdap": {"age_days": None},
        "mock_scrape": {"accessible": False},
    },
]


@pytest.mark.asyncio
@pytest.mark.parametrize("case", BENCHMARK_CASES, ids=lambda c: c["id"])
async def test_benchmark_scenarios(case):
    """
    Executes benchmark test case offline with deterministic mocks.
    """
    with patch("app.core.heuristics.validate_url_for_ssrf") as mock_ssrf, \
         patch("app.core.heuristics.inspect_ssl_certificate", new_callable=AsyncMock) as mock_ssl, \
         patch("app.core.heuristics.inspect_domain_registration", new_callable=AsyncMock) as mock_rdap, \
         patch("app.core.heuristics.scrape_web_sample", new_callable=AsyncMock) as mock_scrape:

        mock_ssrf.return_value = (case["is_safe_ssrf"], "OK", {"resolved_ip": "93.184.216.34"})
        mock_ssl.return_value = case["mock_ssl"]
        mock_rdap.return_value = case["mock_rdap"]
        mock_scrape.return_value = case["mock_scrape"]

        result = await analyze_heuristics(case["text"])
        canonical = result["canonical_result"]

        assert canonical is not None, f"Case {case['id']} failed: canonical result is None"
        assert canonical.classification == case["expected_classification"], (
            f"Case {case['id']} classification mismatch: got {canonical.classification}, "
            f"expected {case['expected_classification']}"
        )

        if "expected_min_score" in case:
            assert canonical.risk_score >= case["expected_min_score"], (
                f"Case {case['id']} score too low: got {canonical.risk_score}, "
                f"expected >= {case['expected_min_score']}"
            )

        if "expected_max_score" in case:
            assert canonical.risk_score <= case["expected_max_score"], (
                f"Case {case['id']} score too high: got {canonical.risk_score}, "
                f"expected <= {case['expected_max_score']}"
            )
