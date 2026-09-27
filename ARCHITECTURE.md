# System Architecture & Technical Specifications

## 1. Overview
SecurAI dirancang dengan arsitektur **Hybrid Incident Triage**. Sistem ini menggabungkan pemindaian deterministik cepat (*Heuristic Regex Engine*) pada layer lokal dan penalaran kognitif (*Cognitive Reasoning*) menggunakan LLM (*Google Gemini API*).

---

## 2. High-Level Architecture Flow

```text
[ User Client (Browser) ]
           │
           │  1. HTTP POST /api/chat (Payload: message + history)
           ▼
[ FastAPI Application Gateway ]
           │
           ├──► 2. Input Sanitization & Jailbreak Guard (core/security.py)
           │
           ├──► 3. Heuristic Threat Analyzer (core/heuristics.py)
           │       ├── Raw IP Detection
           │       ├── Dangerous Extension (.apk/.exe)
           │       ├── Brand Spoofing / Typosquatting
           │       └── Indonesian Social Engineering Keywords
           │
           ▼
[ AI Orchestrator (services/ai_service.py) ]
           │
           │  4. Enrich Context with Heuristic Metadata
           │  5. Forward to Google Gemini 2.5 Flash
           ▼
[ Google Gemini Model ]
           │
           │  6. Generates Structured Cybersecurity Insights
           ▼
[ Response Formatter (schemas.py) ]
           │
           │  7. Returns JSON { reply, heuristics: { score, flags } }
           ▼
[ Reactive UI Dashboard (app.js) ]