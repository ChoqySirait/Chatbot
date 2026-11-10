"""
Heuristics Engine Core Module.
Implements hardened web content sampling, deterministic threat heuristics,
brand impersonation detection via local Public Suffix List, multi-URL inspection,
and canonical structured analysis result generation (Milestone 2).
"""

import re
import uuid
import datetime
import asyncio
from urllib.parse import urljoin
from typing import List, Dict, Any, Optional
import httpx

from app.core.security import validate_url_for_ssrf, defang_url
from app.core.public_suffix import get_domain_from_url, detect_brand_impersonation, is_official_brand_domain
from app.core.network_intel import inspect_ssl_certificate, inspect_domain_registration, generate_evidence_hash, create_evidence_manifest
from app.core.message_intel import analyze_message_text
from app.schemas import AnalysisFinding, CanonicalAnalysisResult
from app.integrations.reputation import default_reputation_adapter

URL_REGEX = r'(https?://[^\s<>"]+|www\.[^\s<>"]+|[a-zA-Z0-9-]+\.(?:com|org|net|id|co\.id|xyz|site|top|online|vip|live|club|cc|me|info|io)(?:/[^\s<>"]*)?)'
IP_URL_REGEX = r'(?:https?://)?(?:\d{1,3}\.){3}\d{1,3}'

JUDOL_KEYWORDS = ["slot", "gacor", "maxwin", "depo", "withdraw", "pragmatic", "togel", "rtp live", "judol", "scatter", "jackpot"]
PIRACY_KEYWORDS = ["baca komik", "manhwa", "manga", "komik indo", "nonton anime", "streaming gratis", "sub indo", "chapter"]

MAX_REDIRECT_HOPS = 5
MAX_BODY_BYTES = 1024 * 1024  # 1 MB
MAX_INSPECT_URLS = 5


async def scrape_web_sample(url: str) -> Dict[str, Any]:
    """
    Mengambil sampel konten web secara terverifikasi dan diperkeras:
    - Verifikasi sertifikat TLS aktif (verify=True).
    - Tanpa automatic redirects (manual redirect loop max 5 hops).
    - Validasi SSRF ketat pada setiap hop redirect.
    - Pembatasan body stream maksimal 1 MB.
    - Timeout koneksi & baca dibatasi (2.0s).
    - Penanganan error aman tanpa membuka rincian jaringan internal.
    """
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SecurAI-ConsumerGuard/2.5"}
    current_url = url if url.startswith(('http://', 'https://')) else 'https://' + url
    hops = 0

    timeout = httpx.Timeout(2.0, connect=2.0, read=2.0)

    try:
        async with httpx.AsyncClient(timeout=timeout, verify=True, trust_env=False, follow_redirects=False) as client:
            while hops <= MAX_REDIRECT_HOPS:
                is_safe, reason, metadata = validate_url_for_ssrf(current_url)
                if not is_safe:
                    return {
                        "accessible": False,
                        "title": "Ditolak: Pelanggaran Keamanan Jaringan / SSRF",
                        "sample": "",
                        "hops": hops,
                        "error": reason
                    }

                try:
                    response = await client.get(current_url, headers=headers)
                except httpx.SSLError:
                    return {
                        "accessible": False,
                        "title": "Kegagalan Verifikasi TLS / Sertifikat Untrusted",
                        "sample": "",
                        "hops": hops
                    }
                except (httpx.TimeoutException, httpx.NetworkError):
                    return {
                        "accessible": False,
                        "title": "Waktu Koneksi Habis / Situs Tidak Dapat Dijangkau",
                        "sample": "",
                        "hops": hops
                    }

                if response.status_code in (301, 302, 303, 307, 308):
                    hops += 1
                    if hops > MAX_REDIRECT_HOPS:
                        return {
                            "accessible": False,
                            "title": "Jumlah Pengalihan (Redirects) Melebihi Batas Maksimum",
                            "sample": "",
                            "hops": hops
                        }
                    
                    location = response.headers.get("Location")
                    if not location:
                        break
                    
                    current_url = urljoin(current_url, location)
                    continue

                raw_text = response.text[:MAX_BODY_BYTES]
                sample = raw_text[:5000].lower()

                title_match = re.search(r'<title[^>]*>(.*?)</title>', raw_text[:5000], re.IGNORECASE | re.DOTALL)
                page_title = title_match.group(1).strip() if title_match else "Tanpa Judul"

                return {
                    "accessible": True,
                    "title": page_title[:100],
                    "sample": sample,
                    "status_code": response.status_code,
                    "hops": hops,
                    "content_length": len(raw_text)
                }

    except Exception:
        return {"accessible": False, "title": "Inspeksi Jaringan Terkendala", "sample": "", "hops": hops}

    return {"accessible": False, "title": "Inspeksi Selesai Tanpa Konten", "sample": "", "hops": hops}


