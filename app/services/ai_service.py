from google import genai
from google.genai import types
from app.config import settings
from app.schemas import Message
from typing import List, Dict, Any

SYSTEM_INSTRUCTION = """
Kamu adalah SecurAI, asisten kecerdasan buatan spesialis Cybersecurity & Incident Triage.
Fokus utamamu adalah membantu pengguna menganalisis pesan, email, atau tautan (URL) yang berpotensi phishing, smishing, malware (.apk), atau social engineering, serta mengedukasi keamanan siber secara umum.

Prinsip Kerja:
1. JIKA PENGGUNA BERTANYA UMUM/KONSEPTUAL: Jawab dengan ramah, jelas, edukatif, dan sertakan contoh taktis.
2. JIKA PENGGUNA MENYERTAKAN TEKS/LINK MENCURIGAKAN:
   - Berikan Ringkasan Bahaya & Tingkat Risiko: [RENDAH / SEDANG / TINGGI].
   - Jelaskan indikator bahaya (rekayasa sosial, manipulasi psikologis, anomali URL).
   - Berikan Rekomendasi Tindakan Darurat (apa yang harus dilakukan jika sudah terlanjur diklik/diisi).
3. Pertahankan gaya komunikasi profesional, berwibawa, namun mudah dipahami pengguna non-teknis.
"""

def generate_chat_response(message: str, history: List[Message], heuristic_data: Dict[str, Any]) -> str:
    if not settings.GEMINI_API_KEY:
        return "⚠️ Konfigurasi API Key belum selesai. Mohon masukkan GEMINI_API_KEY pada file .env backend."

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    # Tambahkan hasil scan heuristik sebagai konteks tambahan bagi model
    context_prefix = ""
    if heuristic_data.get("has_suspicious_elements"):
        context_prefix = (
            f"[SYSTEM HEURISTIC REPORT]\n"
            f"- Heuristic Risk Score: {heuristic_data['heuristic_score']}/100\n"
            f"- Detected URLs: {heuristic_data['detected_urls']}\n"
            f"- Flags: {', '.join(heuristic_data['risk_flags'])}\n"
            f"[END REPORT]\n\n"
        )

    # Bangun riwayat obrolan untuk Gemini SDK
    gemini_contents = []
    for msg in history:
        gemini_contents.append(
            types.Content(
                role="user" if msg.role == "user" else "model",
                parts=[types.Part.from_text(text=msg.content)]
            )
        )

    # Masukkan pesan aktif
    current_prompt = f"{context_prefix}{message}"
    gemini_contents.append(
        types.Content(role="user", parts=[types.Part.from_text(text=current_prompt)])
    )

    try:
        response = client.models.generate_content(
            model=settings.MODEL_NAME,
            contents=gemini_contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.3
            )
        )
        return response.text or "Tidak ada respon dari model AI."
    except Exception as e:
        return f"Terjadi kesalahan saat memproses permintaan AI: {str(e)}"