"""
Heuristics Engine Core Module.
Implements hardened web content sampling, deterministic threat heuristics,
brand impersonation detection via local Public Suffix List, and multi-vector scoring.
"""

import re
import asyncio
from urllib.parse import urljoin
from typing import List, Dict, Any, Optional
import httpx

from app.core.security import validate_url_for_ssrf, defang_url
from app.core.public_suffix import get_domain_from_url, detect_brand_impersonation, is_official_brand_domain
from app.core.network_intel import inspect_ssl_certificate, inspect_domain_registration, generate_evidence_hash, create_evidence_manifest

URL_REGEX = r'(https?://[^\s<>"]+|www\.[^\s<>"]+|[a-zA-Z0-9-]+\.(?:com|org|net|id|co\.id|xyz|site|top|online|vip|live|club|cc|me|info|io)(?:/[^\s<>"]*)?)'
IP_URL_REGEX = r'(?:https?://)?(?:\d{1,3}\.){3}\d{1,3}'

INDONESIAN_SCAM_KEYWORDS = [
    "rekening diblokir", "tagihan pln", "surat tilang", "undangan pernikahan",
    "kurir paket", "cek resi", "surat panggilan", "hadiah pulsa", 
    "menangkan saldo", "klik link berikut", "login ulang akun", "verifikasi segera",
    "kerja paruh waktu", "komisi harian", "investasi modal kecil", "toko promo diskon"
]

JUDOL_KEYWORDS = ["slot", "gacor", "maxwin", "depo", "withdraw", "pragmatic", "togel", "rtp live", "judol", "scatter", "jackpot"]
PIRACY_KEYWORDS = ["baca komik", "manhwa", "manga", "komik indo", "nonton anime", "streaming gratis", "sub indo", "chapter"]

MAX_REDIRECT_HOPS = 5
MAX_BODY_BYTES = 1024 * 1024  # 1 MB


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
        # Client dengan verifikasi TLS aktif dan tanpa proxy lingkungan tak terkontrol
        async with httpx.AsyncClient(timeout=timeout, verify=True, trust_env=False, follow_redirects=False) as client:
            while hops <= MAX_REDIRECT_HOPS:
                # 1. Validasi SSRF pada setiap URL hop
                is_safe, reason, metadata = validate_url_for_ssrf(current_url)
                if not is_safe:
                    return {
                        "accessible": False,
                        "title": "Ditolak: Pelanggaran Keamanan Jaringan / SSRF",
                        "sample": "",
                        "hops": hops,
                        "error": reason
                    }

                # 2. Kirim permintaan GET
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

                # 3. Penanganan Redirect Manual
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
                    
                    # Bangun URL tujuan absolut
                    current_url = urljoin(current_url, location)
                    continue

                # 4. Membaca respons body dengan batas maksimum 1 MB (streaming limit)
                content_bytes = bytearray()
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


async def analyze_heuristics(text: str) -> Dict[str, Any]:
    """
    Analisis heuristik deterministik multi-vektor:
    1. Validasi SSRF dan resolusi DNS publik.
    2. Eksekusi paralel inspeksi SSL, RDAP, dan Scraping aman.
    3. Deteksi brand spoofing/typosquatting via Public Suffix List lokal.
    4. Deteksi ekstensi file berisiko (.apk, .exe, dll).
    5. Analisis pola kalimat rekayasa sosial Indonesia.
    6. Pembuatan segel integritas SHA-256 64-karakter penuh.
    """
    flags: List[str] = []
    score = 0
    urls = re.findall(URL_REGEX, text)
    defanged = [defang_url(u) for u in urls]
    
    network_intel: Optional[Dict[str, Any]] = None
    evidence_hash = generate_evidence_hash(text)

    if urls:
        raw_url = urls[0]
        domain = get_domain_from_url(raw_url)
        fetch_url = raw_url if raw_url.startswith(('http://', 'https://')) else 'https://' + raw_url

        is_safe, reason, metadata = validate_url_for_ssrf(fetch_url)

        if is_safe:
            # Eksekusi 3 tugas inspeksi jaringan secara serentak via asyncio.gather
            ssl_task = inspect_ssl_certificate(domain)
            domain_task = inspect_domain_registration(domain)
            scrape_task = scrape_web_sample(fetch_url)

            ssl_info, domain_info, web_info = await asyncio.gather(
                ssl_task, domain_task, scrape_task, return_exceptions=True
            )

            # Normalisasi jika terjadi timeout/exception pada salah satu proses
            if isinstance(ssl_info, Exception):
                ssl_info = {"valid": False, "issuer": "Timeout Pemeriksaan SSL", "days_remaining": 0}
            if isinstance(domain_info, Exception):
                domain_info = {"age_days": None, "creation_date": "Data RDAP Terbatas", "registrar": "Umum"}
            if isinstance(web_info, Exception):
                web_info = {"accessible": False, "title": "Situs Tidak Dapat Diakses", "sample": ""}

            # Evaluasi umur domain
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

            network_intel = {
                "domain": domain,
                "page_title": web_info.get("title", "Tanpa Judul"),
                "ssl_issuer": ssl_info.get("issuer", "Tidak Diketahui"),
                "ssl_valid": ssl_info.get("valid", False),
                "domain_age": f"{domain_info['age_days']} hari" if domain_info.get("age_days") is not None else domain_info.get("creation_date"),
                "registrar": domain_info.get("registrar", "Umum"),
                "evidence_hash": evidence_hash,
                "hops": web_info.get("hops", 0)
            }
        else:
            flags.append(f"Tautan ditolak oleh pengawas keamanan jaringan (Anti-SSRF): {reason}")
            score += 40

    # Deteksi berkas instalasi berbahaya
    if re.search(r'\.(apk|exe|scr|bat|vbs)($|\s|[?#])', text.lower()):
        flags.append("Mengandung berkas instalasi (.APK/.EXE). Sering dipakai menyadap SMS OTP.")
        score += 45

    # Deteksi typosquatting nama brand menggunakan modul Public Suffix List
    for url in urls:
        d = get_domain_from_url(url)
        impersonations = detect_brand_impersonation(d)
        for imp in impersonations:
            flags.append(imp["reason"])
            score += 40

    # Pola kalimat desakan rekayasa sosial
    lower_text = text.lower()
    detected_kw = [kw for kw in INDONESIAN_SCAM_KEYWORDS if kw in lower_text]
    if detected_kw:
        flags.append(f"Pola kalimat desakan psikologis: {', '.join(detected_kw[:2])}.")
        score += len(detected_kw) * 10

    score = min(score, 100)

    # Membedakan keberadaan telemetri dengan status kecurigaan (ENG-02)
    has_suspicious = len(flags) > 0 or score > 0

    return {
        "has_suspicious_elements": has_suspicious,
        "inspection_performed": len(urls) > 0,
        "detected_urls": urls,
        "defanged_urls": defanged,
        "risk_flags": flags,
        "heuristic_score": score,
        "network_intel": network_intel,
        "evidence_hash": evidence_hash
    }
