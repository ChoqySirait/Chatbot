import re
from typing import List, Dict, Any

URL_REGEX = r'(https?://[^\s<>"]+|www\.[^\s<>"]+)'
IP_URL_REGEX = r'https?://(?:\d{1,3}\.){3}\d{1,3}'

INDONESIAN_SCAM_KEYWORDS = [
    "rekening diblokir", "tagihan pln", "surat tilang", "undangan pernikahan",
    "kurir paket", "cek resi", "surat panggilan", "hadiah pulsa", 
    "menangkan saldo", "klik link berikut", "login ulang akun", "verifikasi segera"
]

TARGET_BRANDS = ["bca", "bri", "bni", "mandiri", "dana", "gopay", "ovo", "shopee", "tokopedia"]

def analyze_heuristics(text: str) -> Dict[str, Any]:
    flags: List[str] = []
    score = 0
    
    # 1. Ekstraksi URL
    urls = re.findall(URL_REGEX, text)
    
    # 2. Deteksi URL berbasis IP mentah (Indikator kuat phishing)
    if re.search(IP_URL_REGEX, text):
        flags.append("Tautan menggunakan alamat IP mentah tanpa nama domain resmi.")
        score += 35

    # 3. Deteksi Ekstensi Berbahaya (Modus APK penipuan Indonesia)
    if re.search(r'\.(apk|exe|scr|bat|vbs)($|\s|[?#])', text.lower()):
        flags.append("Terdeteksi file executable/instalasi aplikasi (.APK/.EXE) yang berpotensi Trojan.")
        score += 40

    # 4. Deteksi Typosquatting / Impersonasi Brand Lokal
    lower_text = text.lower()
    for brand in TARGET_BRANDS:
        for url in urls:
            url_lower = url.lower()
            if brand in url_lower and not (f".{brand}.co.id" in url_lower or f".{brand}.com" in url_lower):
                flags.append(f"Domain mencurigakan meniru brand resmi '{brand.upper()}'.")
                score += 30
                break

    # 5. Deteksi Kata Kunci Manipulasi Psikologis (Urgensi / Ketakutan)
    detected_keywords = [kw for kw in INDONESIAN_SCAM_KEYWORDS if kw in lower_text]
    if detected_keywords:
        flags.append(f"Pemicu urgensi/rekayasa sosial terdeteksi: {', '.join(detected_keywords[:3])}.")
        score += len(detected_keywords) * 10

    score = min(score, 100)

    return {
        "has_suspicious_elements": len(flags) > 0 or len(urls) > 0,
        "detected_urls": urls,
        "risk_flags": flags,
        "heuristic_score": score
    }