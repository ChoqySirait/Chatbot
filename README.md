# Chatbot

```markdown
# 🛡️ SecurAI — Intelligent Phishing & Incident Triage Assistant

SecurAI adalah platform asisten keamanan siber interaktif berbasis AI dan mesin heuristik lokal (*Hybrid Engine*) yang dirancang untuk membantu deteksi dini pesan penipuan, tautan mencurigakan, dan edukasi *social engineering*.

---

## ✨ Fitur Utama

- 🔍 **Hybrid Heuristic Analysis:** Pendeteksian instan tautan IP mentah, penipuan ekstensi file APK (modus undangan/kurir paket), dan *typosquatting* merek perbankan/e-wallet Indonesia.
- 💬 **Conversational Security Advisor:** Konsultasi interaktif seputar konsep keamanan informasi, hardening sistem, dan mitigasi insiden.
- 🚨 **Prompt Injection Safeguard:** Mekanisme pertahanan berlapis untuk menyaring manipulasi instruksi terhadap AI.
- ⚡ **Modern Stack:** Dibangun menggunakan FastAPI (asynchronous backend) dan antarmuka responsif Tailwind CSS.

---

## 🛠️ Tech Stack

- **Backend:** Python 3.10+, FastAPI, Uvicorn, Pydantic v2
- **AI Core:** Google GenAI SDK (`gemini-2.5-flash`)
- **Frontend:** HTML5, Tailwind CSS, Vanilla JS Fetch API
- **Testing:** Pytest

---

## 🚀 Panduan Menjalankan Proyek

### 1. Kloning Repositori
```bash
git clone [https://github.com/ChoqySirait/Chatbot.git](https://github.com/ChoqySirait/Chatbot.git)
cd Chatbot