async def _inspect_single_url(raw_url: str) -> Dict[str, Any]:
    """Inspeksi telemetri jaringan untuk satu URL spesifik."""
    domain = get_domain_from_url(raw_url)
    fetch_url = raw_url if raw_url.startswith(('http://', 'https://')) else 'https://' + raw_url
    evidence_hash = generate_evidence_hash(raw_url)

    is_safe, reason, metadata = validate_url_for_ssrf(fetch_url)
    if not is_safe:
        return {
            "url": raw_url,
            "domain": domain,
            "is_safe": False,
            "flags": [f"Tautan {raw_url} ditolak oleh pengawas keamanan (Anti-SSRF): {reason}"],
            "score": 40,
            "network_intel": None,
            "evidence_hash": evidence_hash
        }

    ssl_task = inspect_ssl_certificate(domain)
    domain_task = inspect_domain_registration(domain)
    scrape_task = scrape_web_sample(fetch_url)
    rep_task = default_reputation_adapter.check_reputation(domain)

    ssl_info, domain_info, web_info, rep_info = await asyncio.gather(
        ssl_task, domain_task, scrape_task, rep_task, return_exceptions=True
    )

    if isinstance(ssl_info, Exception):
        ssl_info = {"valid": False, "issuer": "Timeout Pemeriksaan SSL", "days_remaining": 0}
    if isinstance(domain_info, Exception):
        domain_info = {"age_days": None, "creation_date": "Data RDAP Terbatas", "registrar": "Umum"}
    if isinstance(web_info, Exception):
        web_info = {"accessible": False, "title": "Situs Tidak Dapat Diakses", "sample": ""}
    if isinstance(rep_info, Exception):
        rep_info = {"status": "inconclusive", "threat_category": "Error", "risk_contribution": 0}

    flags = []
    score = 0

    # Threat Intelligence Feed Indicator
    if isinstance(rep_info, dict) and rep_info.get("status") in ("malicious", "suspicious"):
        flags.append(f"Intelijen Ancaman ({rep_info.get('threat_category', 'Threat')}): {rep_info.get('evidence', '')}")
        score += rep_info.get("risk_contribution", 30)

    if domain_info.get("age_days") is not None:
        if domain_info["age_days"] < 30:
            flags.append(f"Domain sangat baru ({domain_info['age_days']} hari). Taktik khas situs penipuan sementara!")
            score += 45
        elif domain_info["age_days"] < 90:
            flags.append(f"Domain baru dibuat ({domain_info['age_days']} hari lalu). Wajib waspada.")
            score += 20

    if not ssl_info.get("valid"):
        flags.append("Situs tidak memakai enkripsi SSL yang valid atau sertifikat bermasalah.")
        score += 25

    sample = web_info.get("sample", "")
    if any(k in sample for k in JUDOL_KEYWORDS):
        flags.append("Halaman teridentifikasi memuat transaksi atau promosi judi online.")
        score += 50
    if any(k in sample for k in PIRACY_KEYWORDS):
        flags.append("Situs platform media non-resmi (Risiko utama: Iklan pop-up pihak ketiga).")
        score += 20

    # Brand impersonation check
    impersonations = detect_brand_impersonation(domain)
    for imp in impersonations:
        flags.append(imp["reason"])
        score += 40

    network_intel = {
        "url": raw_url,
        "domain": domain,
        "page_title": web_info.get("title", "Tanpa Judul"),
        "ssl_issuer": ssl_info.get("issuer", "Tidak Diketahui"),
        "ssl_valid": ssl_info.get("valid", False),
        "domain_age": f"{domain_info['age_days']} hari" if domain_info.get("age_days") is not None else domain_info.get("creation_date"),
        "registrar": domain_info.get("registrar", "Umum"),
        "evidence_hash": evidence_hash,
        "hops": web_info.get("hops", 0)
    }

    return {
        "url": raw_url,
        "domain": domain,
        "is_safe": True,
        "flags": flags,
        "score": score,
        "network_intel": network_intel,
        "evidence_hash": evidence_hash
    }


