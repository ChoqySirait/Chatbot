import re
import httpx
from typing import List, Dict, Any
from app.core.security import is_safe_public_url, defang_url
from app.core.network_intel import get_domain_from_url, inspect_ssl_certificate, inspect_domain_registration

URL_REGEX = r'(https?://[^\s<>"]+|www\.[^\s<>"]+|[a-zA-Z0-9-]+\.(?:com|org|net|id|co\.id|xyz|site|top|online|vip|live|club|cc|me|info|io)(?:/[^\s<>"]*)?)'
IP_URL_REGEX = r'(?:https?://)?(?:\d{1,3}\.){3}\d{1,3}'

INDONESIAN_SCAM_KEYWORDS = [
    "rekening diblokir", "tagihan pln", "surat tilang", "undangan pernikahan",
    "kurir paket", "cek resi", "surat panggilan", "hadiah pulsa", 
    "menangkan saldo", "klik link berikut", "login ulang akun", "verifikasi segera",
    "kerja paruh waktu", "komisi harian", "investasi modal kecil"
]

JUDOL_KEYWORDS = ["slot", "gacor", "maxwin", "depo", "withdraw", "pragmatic", "togel", "rtp live", "judol", "scatter", "jackpot"]
PIRACY_KEYWORDS = ["baca komik", "manhwa", "manga", "komik indo", "nonton anime", "streaming gratis", "sub indo", "chapter"]
TARGET_BRANDS = ["bca", "bri", "bni", "mandiri", "dana", "gopay", "ovo", "shopee", "tokopedia", "bukalapak"]

def analyze_heuristics(text: str) -> Dict[str, Any]:
    flags: List[str] = []
    score = 0
    urls = re.findall(URL_REGEX, text)
    defanged = [defang_url(u) for u in urls]
    
    network_intel = None

    if urls:
        raw_url = urls[0]
        domain = get_domain_from_url(raw_url)
        fetch_url = raw_url if raw_url.startswith(('http://', 'https://')) else 'https://' + raw_url

        if is_safe_public_url(fetch_url):
            # 1. Jalankan Inspeksi Jaringan Nyata (SSL & RDAP)
            ssl_info = inspect_ssl_certificate(domain)
            domain_info = inspect_domain_registration(domain)

            # Analisis Domain Baru (Modus penipuan sering menggunakan domain baru < 30 hari)
            if domain_info["age_days"] is not None:
                if domain_info["age_days"] < 30:
                    flags.append(f"Domain sangat baru ({domain_info['age_days']} hari lalu). Indikasi tinggi modus penipuan musiman!")
                    score += 45
                elif domain_info["age_days"] < 90:
                    flags.append(f"Domain baru dibuat ({domain_info['age_days']} hari lalu). Perlu kewaspadaan ekstra.")
                    score += 20

            if not ssl_info["valid"]:
                flags.append("Tautan tidak memiliki sertifikat SSL yang valid (Koneksi Tidak Terenkripsi).")
                score += 25

            # 2. Live HTTP Scraper
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SecurAI-ConsumerGuard/2.0"}
            try:
                with httpx.Client(timeout=3.5, follow_redirects=True, verify=False) as client:
                    resp = client.get(fetch_url, headers=headers)
                    sample = resp.text[:5000].lower()
                    
                    title_match = re.search(r'<title[^>]*>(.*?)</title>', resp.text[:5000], re.IGNORECASE | re.DOTALL)
                    page_title = title_match.group(1).strip() if title_match else "Tanpa Judul"

                    if any(k in sample for k in JUDOL_KEYWORDS):
                        flags.append("Konten situs memuat transaksi/istilah perjudian online (Judol).")
                        score += 50
                    if any(k in sample for k in PIRACY_KEYWORDS):
                        flags.append("Platform media komik/streaming tidak resmi (Risiko utama: Iklan Malvertising).")
                        score += 20

                    network_intel = {
                        "domain": domain,
                        "page_title": page_title[:100],
                        "ssl_issuer": ssl_info["issuer"],
                        "ssl_valid": ssl_info["valid"],
                        "domain_age": f"{domain_info['age_days']} hari" if domain_info["age_days"] is not None else domain_info["creation_date"],
                        "registrar": domain_info["registrar"],
                        "status_code": resp.status_code
                    }
            except Exception:
                flags.append("Situs memblokir bot otomatis (WAF/Cloudflare Protected).")
                network_intel = {
                    "domain": domain,
                    "page_title": "Dilindungi Cloudflare/WAF",
                    "ssl_issuer": ssl_info["issuer"],
                    "ssl_valid": ssl_info["valid"],
                    "domain_age": domain_info["creation_date"],
                    "registrar": domain_info["registrar"],
                    "status_code": "Blocked/Timeout"
                }
        else:
            flags.append("Tautan mengarah ke IP Internal/Lokal jaringan rumah (Ditolak demi keamanan).")
            score += 35

    # Cek APK Trojan
    if re.search(r'\.(apk|exe|scr|bat|vbs)($|\s|[?#])', text.lower()):
        flags.append("Mengandung file aplikasi instalasi (.APK/.EXE) yang sering dipakai membajak SMS/OTP.")
        score += 45

    # Cek Typosquatting Brand Indonesia
    lower_text = text.lower()
    for brand in TARGET_BRANDS:
        for url in urls:
            u_lower = url.lower()
            if brand in u_lower and not (f".{brand}.co.id" in u_lower or f".{brand}.com" in u_lower):
                flags.append(f"Domain mencurigakan meniru brand resmi '{brand.upper()}'.")
                score += 30
                break

    # Pemicu Penipuan Sosial
    detected_kw = [kw for kw in INDONESIAN_SCAM_KEYWORDS if kw in lower_text]
    if detected_kw:
        flags.append(f"Taktik rekayasa sosial/urgensi: {', '.join(detected_kw[:2])}.")
        score += len(detected_kw) * 10

    score = min(score, 100)

    return {
        "has_suspicious_elements": len(flags) > 0 or len(urls) > 0,
        "detected_urls": urls,
        "defanged_urls": defanged,
        "risk_flags": flags,
        "heuristic_score": score,
        "network_intel": network_intel
    }