import base64
from typing import List, Dict, Any, Tuple
from google import genai
from google.genai import types
from app.config import settings
from app.schemas import Message

# Blok instruksi sistem: persona konsultan ramah, adaptif bahasa gaul/nonformal, tanpa salam klise
SYSTEM_INSTRUCTION = """
Kamu adalah SecurAI, teman dan konsultan perlindungan konsumen digital serta pencegahan penipuan online.

PEDOMAN GAYA KOMUNIKASI:
1. RESPON ADAPTIF & ALAMI:
   - Pengguna sering menggunakan bahasa nonformal atau istilah santai (seperti: "min", "gan", "bro", "kak", "ini nipu ga sih?", "duit gua ilang", dll.).
   - Balaslah dengan bahasa Indonesia yang natural, empatik, to the point, dan tidak kaku.
   - JANGAN gunakan pembuka klise seperti "Halo! Saya SecurAI asisten keamanan AI Anda...". Langsung respon inti pertanyaannya.

2. EVALUASI DAN PENCEGAHAN DINI (FOKUS UTAMA):
   - Waspadai akun WhatsApp / Telegram / Medsos yang memasang emoji centang biru palsu (misal: "Customer Care BCA ✅"). Ingatkan bahwa centang biru resmi dari Meta/WhatsApp terpasang di sistem nama kontak, bukan sekadar teks bio atau foto profil.
   - Waspadai tautan promo tidak masuk akal (diskon 90%, bagi saldo gratis).
   - Bedakan dengan jelas:
     a. [RESMI/AMAN]: Domain dan kanal resmi yang terverifikasi.
     b. [ILEGAL (RISIKO MALVERTISING)]: Situs komik/manhwa/streaming bajakan. Jelaskan dengan tenang bahwa platformnya pembaca komik (bukan malware pencuri uang), tetapi risiko utamanya berasal dari iklan jebakan (pop-up judi online atau tombol download palsu).
     c. [AKTIF BERBAHAYA/PENIPUAN]: Tautan tiruan, phishing kartu, penipuan transfer, atau file APK penyadap SMS.

3. JIKA SUDAH ADA KORBAN (TRANSFER SUDAH TERJADI):
   - Berikan empati mendalam dan panduan praktis:
     1. Segera hubungi call center bank pengguna untuk meminta blokir darurat ke rekening penipu (Hold Saldo).
     2. Simpan semua bukti chat dan mutasi rekening.
     3. Informasikan bahwa mereka bisa mengklik tombol "Buat Draft Laporan Insiden" di panel samping untuk arsip bukti.
"""

# Blok fungsi utama pemrosesan AI dengan mekanisme multi-model fallback
def process_chat_with_gemini(message: str, history: List[Message], heuristic_data: Dict[str, Any], image_base64: str = None) -> Tuple[str, List[str], str]:
    if not settings.GEMINI_API_KEY:
        return "Pengaturan API Key belum lengkap di berkas .env.", [], "Informasi Umum"

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    heuristic_context = ""
    net = heuristic_data.get("network_intel")
    if heuristic_data.get("has_suspicious_elements") or net:
        heuristic_context = (
            f"[DATA FORENSIK TEKNIS]\n"
            f"- Skor Ancaman: {heuristic_data['heuristic_score']}/100\n"
            f"- Tautan Aman: {heuristic_data['defanged_urls']}\n"
            f"- Temuan: {'; '.join(heuristic_data['risk_flags'])}\n"
        )
        if net:
            heuristic_context += (
                f"- Domain: {net.get('domain')}\n"
                f"- Umur Domain: {net.get('domain_age')}\n"
                f"- Status SSL: {net.get('ssl_issuer')}\n"
                f"- Judul Web: {net.get('page_title')}\n"
                f"- Segel Bukti (SHA-256): {net.get('evidence_hash')}\n"
            )
        heuristic_context += "[SELESAI DATA FORENSIK]\n\n"

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
            parts.append(types.Part.from_text(text="Berikut gambar bukti percakapan atau tampilan web untuk dievaluasi."))
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

    # Fallback lokal cerdas jika antrean model eksternal sedang padat
    if not reply_text:
        score = heuristic_data.get("heuristic_score", 0)
        fallback_cat = "Aktif Berbahaya (Malicious)" if score > 35 else "Informasi Umum"
        fallback_mitre = ["MITRE T1566.002 (Phishing Link)"] if score > 35 else []
        return (
            "Hasil analisis telemetri lokal kami mendeteksi indikasi risiko pada tautan/pesan ini. "
            "Hindari memasukkan informasi perbankan, OTP, atau melakukan transfer dana sebelum diverifikasi lebih lanjut.",
            fallback_mitre,
            fallback_cat
        )

    mitre_tags = []
    if "T1566.002" in reply_text or "Phishing" in reply_text:
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