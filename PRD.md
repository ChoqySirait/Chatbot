# Product Requirement Document (PRD)

## Project Name: SecurAI - Intelligent Phishing & Social Engineering Triage

### 1. Overview & Objective

SecurAI adalah sistem asisten keamanan cerdas berbasis web yang membantu pengguna awam dan staf organisasi memvalidasi potensi ancaman phishing, smishing, dan rekayasa sosial (*social engineering*) secara *real-time*.

### 2. Problem Statement

Banyak korban penipuan digital terkecoh oleh manipulasi psikologis (urgensi, impersonasi institusi resmi) dan tautan mencurigakan. Pengguna awam membutuhkan alat validasi instan yang tidak hanya memberi tahu "apakah ini aman", tetapi juga menjelaskan *mengapa* itu berbahaya dan apa tindakan daruratnya.

### 3. Target Users

- Karyawan / Staf operasional non-IT.
- Mahasiswa dan masyarakat umum pengguna layanan digital / perbankan.

### 4. Core Features

- **Hybrid Analysis Engine:** Kombinasi pemindaian pola regex lokal (deteksi URL, domain IP, kata kunci urgensi) dan penalaran LLM (*contextual reasoning*).
- **Structured Risk Scoring:** Menghasilkan skor risiko (0–100), kategori risiko (Rendah / Sedang / Kritis), dan daftar taktik manipulasi yang terdeteksi.
- **Actionable Emergency Checklist:** Memberikan langkah penanganan mitigasi konkret jika pengguna terlanjur berinteraksi dengan pesan tersebut.
- **Defensive Safeguards:** Sanitasi payload dan proteksi terhadap serangan *prompt injection*.

### 5. Technical Stack

- **Backend:** Python 3.10+, FastAPI, Uvicorn
- **AI Engine:** Google Gemini API (`gemini-2.5-flash`)
- **Frontend:** Single-page dashboard (HTML5, Tailwind CSS, Vanilla JS)
- **Validation & Testing:** Pydantic v2, Pytest