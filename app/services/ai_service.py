import base64
from typing import List, Dict, Any, Tuple
from google import genai
from google.genai import types
from app.config import settings
from app.schemas import Message

SYSTEM_INSTRUCTION = """
Kamu adalah SecurAI, asisten AI cerdas, solutif, dan komunikatif di bidang Cybersecurity & Analisis Insiden.
Gaya bicaramu ramah, cerdas, tidak kaku, berbahasa Indonesia dengan sangat luwes layaknya konsultan siber profesional.

ATURAN INTERAKSI:
1. SAPAAN AWAL / OBROLAN SANTAI (misal: "halo", "hai", "selamat malam", "kamu siapa"):
   - Balaslah dengan hangat dan natural layaknya asisten pintar.
   - Sambut pengguna dan katakan kamu siap membantu mereka berdiskusi tentang keamanan siber, mengulas tips keamanan digital, ataupun menganalisis tautan/pesan mencurigakan.
   - JANGAN membuat laporan insiden palsu untuk sapaan santai.
2. DISKUSI TEORI & EDUKASI KONSEPTUAL:
   - Jawab pertanyaan seputar keamanan siber secara runtut, cerdas, dan sertakan contoh taktis yang mudah dimengerti.
3. JIKA PENGGUNA MEMBERIKAN LINK / PESAN / SCREENSHOT:
   - Kamu akan menerima laporan [TELEMETRI WEB & HEURISTIK] dari sistem.
   - Uraikan dengan jelas:
     a. Status Klasifikasi:
        - [RESMI/AMAN]: Situs terverifikasi institusi resmi.
        - [ILEGAL (RISIKO MALVERTISING)]: Platform komik/manhwa/streaming bajakan. Jelaskan secara objektif bahwa situsnya adalah pembaca gambar (bukan malware perusak data), namun ancamannya ada pada iklan jebakan pihak ketiga (pop-up judol, redirect otomatis). Sarankan memakai adblocker (uBlock Origin) dan jangan klik iklan.
        - [AKTIF BERBAHAYA]: Phishing login bank, penipuan uang/undian palsu, aplikasi APK berbahaya, atau situs judi online.
     b. Rangkuman Konten: Sebutkan judul halaman web atau isi pesan yang berhasil dibaca.
     c. Mitigasi Darurat: Langkah nyata jika pengguna sudah terlanjur mengklik/mengisi data.
     d. Taktik MITRE ATT&CK jika relevan (misal: MITRE T1566.002 Spearphishing Link).
4. JIKA LINK DIBLOKIR BOT (WAF/Cloudflare):
   - Jelaskan bahwa situs tujuan memproteksi diri dari bot otomatis.
   - Arahkan pengguna: "Demi keamanan Anda, silakan coba buka tautan tersebut menggunakan Mode Samaran (Incognito Tab) tanpa login, lalu ambil tangkapan layar (screenshot) dan unggah ke sini agar saya bisa membaca visualnya."
"""

def process_chat_with_gemini(message: str, history: List[Message], heuristic_data: Dict[str, Any], image_base64: str = None) -> Tuple[str, List[str], str]:
    if not settings.GEMINI_API_KEY:
        return "⚠️ API Key belum disetel. Mohon masukkan GEMINI_API_KEY pada file .env.", [], "Informasi Umum"

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    heuristic_context = ""
    if heuristic_data.get("has_suspicious_elements"):
        heuristic_context = (
            f"[TELEMETRI WEB & HEURISTIK]\n"
            f"- Heuristic Score: {heuristic_data['heuristic_score']}/100\n"
            f"- Defanged URLs: {heuristic_data['defanged_urls']}\n"
            f"- Temuan: {'; '.join(heuristic_data['risk_flags'])}\n"
            f"- Web Accessible: {heuristic_data.get('web_accessible')}\n"
            f"- Judul Web: {heuristic_data.get('web_title', 'N/A')}\n"
            f"- Deskripsi Web: {heuristic_data.get('web_desc', 'N/A')}\n"
            f"[AKHIR TELEMETRI]\n\n"
        )

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
            parts.append(types.Part.from_text(text="Berikut screenshot halaman web untuk diaudit."))
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

    # Mekanisme Multi-Model Fallback: coba model terbaik, jika sibuk (503), otomatis coba model berikutnya
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
        except Exception as err:
            # Lanjut mencoba model cadangan berikutnya
            continue

    if not reply_text:
        return (
            "Halo! Layanan AI pusat saat ini sedang mengalami antrean trafik yang sangat tinggi. "
            "Namun mesin pemindai heuristik lokal kami tetap aktif memantau link dan teks yang kamu kirimkan. "
            "Silakan ulangi pesan Anda dalam beberapa saat.",
            [],
            "Informasi Umum"
        )

    # Identifikasi Tag MITRE
    mitre_tags = []
    if "T1566.002" in reply_text or "Spearphishing Link" in reply_text:
        mitre_tags.append("MITRE T1566.002 (Phishing Link)")
    if "T1566.001" in reply_text or ".apk" in message.lower():
        mitre_tags.append("MITRE T1566.001 (Malicious File)")
    if "T1056.003" in reply_text or "Credential" in reply_text:
        mitre_tags.append("MITRE T1056.003 (Credential Harvesting)")

    # Tentukan Kategori
    category = "Informasi Umum"
    if "AKTIF BERBAHAYA" in reply_text.upper():
        category = "Aktif Berbahaya (Malicious)"
    elif "ILEGAL" in reply_text.upper() or "MALVERTISING" in reply_text.upper():
        category = "Ilegal (Risiko Iklan/Malvertising)"
    elif "RESMI" in reply_text.upper() or "AMAN" in reply_text.upper():
        category = "Resmi/Aman"

    return reply_text, mitre_tags, category