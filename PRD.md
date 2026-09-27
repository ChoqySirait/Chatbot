# Product Requirement Document (PRD)
## Project Name: SecurAI - Incident & Phishing Detection Assistant

### 1. Overview & Objective
SecurAI adalah chatbot asisten keamanan siber yang dirancang untuk membantu pengguna awam dan staf organisasi memvalidasi potensi ancaman phishing serta rekayasa sosial (social engineering).

### 2. Target Users
- Mahasiswa / Karyawan non-teknis.
- Pengguna umum yang membutuhkan validasi cepat atas pesan atau email mencurigakan.

### 3. Core Features
- **Threat Indicator Analysis:** Menganalisis pesan teks pengguna untuk mencari unsur urgensi buatan, domain palsu, ancaman, atau permintaan kredensial.
- **Risk Level Scoring:** Mengklasifikasikan risiko pesan ke dalam tingkat Rendah (Low), Sedang (Medium), atau Tinggi (High).
- **Incident Mitigation Checklist:** Memberikan 3 tindakan mitigasi taktis yang harus dilakukan pengguna.
- **Prompt Injection Defense:** Sanitasi payload di backend agar bot tidak mengeksekusi instruksi arbitrer yang berbahaya.

### 4. Technical Specifications
- **Backend:** Python (FastAPI / Uvicorn)
- **Frontend:** Single Page UI (HTML5, Tailwind CSS, Vanilla JS Fetch API)
- **AI Engine:** Google Gemini API (Model: gemini-2.5-flash)