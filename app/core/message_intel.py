"""
Message Intelligence Module.
Detects social engineering indicators, artificial urgency, fake banking alerts,
credential/OTP harvesting, and trojan distribution patterns.
Produces structured, explainable findings.
"""

import re
import datetime
from typing import List, Dict, Any, Tuple


class MessageRule:
    def __init__(
        self,
        rule_id: str,
        title: str,
        severity: str,
        patterns: List[str],
        explanation: str,
        score_weight: int
    ):
        self.rule_id = rule_id
        self.title = title
        self.severity = severity  # "info", "low", "medium", "high", "critical"
        self.patterns = [re.compile(p, re.IGNORECASE) for p in patterns]
        self.explanation = explanation
        self.score_weight = score_weight

    def check(self, text: str) -> Tuple[bool, List[str]]:
        matches = []
        for pat in self.patterns:
            found = pat.findall(text)
            if found:
                for item in found:
                    match_str = item if isinstance(item, str) else item[0]
                    if match_str and match_str not in matches:
                        matches.append(match_str)
        return len(matches) > 0, matches


MESSAGE_RULES: List[MessageRule] = [
    MessageRule(
        rule_id="MSG-URGENCY-001",
        title="Pola Desakan Waktu dan Manipulasi Emosional",
        severity="medium",
        patterns=[
            r"\b(segera|dalam waktu 1x24 jam|rekening diblokir|surat panggilan|surat tilang|ancaman denda|verifikasi segera|blokir permanen)\b"
        ],
        explanation="Pelaku penipuan sengaja menciptakan rasa panik agar korban bertindak terburu-buru tanpa memverifikasi.",
        score_weight=20
    ),
    MessageRule(
        rule_id="MSG-OTP-HARVEST-001",
        title="Indikasi Pengambilan Kode OTP atau Kredensial",
        severity="critical",
        patterns=[
            r"\b(kirimkan kode otp|minta kode sms|foto kartu atm|nomor cvv|pin kartu|login ulang akun|masukkan password anda)\b"
        ],
        explanation="Pihak bank, e-wallet, dan instansi resmi tidak pernah meminta kode OTP, PIN, atau data kartu pengguna.",
        score_weight=45
    ),
    MessageRule(
        rule_id="MSG-IMPERSONATION-001",
        title="Peniruan Identitas Resmi / Akun Admin Palsu",
        severity="high",
        patterns=[
            r"\b(customer care|layanan resmi|halo bca|call center mandiri|admin bri|helpdesk|pusat bantuan wa)\b.*(✅|centang biru|resmi|terverifikasi)?"
        ],
        explanation="Teks memuat klaim sebagai petugas resmi, sering kali menggunakan klaim centang verifikasi palsu.",
        score_weight=25
    ),
    MessageRule(
        rule_id="MSG-TROJAN-APK-001",
        title="Distribusi Berkas Ekstensi Berisiko (.APK/.EXE)",
        severity="critical",
        patterns=[
            r"\.(apk|exe|scr|bat|vbs)($|\s|[?#])",
            r"\b(undangan pernikahan|kurir paket|cek resi|surat tilang elektronik)\b.*\.(apk|exe)"
        ],
        explanation="Berkas instalasi Android (.APK) di luar Google Play Store sering dimanfaatkan untuk menyadap SMS OTP perbankan.",
        score_weight=45
    ),
    MessageRule(
        rule_id="MSG-FINANCIAL-SCAM-001",
        title="Janji Finansial Tidak Masuk Akal / Penipuan Berhadiah",
        severity="high",
        patterns=[
            r"\b(kerja paruh waktu|komisi harian|investasi modal kecil|menangkan saldo|hadiah pulsa|promo diskon 90%|dana kaget)\b"
        ],
        explanation="Tawaran komisi harian, hadiah saldo instan, atau diskon ekstrem adalah modus khas penipuan finansial digital.",
        score_weight=30
    )
]


def analyze_message_text(text: str) -> Dict[str, Any]:
    """
    Menganalisis teks pesan untuk mendeteksi indikator manipulasi psikologis dan penipuan.
    Mengembalikan daftar findings terstruktur dan kontribusi skor.
    """
    findings: List[Dict[str, Any]] = []
    total_score = 0
    now_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()

    for rule in MESSAGE_RULES:
        matched, matches = rule.check(text)
        if matched:
            total_score += rule.score_weight
            findings.append({
                "rule_id": rule.rule_id,
                "title": rule.title,
                "severity": rule.severity,
                "evidence": f"Pola terdeteksi: '{', '.join(matches[:3])}'",
                "source": "Message Heuristics",
                "observed_at": now_utc,
                "explanation": rule.explanation,
                "limitations": ["Deteksi berbasis pola kata kunci kontekstual Indonesia."]
            })

    return {
        "score": min(total_score, 100),
        "findings": findings,
        "is_suspicious": len(findings) > 0
    }
