import re
import asyncio
import httpx
from typing import List, Dict, Any
from app.core.security import is_safe_public_url, defang_url
from app.core.network_intel import get_domain_from_url, inspect_ssl_certificate, inspect_domain_registration, generate_evidence_hash

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
TARGET_BRANDS = ["shopee", "tokopedia", "bca", "bri", "bni", "mandiri", "dana", "gopay", "ovo", "whatsapp", "blibli"]

# Blok kode asinkron untuk mengambil sampel halaman web
async def scrape_web_sample(url: str) -> Dict[str, Any]:
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SecurAI-ConsumerGuard/2.5"}
    try:
        async with httpx.AsyncClient(timeout=1.8, follow_redirects=True, verify=False) as client:
            resp = await client.get(url, headers=headers)
            sample = resp.text[:5000].lower()
            title_match = re.search(r'<title[^>]*>(.*?)</title>', resp.text[:5000], re.IGNORECASE | re.DOTALL)
            page_title = title_match.group(1).strip() if title_match else "Tanpa Judul"
            return {"accessible": True, "title": page_title[:100], "sample": sample}
    except Exception:
        return {"accessible": False, "title": "Dilindungi Cloudflare/WAF", "sample": ""}

# Blok kode utama: mengeksekusi inspeksi SSL, RDAP, dan Web Scrape serentak (paralel)
async def analyze_heuristics(text: str) -> Dict[str, Any]:
    flags: List[str] = []
    score = 0
    urls = re.findall(URL_REGEX, text)
    defanged = [defang_url(u) for u in urls]
    
    network_intel = None
    evidence_hash = generate_evidence_hash(text)

    if urls:
        raw_url = urls[0]
        domain = get_domain_from_url(raw_url)
        fetch_url = raw_url if raw_url.startswith(('http://', 'https://')) else 'https://' + raw_url

        if is_safe_public_url(fetch_url):
            # Eksekusi 3 tugas jaringan secara serentak via asyncio.gather
            ssl_task = inspect_ssl_certificate(domain)
            domain_task = inspect_domain_registration(domain)
            scrape_task = scrape_web_sample(fetch_url)

            ssl_info, domain_info, web_info = await asyncio.gather(
                ssl_task, domain_task, scrape_task, return_exceptions=True
            )

            # Normalisasi jika terjadi timeout/exception pada salah satu proses
            if isinstance(ssl_info, Exception):
                ssl_info = {"valid": False, "issuer": "Timeout Pemeriksaan", "days_remaining": 0}
            if isinstance(domain_info, Exception):
                domain_info = {"age_days": None, "creation_date": "Data RDAP Terbatas", "registrar": "Umum"}
            if isinstance(web_info, Exception):
                web_info = {"accessible": False, "title": "Protected/Timeout", "sample": ""}

            # Evaluasi temuan umur domain
            if domain_info.get("age_days") is not None:
                if domain_info["age_days"] < 30:
                    flags.append(f"Domain sangat baru ({domain_info['age_days']} hari). Taktik khas situs penipuan sementara!")
                    score += 45
                elif domain_info["age_days"] < 90:
                    flags.append(f"Domain baru dibuat ({domain_info['age_days']} hari lalu). Wajib waspada.")
                    score += 20

            if not ssl_info.get("valid"):
                flags.append("Situs tidak memakai enkripsi SSL yang valid. Berbahaya untuk transaksi.")
                score += 25

            sample = web_info.get("sample", "")
            if any(k in sample for k in JUDOL_KEYWORDS):
                flags.append("Halaman teridentifikasi memuat transaksi atau permainan judi online.")
                score += 50
            if any(k in sample for k in PIRACY_KEYWORDS):
                flags.append("Situs platform komik/media tidak resmi (Risiko utama: Iklan pop-up pihak ketiga).")
                score += 20

            network_intel = {
                "domain": domain,
                "page_title": web_info.get("title", "Tanpa Judul"),
                "ssl_issuer": ssl_info.get("issuer", "Tidak Diketahui"),
                "ssl_valid": ssl_info.get("valid", False),
                "domain_age": f"{domain_info['age_days']} hari" if domain_info.get("age_days") is not None else domain_info.get("creation_date"),
                "registrar": domain_info.get("registrar", "Umum"),
                "evidence_hash": evidence_hash
            }
        else:
            flags.append("Tautan menggunakan IP privat/lokal yang tidak aman untuk dibuka publik.")
            score += 35

    # Deteksi berkas instalasi trojan
    if re.search(r'\.(apk|exe|scr|bat|vbs)($|\s|[?#])', text.lower()):
        flags.append("Mengandung berkas instalasi (.APK/.EXE). Sering dipakai menyadap SMS OTP.")
        score += 45

    # Deteksi typosquatting nama brand
    lower_text = text.lower()
    for brand in TARGET_BRANDS:
        for url in urls:
            u_lower = url.lower()
            if brand in u_lower and not (f".{brand}.co.id" in u_lower or f".{brand}.com" in u_lower):
                flags.append(f"Domain bukan kanal resmi, meniru brand '{brand.upper()}'.")
                score += 35
                break

    detected_kw = [kw for kw in INDONESIAN_SCAM_KEYWORDS if kw in lower_text]
    if detected_kw:
        flags.append(f"Pola kalimat desakan psikologis: {', '.join(detected_kw[:2])}.")
        score += len(detected_kw) * 10

    score = min(score, 100)

    return {
        "has_suspicious_elements": len(flags) > 0 or len(urls) > 0,
        "detected_urls": urls,
        "defanged_urls": defanged,
        "risk_flags": flags,
        "heuristic_score": score,
        "network_intel": network_intel,
        "evidence_hash": evidence_hash
    }