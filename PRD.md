# Product Requirement Document (PRD)

## Project Name: SecurAI — SOC L1 Triage & Multi-Vector Threat Intelligence Assistant

### 1. Executive Summary & Objective
SecurAI adalah platform asisten keamanan siber interaktif (*Conversational Incident Triage*) yang menggabungkan analisis heuristik lokal deterministik dan model kognitif AI (*Gemini 3.8 Flash*). Sistem ini dirancang untuk mendeteksi ancaman rekayasa sosial, menginspeksi tautan mencurigakan secara aman, menganalisis tangkapan layar situs yang diblokir (*multimodal vision*), serta memetakan temuan ke framework global **MITRE ATT&CK**.

### 2. Problem Statement
Pengguna sering menjadi korban penipuan digital (phishing perbankan, malware APK, dan situs judi online) karena kesulitan membedakan konten manipulatif. Selain itu, banyak sistem keamanan gagal membedakan antara **situs ilegal hak cipta (seperti platform baca komik/streaming)** dengan **situs yang secara aktif mengeksploitasi data (*malicious*)**, sehingga edukasi yang diberikan sering kali keliru.

### 3. Core Feature Requirements

| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|---|
| F-01 | **Safe URL Inspector** | Menginspeksi metadata URL publik secara aman dengan proteksi anti-SSRF dan pelacakan redirect (*unshortener*). | High |
| F-02 | **Multimodal Screenshot Triage** | Menganalisis tangkapan layar situs jika web memblokir crawling bot otomatis (Cloudflare/WAF) via AI Vision. | High |
| F-03 | **Threat Categorization Matrix** | Mengklasifikasikan entitas ke dalam: (1) Aman/Resmi, (2) Ilegal Non-Destruktif (Malvertising Risk), dan (3) Aktif Berbahaya. | High |
| F-04 | **Automated URL Defanging** | Menetralkan tautan berbahaya (`hxxp[://]domain[.]com`) agar aman dari klik tidak disengaja. | High |
| F-05 | **MITRE ATT&CK Mapping** | Melabeli taktik penyerang secara otomatis (T1566.002, T1566.001, T1056.003). | Medium |
| F-06 | **1-Click Incident Export** | Mengekspor hasil investigasi insiden ke berkas Markdown/JSON yang rapi untuk audit keamanan. | Medium |

### 4. Technical Specifications
- **Runtime & Framework:** Python 3.10+, FastAPI, Uvicorn (Asynchronous I/O)
- **AI Engine:** Google GenAI SDK (Model: `gemini-3.8-flash`)
- **Inspection Engine:** HTTPX Safe Scraper dengan verifikasi subnet IP privat (RFC 1918)
- **Frontend Console:** Responsive Dark-Mode SOC Console (HTML5, Tailwind CSS, Vanilla JS)