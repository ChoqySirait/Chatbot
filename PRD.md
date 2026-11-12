# Product Requirement Document (PRD)

## Project Name: SecurAI — Digital Trust, Threat Intelligence & Incident Assistance Platform
**Status:** Released v2.6.0 (Milestones 0–7 Selesai & Terverifikasi)  
**Architecture:** Modular FastAPI Backend + React 19/Vite/TS Local-First Frontend

---

### 1. Executive Summary & Objective
SecurAI adalah platform asisten keamanan siber dan perlindungan konsumen digital (*Dual-Engine Incident Triage*) yang menggabungkan analisis heuristik lokal deterministik paralel dan penalaran kognitif AI (*Google GenAI Structured JSON Output* dengan `MODEL_NAME` terkonfigurasi & fallback deterministik lokal). Sistem ini dirancang untuk mendeteksi ancaman rekayasa sosial, menginspeksi tautan dan tangkapan layar secara aman dengan Anti-SSRF & validasi *magic-byte*, mengarsipkan bukti digital di brankas perangkat secara *Local-First* (IndexedDB), serta memetakan temuan ke framework global **MITRE ATT&CK**.

---

### 2. Problem Statement
Masyarakat dan analis keamanan junior di Indonesia kerap menghadapi modus penipuan siber yang semakin canggih (phishing perbankan mengatasnamakan perubahan tarif transfer, malware berkedok file APK undangan pernikahan/surat tilang ETLE, dan *task scam* lowongan kerja palsu). Korban sering kali kehilangan bukti digital penting atau tidak memiliki panduan draf resmi untuk meminta penangguhan transaksi ke bank penerbit (*dispute chargeback*).

---

### 3. Core Feature Requirements Matrix

