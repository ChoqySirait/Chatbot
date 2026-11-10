# 🛡️ SecurAI — Digital Trust, Threat Intelligence & Incident Assistance

<div align="center">

[![Author: ChoqySirait](https://img.shields.io/badge/Author-Choqy%20Pananda%20Sirait-0284C7?style=for-the-badge&logo=github&logoColor=white)](https://github.com/ChoqySirait)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Tests Passed](https://img.shields.io/badge/Pytest-48%2F48%20Passed-10B981?style=for-the-badge&logo=pytest&logoColor=white)](tests/)
[![Security: MITRE ATT&CK](https://img.shields.io/badge/Framework-MITRE%20ATT%26CK-EF4444?style=for-the-badge&logo=shield&logoColor=white)](https://attack.mitre.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](LICENSE)

<p align="center">
  <b>Platform asisten keamanan siber dan perlindungan konsumen digital berbasis <i>Dual-Engine</i> (Heuristik Asinkron Paralel + Multimodal AI Reasoning).</b><br>
  Dirancang untuk membedah rekayasa sosial perbankan, toko online palsu, berkas APK trojan, membedakan risiko <i>malvertising</i> pada situs komik non-resmi, serta mengamankan integritas bukti digital bagi korban penipuan finansial online di Indonesia.
</p>

[Pengembang](#-pengembang--arsitek) • [Status Implementasi](#-status-implementasi-fitur) • [Arsitektur Sistem](#-arsitektur--alur-data-sistem) • [Keamanan & Anti-SSRF](#-keamanan-jaringan--anti-ssrf) • [Instalasi & Pengujian](#-panduan-instalasi--pengujian) • [Roadmap Milestone](#-roadmap-pengembangan-bertahap)

</div>

---

## 👨‍💻 Pengembang / Arsitek

<div align="center">
  <table>
    <tr>
      <td align="center">
        <a href="https://github.com/ChoqySirait">
          <img src="https://avatars.githubusercontent.com/ChoqySirait" width="110px;" alt="Choqy Pananda Sirait" style="border-radius: 50%; border: 3px solid #0284C7;"/><br />
          <sub><b>Choqy Pananda Sirait</b></sub>
        </a><br />
        <sub>Lead Developer & System Architect</sub><br /><br />
        <a href="https://github.com/ChoqySirait">
          <img src="https://img.shields.io/badge/GitHub-ChoqySirait-181717?style=flat-square&logo=github" alt="GitHub ChoqySirait" />
        </a>
      </td>
    </tr>
  </table>
  <p><i>Proyek ini dikembangkan secara bertahap dan defensif dengan standar rekayasa perangkat lunak dan arsitektur keamanan siber yang ketat.</i></p>
</div>

---

## 📊 Status Implementasi Fitur

### ✅ Fitur yang Sudah Aktif & Teruji (Milestone 1, 2, & 3)
- **Modern React + Vite + TypeScript Frontend (Milestone 3):** Antarmuka modern, interaktif, dan modular menggunakan React 19, TypeScript, Tailwind CSS v4, dan Lucide Icons di `frontend/`.
- **Local-First Storage Engine (Dexie.js / IndexedDB) (Milestone 3):** Seluruh buku kasus insiden (*Incident Casebook*), kronologi investigasi (*Timeline*), dan brankas bukti (*Evidence Vault*) disimpan secara mandiri di browser pengguna tanpa retensi data sensitif di server (*zero server-side retention*).
- **Dual-Mode Presentation (Consumer vs Analyst SOC Mode) (Milestone 3):** Memetakan objek kanonis yang sama ke dalam mode panduan ramah konsumen (ramah, bebas jargon, tindakan darurat) atau konsol SOC teknis (telemetri jaringan, rute redirect, MITRE ATT&CK, raw JSON kanonikal).
- **Bilingual i18n Localization (ID / EN) (Milestone 3):** Sistem pelokalan bilingual instan 1-klik untuk seluruh navigasi, kartu risiko, panduan mitigasi, dan kamus istilah keamanan.
- **Bank Dispute Letter & Police Report Generator (Milestone 3):** Pembuat draf surat resmi sanggahan transaksi bank (*chargeback*) dan laporan BAP kejahatan siber siap cetak/ekspor PDF.
- **Client-Side SHA-256 Seal & Manifest Verifier (Milestone 3):** Perhitungan hash kriptografis SHA-256 langsung di browser via Web Crypto API untuk verifikasi integritas rantai bukti (*chain of custody*).
- **Hardened Anti-SSRF Guard (SEC-01):** Validasi skema (`http/https`), resolusi lengkap DNS (A/AAAA), penolakan mutlak IP privat (RFC 1918), loopback, link-local, carrier-grade NAT, IPv4-mapped IPv6, dan cloud metadata (`169.254.169.254`). Rejeksi total pada domain DNS campuran (*mixed public/private records*).
- **Brand Impersonation & Typosquatting Engine (SEC-02):** Ekstraksi domain berbasis *Public Suffix List* (PSL) lokal (offline, zero-network). Membedakan secara akurat antara domain resmi merek (BCA, Tokopedia, Shopee, Mandiri, BRI, BNI, Dana, GoPay, OVO, Blibli, WhatsApp) dan domain tiruan, menghilangkan *false positive* pada domain resmi (`bca.co.id`, `tokopedia.com`).
- **Hardened Web Content Scraper (SEC-03):** Pengambilan sampel web dengan verifikasi TLS aktif (`verify=True`), penanganan pengalihan manual (*manual redirect tracking*) maksimal 5 hop dengan validasi ulang SSRF pada setiap hop, pembatasan body respons streaming maksimal 1 MB, dan koneksi socket aman dengan preservasi SNI.
- **Cryptographic Evidence Manifest (SEC-04):** Pembuatan segel bukti digital SHA-256 64-karakter heksadesimal penuh dilengkapi manifest kanonikal deterministik (identitas artefak, MIME, ukuran, timestamp UTC ISO 8601, dan raw SHA-256).
- **Canonical Structured Analysis Schema (ANA-01):** Kontrak data kanonis Pydantic terstandarisasi (`analysis_id`, `classification`, `risk_score`, `findings`, `mitre_techniques`, `recommended_actions`, `limitations`).
- **Multi-URL Analysis Engine (ANA-05):** Pemeriksaan paralel independen terhadap seluruh tautan unik (hingga 5 URL) dalam satu sesi input tanpa saling menggagalkan.
- **Message Social Engineering Intelligence (ANA-06):** Engine pendeteksi desakan waktu palsu, permintaan panik OTP/kredensial, peniruan CS resmi, dan file APK trojan dengan rule ID terstruktur (`MSG-URGENCY-001`, `MSG-OTP-HARVEST-001`, dll.).
- **Gemini Structured JSON Output (AI-02):** Pemanggilan Google GenAI menggunakan Pydantic JSON Schema (`response_schema`), mengeliminasi kesalahan *substring matching* ("Phishing", "Penipuan").
- **Dual-Mode System Prompts (AI-06):** Instruksi sistem terpisah untuk Consumer Mode (ramah, solutif, empatik) dan Analyst Mode (teknis, objektif, IoC, MITRE taxonomy).
- **Graceful Degradation Fallback (AI-05):** Analisis deterministik lokal tetap aktif penuh bila server AI eksternal offline, kuota habis, atau API key belum dikonfigurasi.
- **Modular API v1 Endpoints (Section 5.4):** Endpoint terpisah `/api/v1/analyze/url`, `/api/v1/analyze/message`, `/api/v1/health`, dan `/api/v1/ready`.
- **Privacy-Preserving Logging (SEC-07):** Logging terpusat dengan filter redaksi otomatis terhadap token, API key, dan kredensial sensitif.
- **Reproducible Test Environment (ENG-01):** 48 unit, security, and integration tests terisolasi dengan 100% *deterministic mocks*, berjalan offline dalam ~2 detik.

### ⏳ Fitur dalam Roadmap Berikutnya (Milestone 4)
- **Milestone 4:** Peningkatan Visualisasi Matriks MITRE ATT&CK interaktif, integrasi eksternal threat feed (MISP/OpenCTI stubs), audit trail export, dan automated benchmark testing.

---

## 🔬 Arsitektur & Alur Data Sistem

SecurAI memadukan evaluasi heuristik lokal deterministik dan penalaran kognitif AI dalam arsitektur modular bertahap:

```mermaid
sequenceDiagram
    autonumber
    actor User as Pengguna / Analis
    participant UI as Antarmuka Konsol
    participant GW as FastAPI Gateway (v1 & Chat API)
    participant SEC as SSRF & Safe DNS Guard
    participant Core as Parallel Telemetry & Heuristic Engine
    participant AI as AI Structured Orchestrator (Gemini)

    User->>UI: Input Tautan / Pesan / Screenshot
    UI->>GW: POST /api/chat atau /api/v1/analyze/*
    
    rect rgb(11, 25, 44)
        Note over GW,SEC: Tahap 1: Validasi Keamanan Input & Anti-SSRF
        GW->>SEC: Validasi Skema, Hostname & Resolusi DNS A/AAAA
        alt DNS Menghasilkan IP Privat / Non-Global
            SEC-->>GW: Tolak Permintaan (SSRF Violation)
        else Seluruh Alamat IP Global & Aman
            SEC-->>Core: Jalankan Inspeksi Paralel (Pinned Safe IP)
            par Inspeksi TLS / SSL Handshake
                Core->>Core: Socket connect ke Pinned IP (SNI Hostname Asli)
            and Kueri Registrasi RDAP
                Core->>Core: Kueri ICANN RDAP secara Aman
            and HTTP Scraper Terkendali
                Core->>Core: GET (verify=True, max 1MB stream, manual redirects)
            end
            Core->>Core: Evaluasi Typosquatting (PSL), Pesan & Cetak SHA-256 Manifest
        end
    end

    Core->>AI: Kirim Konteks Chat + Telemetri Jaringan
    alt Gemini API Aktif
        AI->>AI: Generate Structured JSON (Pydantic Schema)
        AI-->>GW: Output JSON Terstruktur & Valid
    else Gemini Offline / Kuota Habis
        Core->>GW: Aktifkan Graceful Degradation (Rule-based Fallback)
    end
    
    GW-->>UI: Respons Lengkap (Balasan + Telemetri + Hasil Kanonis)
    UI-->>User: Tampilkan Indikator Risiko, Temuan & Telemetri Forensik
```

---

## 🛡️ Keamanan Jaringan & Anti-SSRF

SecurAI menerapkan prinsip *Defense-in-Depth* pada lapisan jaringan:
1. **DNS Pre-Validation:** Setiap hostname diuraikan seluruh record A dan AAAA-nya via `socket.getaddrinfo`.
2. **Rejection of Non-Global IPs:** Seluruh subnet privat RFC 1918, loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`), IPv4-mapped IPv6, dan Cloud IMDS (`169.254.169.254`) ditolak seketika.
3. **Anti-DNS Rebinding (Pinned IP Connection):** Koneksi socket SSL diarahkan secara spesifik ke alamat IP yang telah divalidasi, dengan parameter `server_hostname` tetap menggunakan nama domain asli untuk menjamin validitas sertifikat TLS dan pengiriman SNI.
4. **Manual Redirect Inspection:** Scraper tidak mengizinkan redirect otomatis tak terkontrol. Setiap hop diperiksa ulang dengan validator SSRF sebelum koneksi baru dibuat (maksimal 5 hop).
5. **Ukuran Respons Dibatasi:** Aliran stream dipotong maksimal 1 MB untuk mencegah eksploitasi kehabisan memori (*denial of service*).

---

## 🛠️ Tech Stack & Dependensi

- **Backend Runtime:** Python 3.10+ (Diuji pada Python 3.13)
- **Web Framework:** FastAPI, Uvicorn (Asynchronous ASGI)
- **HTTP & Network Engine:** HTTPX (Streaming client), Python Native `ssl` & `socket`
- **AI Engine:** Google GenAI SDK (`gemini-2.5-flash`, `gemini-1.5-flash`) dengan Structured JSON Outputs
- **Data Validation:** Pydantic v2
- **Suffix & Brand Engine:** Custom Local Public Suffix List (PSL) Engine
- **Frontend Saat Ini (Baseline):** HTML5, Tailwind CSS, Vanilla JS (ES6+)
- **Testing Framework:** Pytest 9+, `pytest-asyncio`

---

## 🚀 Panduan Instalasi & Pengujian

### 1. Kloning Repositori
```bash
git clone https://github.com/ChoqySirait/Chatbot.git
cd Chatbot
```

### 2. Konfigurasi Virtual Environment
```bash
# Membuat virtual environment terisolasi
python -m venv .venv

# Aktivasi virtual environment
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate
```

### 3. Instalasi Dependensi
```bash
# Instalasi runtime dependencies
pip install -r requirements.txt

# Instalasi dependencies pengembangan & testing
pip install -r requirements-dev.txt
```

### 4. Konfigurasi Environment Variables
Salin berkas template environment:
```bash
cp .env.example .env
```
Isi konfigurasi pada berkas `.env`:
```ini
GEMINI_API_KEY=your_gemini_api_key_here
```

### 5. Menjalankan Automated Tests (Pytest)
Seluruh pengujian dirancang 100% offline dengan mocking deterministik:
```bash
pytest -v
```
*Hasil aktual:* 48 test cases lulus 100% dalam < 2 detik.

### 6. Menjalankan Frontend & Membangun Production Bundle
Aplikasi frontend menggunakan React 19, TypeScript, dan Vite pada folder `frontend/`:
```bash
# Menjalankan frontend development server (dengan API proxy ke port 8000)
npm --prefix frontend run dev

# Membangun bundle produksi ke app/static/dist
npm --prefix frontend run build
```

### 7. Menjalankan Backend Server
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Buka browser pada alamat: `http://127.0.0.1:8000` (FastAPI secara otomatis menyajikan bundle React modern).

---

## 🗺️ Roadmap Pengembangan Bertahap

```mermaid
flowchart LR
    M1["Milestone 1 (SELESAI)\n- Hardened SSRF & DNS\n- Brand PSL Engine\n- Hardened Scraper\n- SHA-256 Manifest"]
    M2["Milestone 2 (SELESAI)\n- Gemini Structured JSON\n- Multi-URL Analysis\n- Message Intelligence\n- API v1 Endpoints\n- 47 Mocked Tests"]
    M3["Milestone 3 (SELESAI)\n- React + TypeScript SPA\n- Dexie.js (IndexedDB)\n- Local-First Vault\n- Bilingual (ID/EN)\n- 48 Mocked Tests"]
    M4["Milestone 4 (Target)\n- Analyst Mode (SOC L1)\n- MITRE ATT&CK Matrix\n- Raw Forensic Exporter\n- E2E Validation"]

    M1 --> M2 --> M3 --> M4
```

---

## 📄 Lisensi & Disclaimer
Proyek ini dilisensikan di bawah [MIT License](LICENSE).  
*Disclaimer Keamanan:* Segel kriptografis SHA-256 menjamin integritas data (tamper-evident), namun tidak secara mandiri menjamin keabsahan hukum atau kebenaran kejadian tanpa validasi forensik resmi oleh pihak berwenang.
