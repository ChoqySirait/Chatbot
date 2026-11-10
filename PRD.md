# Product Requirement Document (PRD)

## Project Name: SecurAI — Digital Trust, Threat Intelligence & Incident Assistance Platform
**Status:** Release Candidate (v2.5.0) — All Core Milestones Implemented & Tested  
**Architecture:** Modular FastAPI Backend + React 19/Vite/TS Local-First Frontend

---

### 1. Executive Summary & Objective
SecurAI adalah platform asisten keamanan siber dan perlindungan konsumen digital (*Dual-Engine Incident Triage*) yang menggabungkan analisis heuristik lokal deterministik paralel dan penalaran kognitif AI (*Gemini 2.5 Flash Structured JSON Output*). Sistem ini dirancang untuk mendeteksi ancaman rekayasa sosial, menginspeksi tautan mencurigakan secara aman dengan Anti-SSRF mutlak, mengarsipkan bukti digital di brankas perangkat secara *Local-First* (IndexedDB), serta memetakan temuan ke framework global **MITRE ATT&CK**.

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
| SEC-08 | **Rate Limiting & Payload Limits** | Pembatasan laju sliding-window 120 req/menit (HTTP 429) dan batas muatan request 5 MB (HTTP 413). | ✅ Complete |
| SEC-09 | **Defensive Security Headers** | Penerapan otomatis X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP, dan CORS. | ✅ Complete |
| ANA-01 | **Canonical Structured Schema** | Kontrak Pydantic terstandarisasi (`CanonicalAnalysisResult`, `AnalysisFinding`) yang memisahkan fakta teknis dari interpretasi AI. | ✅ Complete |
| ANA-05 | **Multi-URL Parallel Engine** | Pemeriksaan paralel hingga 5 URL independen tanpa saling menggagalkan. | ✅ Complete |
| ANA-06 | **Message Social Engineering** | Deteksi desakan waktu palsu, ancaman blokir, pemanenan OTP/PIN, dan file APK trojan. | ✅ Complete |
| ANA-09 | **Threat Reputation Feed** | Modul `ThreatReputationAdapter` dengan feed luring deterministik dan degradasi aman tanpa kegagalan sistem. | ✅ Complete |
| AI-02 | **Gemini Structured JSON Output** | Pemanggilan Google GenAI via Pydantic JSON Schema (`response_schema`), mengeliminasi kesalahan substring matching. | ✅ Complete |
| AI-05 | **Graceful Degradation Fallback** | Fitur rule-based heuristik lokal tetap berfungsi penuh 100% jika kuota AI habis atau koneksi offline. | ✅ Complete |
| UX-02 | **Modern React+Vite Frontend** | Antarmuka interaktif dan responsif berbasis React 19, TypeScript, Tailwind CSS v4 di `frontend/`. | ✅ Complete |
| UX-03 | **Dual-Mode Presentation** | Beralih instan antara Consumer Mode (ramah, non-teknis, aksi darurat) dan Analyst SOC Mode (telemetri mendalam, IoC, MITRE). | ✅ Complete |
| UX-04 | **Bilingual i18n Localization** | Dukungan 1-klik Bahasa Indonesia dan English secara menyeluruh di seluruh aplikasi. | ✅ Complete |
| INC-02 | **Local-First Storage (Dexie.js)** | Penyimpanan buku kasus insiden, timeline kronologis, dan brankas bukti pada IndexedDB peramban (*zero cloud server retention*). | ✅ Complete |
| REP-01 | **Forensic Dossier Exporter** | Ekspor laporan insiden komprehensif dalam format Markdown (.md), JSON kanonikal, dan draf surat sanggahan resmi bank siap cetak PDF. | ✅ Complete |
| EDU-01 | **Learning Center & Simulator** | Pusat edukasi modus penipuan online Indonesia dan simulator kuis deteksi phishing dengan evaluasi skor kewaspadaan. | ✅ Complete |

---

### 4. Technical Specifications
- **Backend:** Python 3.12+, FastAPI, Uvicorn, HTTPX (Asynchronous I/O), Pydantic v2.
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, Lucide React, Dexie.js (IndexedDB).
- **AI Engine:** Google GenAI SDK (Model: `gemini-2.5-flash` / `gemini-1.5-flash`).
- **Testing & CI:** 64 automated tests offline (Pytest, Pytest-Asyncio), GitHub Actions CI workflow.
