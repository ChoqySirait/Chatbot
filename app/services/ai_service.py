import base64
from typing import List, Dict, Any, Tuple
from google import genai
from google.genai import types
from app.config import settings
from app.schemas import Message

SYSTEM_INSTRUCTION = """
Kamu adalah SecurAI, asisten dan teman diskusi keamanan siber yang ramah, komunikatif, dan berwawasan luas.

GAYA KOMUNIKASI & INTERAKSI:
1. INTERAKSI AWAL / SAPAAN SANTAI:
   - Jika pengguna menyapa (seperti "halo", "hai", "selamat siang") atau mengajak mengobrol biasa, balaslah dengan sangat ramah, hangat, dan luwes selayaknya teman diskusi/konsultan profesional.
   - Sambut mereka dan tanyakan apa yang ingin didiskusikan hari ini—apakah tentang tips keamanan akun, cerita modus penipuan baru, atau ada tautan/file mencurigakan yang ingin diperiksa bersama.
2. DISKUSI & EDUKASI KONSEPTUAL:
   - Jawab pertanyaan teori atau tips keamanan secara runtut, mudah dipahami orang awam, tidak kaku, dan berikan analogi nyata.
3. KASUS TAUTAN / PESAN MENCURIGAKAN:
   - Jika ada indikasi ancaman, bedah secara objektif:
     a. Tentukan status: [RESMI/AMAN], [ILEGAL (RISIKO MALVERTISING)] (seperti web komik/manhwa yang risikonya dari iklan pop-up), atau [AKTIF BERBAHAYA] (seperti phishing/scam/APK trojan).
     b. Jelaskan kenapa berbahaya dengan bahasa yang jelas.
     c. Berikan langkah mitigasi taktis dan solutif.
     d. Cantumkan taktik MITRE ATT&CK jika relevan.
"""

def process_chat_with_gemini(message: str, history: List[Message], heuristic_data: Dict[str, Any], image_base64: str = None) -> Tuple[str, List[str], str]:
    if not settings.GEMINI_API_KEY:
        return "⚠️ Konfigurasi API Key belum selesai. Mohon masukkan GEMINI_API_KEY di file .env.", [], "Informasi Umum"

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    heuristic_context = ""
    if heuristic_data.get("has_suspicious_elements"):
        heuristic_context = (
            f"[HEURISTIC TELEMETRY]\n"
            f"- Risk Score: {heuristic_data['heuristic_score']}/100\n"
            f"- Defanged URLs: {heuristic_data['defanged_urls']}\n"
            f"- Flags: {'; '.join(heuristic_data['risk_flags'])}\n"
            f"- Web Title: {heuristic_data.get('web_title', 'N/A')}\n"
            f"[END TELEMETRY]\n\n"
        )

    parts = []
    
    # Tangani masukan gambar screenshot (Multimodal) jika ada
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
            parts.append(types.Part.from_text(text="Berikut adalah screenshot halaman web yang perlu diaudit."))
        except Exception:
            pass

    full_user_prompt = f"{heuristic_context}{message}"
    parts.append(types.Part.from_text(text=full_user_prompt))

    # Bangun konteks percakapan
    gemini_contents = []
    for msg in history[-8:]:  # Batasi konteks 8 pesan terakhir
        gemini_contents.append(
            types.Content(
                role="user" if msg.role == "user" else "model",
                parts=[types.Part.from_text(text=msg.content)]
            )
        )
    gemini_contents.append(types.Content(role="user", parts=parts))

    try:
        response = client.models.generate_content(
            model=settings.MODEL_NAME,
            contents=gemini_contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.25
            )
        )
        reply_text = response.text or "Tidak ada balasan dari model AI."
        
        # Ekstraksi otomatis tag MITRE
        mitre_tags = []
        if "T1566.002" in reply_text or "Spearphishing Link" in reply_text:
            mitre_tags.append("MITRE T1566.002 (Phishing Link)")
        if "T1566.001" in reply_text or ".apk" in message.lower():
            mitre_tags.append("MITRE T1566.001 (Malicious File)")
        if "T1056.003" in reply_text or "Credential" in reply_text:
            mitre_tags.append("MITRE T1056.003 (Credential Harvesting)")

        # Tentukan Kategori Ancaman
        category = "Informasi Umum"
        if "AKTIF BERBAHAYA" in reply_text.upper():
            category = "Aktif Berbahaya (Malicious)"
        elif "ILEGAL" in reply_text.upper() or "MALVERTISING" in reply_text.upper():
            category = "Ilegal (Risiko Iklan/Malvertising)"
        elif "RESMI" in reply_text.upper() or "AMAN" in reply_text.upper():
            category = "Resmi/Aman"

        return reply_text, mitre_tags, category
    except Exception as e:
        return f"Terjadi kesalahan saat memproses permintaan AI: {str(e)}", [], "Informasi Umum"