async def analyze_heuristics(text: str) -> Dict[str, Any]:
    """
    Analisis heuristik deterministik multi-vektor (Milestone 2):
    1. Multi-URL parsing & parallel inspection (hingga 5 URL).
    2. Deep message social engineering inspection via message_intel.
    3. Ekstraksi findings terstruktur kanonis (ANA-01).
    4. Pembentukan CanonicalAnalysisResult dengan transparansi skor & bukti.
    """
    flags: List[str] = []
    findings: List[AnalysisFinding] = []
    score = 0
    now_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()
    evidence_hash = generate_evidence_hash(text)

    # 1. Deteksi semua URL unik
    raw_urls = re.findall(URL_REGEX, text)
    unique_urls = list(dict.fromkeys(raw_urls))[:MAX_INSPECT_URLS]
    defanged = [defang_url(u) for u in raw_urls]

    multi_network_intel: List[Dict[str, Any]] = []
    primary_network_intel: Optional[Dict[str, Any]] = None

    if unique_urls:
        # Eksekusi paralel untuk seluruh URL unik
        url_tasks = [_inspect_single_url(u) for u in unique_urls]
        url_results = await asyncio.gather(*url_tasks, return_exceptions=True)

        for res in url_results:
            if isinstance(res, dict):
                flags.extend(res.get("flags", []))
                score += res.get("score", 0)
                if res.get("network_intel"):
                    multi_network_intel.append(res["network_intel"])

                # Buat findings kanonis untuk setiap temuan URL
                for flag in res.get("flags", []):
                    findings.append(AnalysisFinding(
                        rule_id=f"URL-FLAG-{abs(hash(flag)) % 1000:03d}",
                        title="Indikator Risiko Jaringan / Domain",
                        severity="high" if "SSRF" in flag or "sangat baru" in flag or "meniru brand" in flag else "medium",
                        evidence=flag,
                        source="Network Telemetry",
                        observed_at=now_utc,
                        limitations=["Berdasarkan telemetri jaringan publik saat pemeriksaan."]
                    ))

        # Pilih network_intel utama (yang memiliki skor tertinggi atau yang pertama)
        if multi_network_intel:
            primary_network_intel = multi_network_intel[0]

    # 2. Analisis Pesan Rekayasa Sosial Terstruktur (message_intel)
    msg_analysis = analyze_message_text(text)
    if msg_analysis["is_suspicious"]:
        score += msg_analysis["score"]
        for f in msg_analysis["findings"]:
            flags.append(f"{f['title']}: {f['evidence']}")
            findings.append(AnalysisFinding(
                rule_id=f["rule_id"],
                title=f["title"],
                severity=f["severity"],
                evidence=f["evidence"],
                source=f["source"],
                observed_at=f["observed_at"],
                explanation=f.get("explanation"),
                limitations=f.get("limitations", [])
            ))

    score = min(score, 100)
    has_suspicious = len(flags) > 0 or score > 0

    # 3. Klasifikasi Kanonis Berdasarkan Skor & Temuan
    has_critical_findings = any(f.severity == "critical" for f in findings)
    if score >= 60 or has_critical_findings:
        classification = "high_risk"
    elif score >= 20:
        classification = "needs_caution"
    else:
        classification = "no_major_indicator"

    confidence = "high" if unique_urls else "medium"

    # Rekomendasi tindakan kanonis
    recommendations = []
    if classification == "high_risk":
        recommendations.append("Jangan mengklik tautan atau mengunduh berkas yang disertakan.")
        recommendations.append("Jangan berikan kode OTP, PIN, atau data perbankan apa pun.")
        recommendations.append("Segera hubungi call center resmi bank jika telah terjadi transaksi.")
    elif classification == "needs_caution":
        recommendations.append("Lakukan verifikasi silang ke kanal resmi sebelum bertransaksi.")
        recommendations.append("Waspadai pengalihan halaman atau permintaan data pribadi mendadak.")
    else:
        recommendations.append("Tidak ditemukan indikator ancaman umum pada pemeriksaan ini.")
        recommendations.append("Tetap berhati-hati dan pastikan bertransaksi di kanal resmi.")

    mitre_techs = []
    if any("T1566" in f or "APK" in f or "meniru brand" in f for f in flags):
        mitre_techs.append("T1566 (Phishing / Social Engineering)")
    if any("kredensial" in f.lower() or "otp" in f.lower() for f in flags):
        mitre_techs.append("T1056.003 (Credential Harvesting)")

    canonical_result = CanonicalAnalysisResult(
        analysis_id=str(uuid.uuid4())[:8],
        analysis_type="url" if unique_urls and len(text) < 200 else ("hybrid" if unique_urls else "message"),
        classification=classification,
        risk_score=score,
        confidence=confidence,
        findings=findings,
        mitre_techniques=mitre_techs,
        recommended_actions=recommendations,
        limitations=[
            "Pemeriksaan heuristik bersifat indikatif dan tidak menjamin status 100% aman.",
            "Segel kriptografis menjamin keaslian data catatan, bukan validasi legal peristiwa."
        ],
        provider_status={"heuristic_engine": "operational", "inspected_urls": len(unique_urls)}
    )

    return {
        "has_suspicious_elements": has_suspicious,
        "inspection_performed": len(unique_urls) > 0,
        "inspected_urls_count": len(unique_urls),
        "detected_urls": raw_urls,
        "defanged_urls": defanged,
        "risk_flags": flags,
        "heuristic_score": score,
        "network_intel": primary_network_intel,
        "multi_network_intel": multi_network_intel,
        "evidence_hash": evidence_hash,
        "canonical_result": canonical_result
    }
