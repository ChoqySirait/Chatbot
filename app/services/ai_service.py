import base64
from typing import List, Dict, Any, Tuple
from google import genai
from google.genai import types
from app.config import settings
from app.schemas import Message

SYSTEM_INSTRUCTION = """
Kamu adalah SecurAI, asisten analisis keamanan siber untuk SOC L1 Triage & Threat Intelligence.
Kamu memiliki keahlian membedakan ancaman secara objektif dan bernalar tinggi.

KLASIFIKASI ANCAMAN (PILIH SALAH SATU DI AKHIR ANALISIS):
1. [RESMI/AMAN]: Domain resmi terverifikasi.
2. [ILEGAL (RISIKO MALVERTISING)]: Platform bajakan/non-resmi (misal: baca komik/manhwa, streaming gratis). BUKAN malware perusak, namun pengguna rentan terkena iklan pihak ketiga (malvertising) seperti pop-up judol atau tombol download palsu. Sarankan adblocker dan ingatkan jangan klik iklan.
3. [AKTIF BERBAHAYA]: Phishing kredensial, form pencurian OTP/PIN, APK trojan, atau penipuan finansial langsung.
4. [INFORMASI UMUM]: Pertanyaan teori/konseptual.

ATURAN MULTIMODAL & WEB BLOCKED:
Jika pengguna mengirim screenshot situs yang tidak bisa diakses, periksa tata letak visual: apakah ada form login mencurigakan, banner judol, atau peniruan instansi resmi.

TAGGING MITRE ATT&CK:
Sertakan tag taktik yang relevan jika ada ancaman (misal: MITRE T1566.002 Spearphishing Link, MITRE T1566.001 Spearphishing Attachment, MITRE T1056.003 Credential Harvesting).
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