# Security Policy & Threat Model

## 1. Scope & Intent
SecurAI dirancang khusus sebagai alat analisis defensif untuk edukasi dan deteksi awal insiden phishing.

## 2. Threat Mitigation Strategies

### Prompt Injection Defense
- Setiap input pengguna diisolasi sebagai data pasif, bukan instruksi yang dapat dieksekusi.
- Sistem menggunakan batasan karakter maksimal (3.000 karakter) untuk mencegah *payload stuffing*.

### Data Privacy & Confidentiality
- Kredensial, token API, dan data rahasia dikelola secara ketat melalui environment variables (`.env`) dan tidak pernah disertakan dalam riwayat commit Git.
- Sistem tidak menyimpan riwayat percakapan secara permanen di database publik tanpa enkripsi.

## 3. Vulnerability Reporting
Jika Anda menemukan kerentanan pada proyek ini, silakan laporkan melalui GitHub Issues dengan label `security`.