| ID | Fitur | Deskripsi | Status Implementasi |
|---|---|---|---|
| SEC-01 | **Hardened Anti-SSRF Guard** | Validasi skema, resolusi penuh DNS A/AAAA, penolakan mutlak IP privat/loopback/cloud metadata, koneksi soket terikat IP publik aman dengan preservasi SNI. | ✅ Complete |
| SEC-02 | **Brand Impersonation & PSL** | Ekstraksi registrable domain berbasis Public Suffix List (PSL) lokal luring. Menghilangkan false-positive pada domain resmi merek Indonesia (BCA, Mandiri, BRI, Tokopedia, Shopee, dll.). | ✅ Complete |
| SEC-03 | **Hardened Scraper** | Pengambilan sampel web dengan TLS aktif (`verify=True`), redirect manual (maks 5 hop) dengan validasi SSRF tiap hop, dan streaming limit 1 MB. | ✅ Complete |
| SEC-04 | **Evidence Manifest & SHA-256** | Perhitungan hash SHA-256 64-karakter penuh dan manifest kanonikal deterministik tamper-evident. | ✅ Complete |
| SEC-06 | **Screenshot & Image Security Guard** | Validasi ketat base64, deteksi *magic bytes* PNG/JPEG/WEBP, batas biner 3 MB, serta pencegahan *decompression bomb* (maks 4096×4096 px) via Pillow. | ✅ Complete |
| SEC-08 | **Rate Limiting & Payload Limits** | Pembatasan laju sliding-window terkonfigurasi via `RATE_LIMIT_PER_MINUTE` (default 120 req/menit, HTTP 429) dan batas muatan request 5 MB (HTTP 413). | ✅ Complete |
| SEC-09 | **Defensive Security Headers** | Penerapan otomatis X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP, Permissions-Policy, dan CORS. | ✅ Complete |
| ANA-01 | **Canonical Structured Schema** | Kontrak Pydantic terstandarisasi (`CanonicalAnalysisResult`, `AnalysisFinding`) yang memisahkan fakta teknis dari interpretasi AI. | ✅ Complete |
| ANA-05 | **Multi-URL Parallel Engine** | Pemeriksaan paralel hingga 5 URL independen tanpa saling menggagalkan. | ✅ Complete |
| ANA-06 | **Message Social Engineering** | Deteksi desakan waktu palsu, ancaman blokir, pemanenan OTP/PIN, dan file APK trojan. | ✅ Complete |
| ANA-09 | **Threat Reputation Feed** | Modul `ThreatReputationAdapter` dengan feed luring deterministik dan degradasi aman tanpa kegagalan sistem. | ✅ Complete |
| ANA-10 | **Local Binary File & Hash Inspector** | Pemeriksaan ekstensi, *magic bytes*, deteksi *extension masquerading*, dan segel SHA-256 100% luring via browser Web Crypto API tanpa unggahan server. | ✅ Complete |
| AI-02 | **Gemini Structured JSON Output** | Pemanggilan Google GenAI via Pydantic JSON Schema (`response_schema`), mengeliminasi kesalahan substring matching. | ✅ Complete |
| AI-05 | **Graceful Degradation Fallback** | Fitur rule-based heuristik lokal & balasan percakapan fallback tetap berfungsi penuh jika kuota AI habis atau koneksi offline. | ✅ Complete |
| AI-06 | **Bilingual API & Chat v1** | Dukungan rute `/api/v1/chat` & `/api/chat` serta kontrol bahasa (`language: "id" \| "en"`) pada orkestrasi AI dan fallback lokal. | ✅ Complete |
| AI-07 | **Explicit External AI Consent Gate** | Pengiriman tangkapan layar ke AI eksternal memerlukan centang `external_ai_consent=true`; bila nonaktif, hanya validasi lokal & SHA-256 yang berjalan. | ✅ Complete |
| UX-02 | **Minimalist Dark Slate React+Vite UI** | Antarmuka minimalis berfokus pada kejelasan informasi di tema tunggal Dark Slate, React 19, TypeScript, Tailwind CSS v4 (dengan pratinjau cetak putih untuk Surat Sanggahan). | ✅ Complete |
| UX-03 | **Dual-Mode Presentation** | Beralih instan antara Consumer Mode (ramah, non-teknis, aksi darurat) dan Analyst SOC Mode (telemetri mendalam, IoC, MITRE). | ✅ Complete |
| UX-04 | **100% Bilingual i18n Localization** | Dukungan 1-klik Bahasa Indonesia dan English secara menyeluruh dari navigasi hingga modal, formulir, dosir, dan chat AI. | ✅ Complete |
| UX-05 | **Local Overview Dashboard** | Tab Ringkasan (*Overview*) untuk statistik riwayat pemeriksaan, temuan risiko tinggi, kasus aktif, dan artefak SHA-256 lokal. | ✅ Complete |
| UX-09 | **Keyboard & ARIA Accessibility** | Skip-link konten utama, WAI-ARIA `tablist`/`tab` beserta navigasi panah keyboard, `aria-pressed`, `aria-live="polite"`, fokus jelas, dan styling `@media print`. | ✅ Complete |
| INC-02 | **Local-First Storage (Dexie.js)** | Penyimpanan buku kasus insiden, timeline kronologis, dan brankas bukti pada IndexedDB peramban (*zero cloud server retention*). | ✅ Complete |
| REP-01 | **Forensic Dossier Exporter** | Ekspor laporan insiden komprehensif dalam format Markdown (.md), JSON kanonikal, dan cetak PDF bersih (Surat Sanggahan Bank + Dosir Forensik). | ✅ Complete |
| EDU-01 | **Learning Center & Simulator** | Pusat edukasi modus penipuan online Indonesia dan simulator kuis deteksi phishing dwibahasa beserta sumber rujukan & tanggal peninjauan. | ✅ Complete |
| REL-04 | **Docker Non-Root Packaging** | Container multi-stage (`Dockerfile` & `docker-compose.yml`) dengan user non-root `appuser` dan *read-only rootfs*. | ✅ Complete |
| REL-07 | **Performance Budgets & Baseline** | Verifikasi otomatis anggaran ukuran bundle (`Vite dist` JS/CSS), batas payload/gambar, dan target latensi p95 deterministik luring. | ✅ Complete |
| GOV-01 | **Privacy & Acceptable-Use Boundaries** | Dokumentasi [`PRIVACY.md`](PRIVACY.md) dan pemberitahuan batasan pemrosesan data terintegrasi pada tab Pengaturan. | ✅ Complete |

---

### 4. Technical Specifications
- **Backend:** Python 3.10+ (diuji pada Python 3.13), FastAPI, Uvicorn, HTTPX (Asynchronous I/O), Pydantic v2, Pillow.
- **Frontend:** React 19, Vite 8, TypeScript, Tailwind CSS v4, Lucide React, Dexie.js (IndexedDB), `oxlint`, Vitest + `fake-indexeddb`.
- **AI Engine:** Google GenAI SDK (`MODEL_NAME` default `gemini-3.5-flash` beserta daftar model fallback terurut) menggunakan Structured JSON Outputs.
- **Testing & CI:** 86 backend tests offline (Pytest, `pytest-asyncio`) + 9 frontend unit tests offline (Vitest) = 95 automated tests terintegrasi dengan GitHub Actions CI workflow.
