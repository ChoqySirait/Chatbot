import re
import httpx
from typing import List, Dict, Any
from app.core.security import is_safe_public_url, defang_url

# Regex fleksibel untuk menangkap URL lengkap maupun domain (mis: slot88.xyz, komikcast.me)
URL_REGEX = r'(https?://[^\s<>"]+|www\.[^\s<>"]+|[a-zA-Z0-9-]+\.(?:com|org|net|id|co\.id|xyz|site|top|online|vip|live|club|cc|me|info|io)(?:/[^\s<>"]*)?)'
IP_URL_REGEX = r'(?:https?://)?(?:\d{1,3}\.){3}\d{1,3}'

INDONESIAN_SCAM_KEYWORDS = [
    "rekening diblokir", "tagihan pln", "surat tilang", "undangan pernikahan",
    "kurir paket", "cek resi", "surat panggilan", "hadiah pulsa", 
    "menangkan saldo", "klik link berikut", "login ulang akun", "verifikasi segera"
]

JUDOL_KEYWORDS = ["slot", "gacor", "maxwin", "depo", "withdraw", "pragmatic", "togel", "rtp live", "judol", "scatter", "jackpot"]
PIRACY_KEYWORDS = ["baca komik", "manhwa", "manga", "komik indo", "nonton anime", "streaming gratis", "sub indo", "chapter"]
TARGET_BRANDS = ["bca", "bri", "bni", "mandiri", "dana", "gopay", "ovo", "shopee", "tokopedia"]

def fetch_url_metadata(url: str) -> Dict[str, Any]:
    """Menginspeksi web secara langsung dengan browser headers dan proteksi SSRF."""
    fetch_url = url if url.startswith(('http://', 'https://')) else 'https://' + url

    if not is_safe_public_url(fetch_url):
        return {"accessible": False, "title": "Akses Ditolak (Internal/Localhost IP)", "content_sample": "", "blocked": True}

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8"
    }

    try:
        with httpx.Client(timeout=3.5, follow_redirects=True, verify=False) as client:
            resp = client.get(fetch_url, headers=headers)
            sample = resp.text[:5000]
            
            title_match = re.search(r'<title[^>]*>(.*?)</title>', sample, re.IGNORECASE | re.DOTALL)
            title = title_match.group(1).strip() if title_match else "Tanpa Judul"
            title = re.sub(r'\s+', ' ', title)

            desc_match = re.search(r'<meta[^>]*name=["\']description["\'][^>]*content=["\'](.*?)["\']', sample, re.IGNORECASE)
            desc = desc_match.group(1).strip() if desc_match else ""

            return {
                "accessible": True,
                "status_code": resp.status_code,
                "final_url": str(resp.url),
                "title": title[:120],
                "description": desc[:200],
                "content_sample": sample.lower(),
                "blocked": False
            }
    except Exception:
        return {"accessible": False, "title": "", "content_sample": "", "blocked": True}

def analyze_heuristics(text: str) -> Dict[str, Any]:
    flags: List[str] = []
    score = 0
    urls = re.findall(URL_REGEX, text)
    defanged = [defang_url(u) for u in urls]
    
    web_meta = None
    if urls:
        web_meta = fetch_url_metadata(urls[0])
        if web_meta["blocked"]:
            flags.append("Situs tujuan memblokir crawling bot otomatis (Proteksi WAF / Cloudflare / Timeout).")
        elif web_meta["accessible"]:
            sample = web_meta["content_sample"]
            if any(k in sample for k in JUDOL_KEYWORDS):
                flags.append("Konten situs memuat unsur perjudian online / taruhan uang (Judol).")
                score += 50
            if any(k in sample for k in PIRACY_KEYWORDS):
                flags.append("Situs terdeteksi platform baca komik/streaming tidak resmi (Risiko Malvertising).")
                score += 20

    if re.search(IP_URL_REGEX, text):
        flags.append("Tautan menggunakan alamat IP numerik tanpa nama domain resmi.")
        score += 35

    if re.search(r'\.(apk|exe|scr|bat|vbs)($|\s|[?#])', text.lower()):
        flags.append("Terdeteksi berkas executable/installer (.APK/.EXE) yang berisiko trojan.")
        score += 40

    lower_text = text.lower()
    for brand in TARGET_BRANDS:
        for url in urls:
            url_lower = url.lower()
            if brand in url_lower and not (f".{brand}.co.id" in url_lower or f".{brand}.com" in url_lower):
                flags.append(f"Domain mencurigakan meniru brand resmi '{brand.upper()}'.")
                score += 30
                break

    detected_keywords = [kw for kw in INDONESIAN_SCAM_KEYWORDS if kw in lower_text]
    if detected_keywords:
        flags.append(f"Indikator manipulasi psikologis: {', '.join(detected_keywords[:3])}.")
        score += len(detected_keywords) * 10

    score = min(score, 100)

    return {
        "has_suspicious_elements": len(flags) > 0 or len(urls) > 0,
        "detected_urls": urls,
        "defanged_urls": defanged,
        "risk_flags": flags,
        "heuristic_score": score,
        "web_accessible": web_meta["accessible"] if web_meta else None,
        "web_title": web_meta.get("title") if web_meta else None,
        "web_desc": web_meta.get("description") if web_meta else None
    }