import re
import httpx
from typing import List, Dict, Any
from app.core.security import is_safe_public_url, defang_url

URL_REGEX = r'(https?://[^\s<>"]+|www\.[^\s<>"]+)'
IP_URL_REGEX = r'https?://(?:\d{1,3}\.){3}\d{1,3}'

INDONESIAN_SCAM_KEYWORDS = [
    "rekening diblokir", "tagihan pln", "surat tilang", "undangan pernikahan",
    "kurir paket", "cek resi", "surat panggilan", "hadiah pulsa", 
    "menangkan saldo", "klik link berikut", "login ulang akun", "verifikasi segera"
]

JUDOL_KEYWORDS = ["slot", "gacor", "maxwin", "depo pulsa", "scatter", "pragmatic", "togel", "rtp live", "judol"]
PIRACY_KEYWORDS = ["baca komik", "manhwa", "manga", "komik indo", "nonton anime", "streaming gratis", "sub indo"]
TARGET_BRANDS = ["bca", "bri", "bni", "mandiri", "dana", "gopay", "ovo", "shopee", "tokopedia"]

def fetch_url_metadata(url: str) -> Dict[str, Any]:
    """Mengambil metadata URL dengan proteksi SSRF dan batas waktu singkat."""
    if not is_safe_public_url(url):
        return {"accessible": False, "title": "Akses Ditolak (Alamat Internal/Privat)", "content_sample": "", "blocked": True}

    if not url.startswith(('http://', 'https://')):
        url = 'http://' + url

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SecurAI-InspectionBot/1.0"}
    try:
        with httpx.Client(timeout=3.0, follow_redirects=True, verify=False) as client:
            resp = client.get(url, headers=headers)
            final_url = str(resp.url)
            text_sample = resp.text[:4000]
            
            title_match = re.search(r'<title>(.*?)</title>', text_sample, re.IGNORECASE | re.DOTALL)
            title = title_match.group(1).strip() if title_match else "Tanpa Judul"
            
            return {
                "accessible": True,
                "status_code": resp.status_code,
                "final_url": final_url,
                "title": title[:100],
                "content_sample": text_sample.lower(),
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
            flags.append("Situs tujuan memblokir scanning otomatis (Cloudflare/WAF/Timeout).")
        elif web_meta["accessible"]:
            sample = web_meta["content_sample"]
            if any(k in sample for k in JUDOL_KEYWORDS):
                flags.append("Konten situs memuat elemen kuat situs perjudian online / scam.")
                score += 50
            if any(k in sample for k in PIRACY_KEYWORDS):
                flags.append("Situs terdeteksi platform media komik/streaming tidak resmi (Risiko Malvertising).")
                score += 20

    if re.search(IP_URL_REGEX, text):
        flags.append("Tautan menggunakan alamat IP mentah tanpa domain terverifikasi.")
        score += 35

    if re.search(r'\.(apk|exe|scr|bat|vbs)($|\s|[?#])', text.lower()):
        flags.append("Terdeteksi berkas installer (.APK/.EXE) berpotensi spyware/trojan.")
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
        flags.append(f"Pemicu rekayasa sosial ditemukan: {', '.join(detected_keywords[:3])}.")
        score += len(detected_keywords) * 10

    score = min(score, 100)

    return {
        "has_suspicious_elements": len(flags) > 0 or len(urls) > 0,
        "detected_urls": urls,
        "defanged_urls": defanged,
        "risk_flags": flags,
        "heuristic_score": score,
        "web_accessible": web_meta["accessible"] if web_meta else None,
        "web_title": web_meta.get("title") if web_meta else None
    }