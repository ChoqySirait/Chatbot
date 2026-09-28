import base64
from typing import List, Dict, Any, Tuple
from google import genai
from google.genai import types
from app.config import settings
from app.schemas import Message

SYSTEM_INSTRUCTION = """
Kamu adalah SecurAI, asisten AI ramah, solutif, dan profesional untuk Perlindungan Konsumen Digital & Investigasi Anti-Fraud (Penipuan Online).

PANDUAN INTERAKSI:
1. SAPAAN & DISKUSI UMUM:
   - Jika pengguna menyapa ("halo", "siang", "kamu siapa"), tanggapi dengan sangat hangat, ramah, dan manusiawi.
   - Sampaikan bahwa kamu siap mendampingi mereka: mulai dari mengulas keamanan belanja online, tips menghindari investasi/pinjol bodong, memeriksa link toko/promo mencurigakan, hingga memandu langkah pemulihan jika menjadi korban penipuan.
2. JIKA PENGGUNA MEMBERI TAUTAN (LINK):
   - Kamu akan menerima [DATA FORENSIK JARINGAN & HEURISTIK] (umur domain, status SSL, judul situs).
   - Buat analisis berimbang:
     a. Status: [RESMI/AMAN], [ILEGAL (RISIKO MALVERTISING)] (seperti platform komik/streaming non-resmi yang risikonya berasal dari pop-up iklan, bukan platformnya), atau [AKTIF BERBAHAYA/PENIPUAN].
     b. Jelaskan temuan data nyata (misal: "Domain ini baru terdaftar beberapa hari lalu, yang merupakan ciri umum toko online palsu").
     c. Berikan panduan konsumen konkret.
3. JIKA PENGGUNA SUDAH MENJADI KORBAN PENIPUAN (Transfer Uang / Saldo Berkurang):
   - Berikan empati dan ketenangan terlebih dahulu.
   - Instruksikan langkah darurat golden hour:
     1. Hubungi call center bank asal & bank tujuan penipu untuk meminta pemblokiran rekening tujuan (Hold Dana).
     2. Buat Laporan Polisi (Surat Tanda Penerimaan Laporan / STPL) untuk syarat investigasi bank.
     3. Laporkan nomor rekening penipu ke portal resmi Komdigi di CekRekening.id dan Patrolisiber.id.
"""

def process_chat_with_gemini(message: str, history: List[Message], heuristic_data: Dict[str, Any], image_base64: str = None) -> Tuple[str, List[str], str]:
    if not settings.GEMINI_API_KEY:
        return "⚠️ API Key belum disetel. Mohon masukkan GEMINI_API_KEY pada file .env.", [], "Informasi Umum"

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    heuristic_context = ""
    net = heuristic_data.get("network_intel")
    if heuristic_data.get("has_suspicious_elements") or net:
        heuristic_context = (
            f"[DATA FORENSIK JARINGAN & HEURISTIK]\n"
            f"- Skor Risiko: {heuristic_data['heuristic_score']}/100\n"
            f"- URLs (Defanged): {heuristic_data['defanged_urls']}\n"
            f"- Indikator: {'; '.join(heuristic_data['risk_flags'])}\n"
        )
        if net:
            heuristic_context += (
                f"- Domain: {net.get('domain')}\n"
                f"- Umur Domain: {net.get('domain_age')}\n"
                f"- Penerbit SSL: {net.get('ssl_issuer')}\n"
                f"- Judul Halaman: {net.get('page_title')}\n"
            )
        heuristic_context += "[AKHIR DATA FORENSIK]\n\n"

    parts = []
    if image_base64:
        try:
            if "," in image_base64:
                header, encoded = image_base64.split(",", 1)
                mime = header.split(";")[0].split(":")[1]
            else:
                encoded = image_base64
                mime = "image/png"
            image_bytes = base64.b64decode(encoded)
            parts.append(types.Part.from_bytes(data=image_bytes, mime_type=mime))
            parts.append(types.Part.from_text(text="Berikut bukti tangkapan layar untuk diperiksa."))
        except Exception:
            pass

    full_user_prompt = f"{heuristic_context}{message}"
    parts.append(types.Part.from_text(text=full_user_prompt))

    gemini_contents = []
    for msg in history[-6:]:
        gemini_contents.append(
            types.Content(
                role="user" if msg.role == "user" else "model",
                parts=[types.Part.from_text(text=msg.content)]
            )
        )
    gemini_contents.append(types.Content(role="user", parts=parts))

    reply_text = None
    for model_name in settings.FALLBACK_MODELS:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=gemini_contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    temperature=0.3
                )
            )
            if response and response.text:
                reply_text = response.text
                break
        except Exception:
            continue

    if not reply_text:
        return (
            "Halo! Layanan AI pusat saat ini sedang padat. Namun modul pemindaian domain & heuristik anti-fraud kami tetap aktif bekerja. Silakan tanyakan kembali dalam beberapa saat.",
            [],
            "Informasi Umum"
        )

    mitre_tags = []
    if "T1566.002" in reply_text or "Link" in reply_text:
        mitre_tags.append("MITRE T1566.002 (Phishing Link)")
    if "T1566.001" in reply_text or ".apk" in message.lower():
        mitre_tags.append("MITRE T1566.001 (Malicious File)")
    if "T1056.003" in reply_text or "Credential" in reply_text:
        mitre_tags.append("MITRE T1056.003 (Credential Harvesting)")

    category = "Informasi Umum"
    if "AKTIF BERBAHAYA" in reply_text.upper() or "PENIPUAN" in reply_text.upper():
        category = "Aktif Berbahaya (Malicious)"
    elif "ILEGAL" in reply_text.upper() or "MALVERTISING" in reply_text.upper():
        category = "Ilegal (Risiko Iklan/Malvertising)"
    elif "RESMI" in reply_text.upper() or "AMAN" in reply_text.upper():
        category = "Resmi/Aman"

    return reply_text, mitre_tags, category