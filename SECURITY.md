# 🔒 Security Policy & Threat Model — SecurAI

## 1. Scope & Intent
SecurAI dirancang khusus sebagai platform analisis defensif, Digital Trust, dan bantuan penanganan insiden kejahatan siber finansial/phishing di Indonesia. Sistem ini secara tegas **tidak menyediakan kemampuan ofensif, eksploitasi, scanning agresif tanpa otorisasi, atau penyusupan**.

---

## 2. Threat Mitigation Strategies

### 2.1 Anti-SSRF & Network Egress Guard (SEC-01, SEC-03)
- **Skema Ketat:** Hanya protokol `http` dan `https` yang diizinkan; skema berisiko seperti `file://`, `gopher://`, `dict://`, dan `ftp://` ditolak seketika.
- **Resolusi DNS Komprehensif:** Setiap domain diresolusi penuh terhadap rekaman IPv4 (A) dan IPv6 (AAAA).
- **Penolakan Alamat Non-Global Mutlak:** Seluruh alamat privat (RFC 1918), loopback (`127.0.0.0/8`), link-local (`169.254.0.0/16`), CGNAT (`100.64.0.0/10`), IPv4-mapped IPv6, dan cloud metadata (`169.254.169.254`) diblokir sebelum soket dibuka.
- **Mixed Record Rejection:** Domain yang menghasilkan campuran alamat publik dan privat langsung digagalkan untuk memitigasi DNS rebinding.
- **Pinned Sockets & SNI:** Koneksi soket terikat langsung ke alamat IP publik yang telah lolos validasi, dengan tetap mempertahankan Server Name Indication (SNI) untuk verifikasi sertifikat TLS (`verify=True`).
- **Validasi Multi-Hop Redirect:** Pengalihan otomatis HTTP dinonaktifkan. Setiap hop redirect (maksimal 5 hop) divalidasi ulang secara independen sebelum dilanjutkan.

### 2.2 Brand Impersonation & Public Suffix List (SEC-02)
- Ekstraksi *registrable domain* menggunakan basis data Public Suffix List (PSL) lokal luring tanpa panggilan jaringan.
- Membedakan secara akurat antara domain resmi merek perbankan/e-commerce Indonesia (BCA, Mandiri, BRI, BNI, Tokopedia, Shopee, Dana, GoPay, OVO, Blibli, WhatsApp) dan domain tiruan, menghilangkan risiko *false-positive*.

### 2.3 Integritas Bukti Digital & Segel Kriptografis (SEC-04)
- Hash kriptografis dihitung menggunakan algoritma SHA-256 heksadesimal 64-karakter penuh atas byte artefak aktual.
- Manifest kanonikal deterministik memastikan perubahan 1 byte pada bukti akan menghasilkan hash berbeda secara matematis (*tamper-evident*).

### 2.4 Pertahanan Prompt Injection & AI Safety (AI-04, SEC-07)
- Seluruh input pengguna diperlakukan sebagai data tidak tepercaya (*untrusted data*).
- Logging operasional dilengkapi filter privasi regex (`PrivacyFilter`) yang meredaksi token, API key, dan data sensitif menjadi `***REDACTED***`.

### 2.5 Batasan Beban & Laju Permintaan (SEC-08, SEC-09)
- Pembatasan muatan request maksimal 5 MB (HTTP 413).
- *Sliding-window in-memory rate limiting* (120 req/menit per client IP) dengan respons HTTP 429 dan header `Retry-After`.
- Header keamanan defensif aktif: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, strict CSP, dan `Permissions-Policy`.

---

## 3. Vulnerability Reporting (Pelaporan Kerentanan)

Kami menyambut baik pelaporan kerentanan keamanan yang bertanggung jawab (*Responsible Disclosure*).

Jika Anda menemukan potensi kerentanan keamanan pada SecurAI:
1. **Jangan mengeksploitasi** celah tersebut atau membukanya ke publik sebelum tim pengembang memiliki kesempatan untuk menanganinya.
2. Laporkan secara privat melalui email tim keamanan / maintainer atau buat GitHub Security Advisory privat.
3. Sertakan informasi berikut dalam laporan Anda:
   - Deskripsi kerentanan dan dampaknya.
   - Langkah reproduksi (Proof-of-Concept) yang jelas dan aman.
   - Versi atau commit hash yang terdampak.

### Komitmen Waktu Respons:
- **Konfirmasi Penerimaan:** Dalam 48 jam.
- **Evaluasi & Rencana Perbaikan:** Dalam 7 hari kerja.
- **Rilis Patch Keamanan:** Diprioritaskan sesegera mungkin sesuai tingkat keparahan (CVSS).
