# 🛡️ SecurAI — Intelligent SOC L1 Incident Triage & Threat Intelligence Assistant

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue?style=flat&logo=python)](https://python.org)
[![Google Gemini](https://img.shields.io/badge/AI%20Engine-Gemini%203.8%20Flash-8E75B2?style=flat)](https://ai.google.dev/)
[![MITRE ATT%26CK](https://img.shields.io/badge/Framework-MITRE%20ATT%26CK-red?style=flat)](https://attack.mitre.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

SecurAI adalah sistem asisten keamanan siber interaktif berbasis *Hybrid Engine* (Inspeksi Heuristik Lokal + Penalaran AI Multimodal). Dirancang khusus untuk membedah tautan phishing, skema APK trojan, situs judi online, serta mengedukasi pengguna dengan membedakan risiko **pelanggaran hak cipta (*piracy*)** versus **ancaman destruktif (*malicious intent*)**.

---

## 🏗️ System Architecture & Data Flow

```text
[ Pengguna Mengirim Teks / Tautan / Screenshot ]
                        │
                        ▼
         [ 1. Ingestion & Security Guard ]
         ├── Input Sanitization & Anti-XSS
         └── Prompt Injection Blocker (Jailbreak Guard)
                        │
                        ▼
         [ 2. Safe Heuristic & URL Inspector ]
         ├── Anti-SSRF Validation (Blokir IP Private/Localhost)
         ├── Redirect Chain Resolver (Unshorten bit.ly / s.id)
         └── Pattern Scanner (Ekstensi .APK, Typosquatting Bank, Judol Keywords)
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
 [ URL Dapat Diakses ]         [ URL Terblokir / WAF ]
 Ambil <title> & Metadata       Minta Screenshot via Mode Samaran
        │                               │
        └───────────────┬───────────────┘
                        │
                        ▼
         [ 3. Cognitive Engine (Gemini 3.8 Flash) ]
         ├── Klasifikasi 3-Tier (Resmi vs Ilegal/Pirasi vs Aktif Berbahaya)
         ├── Ekstraksi Indikator Malvertising & Phishing
         └── Pemetaan Taktik MITRE ATT&CK (T1566.002, T1056.003, dll.)
                        │
                        ▼
         [ 4. SOC Cockpit Dashboard UI ]
         ├── URL Defanging Otomatis (hxxps[://]contoh[.]com)
         ├── Dynamic Risk Meter & Heuristic Badges
         └── Ekspor Tiket Laporan Insiden (.MD / .JSON)

```

---

✨ Fitur Unggulan :

🔬 Safe Web Inspection: Menginspeksi tautan tanpa risiko SSRF (Server-Side Request Forgery).

🖼️ Multimodal OCR & Vision: Unggah tangkapan layar jika situs memblokir bot otomatis (Cloudflare/DDoS-Guard).

🎯 Diferensiasi Ancaman Objektif: Mampu membedakan situs komik/streaming bajakan (resiko iklan pihak ketiga) dengan situs penipuan murni (credential harvest).

🛡️ URL Defanging Standar SOC: Menetralkan tautan aktif menjadi hxxp[://] demi keamanan analis.

📋 Export Incident Report: Unduh ringkasan audit insiden dalam satu klik untuk dokumentasi kepatuhan.



