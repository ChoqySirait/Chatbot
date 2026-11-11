# Privacy Notice & Acceptable-Use Policy — SecurAI

_Last Updated: November 11, 2026_

## 1. Privacy Architecture (Local-First Storage)

SecurAI is designed around a **Local-First, Zero-Server-Persistence** data boundary:

- **Stored Exclusively on Your Device (`IndexedDB` via Dexie.js):**
  - Incident cases, investigative notes, and timelines
  - Evidence Vault artifacts, canonical JSON manifests, and SHA-256 hashes
  - Personal analysis history (`analysisHistory`), mode preference, and language setting (`ID` / `EN`)
  - No user accounts, tracking cookies, or server-side behavioral database exist.
- **Transient Backend Processing:**
  - The FastAPI backend processes URL inspection, message heuristics, image security verification, and optional AI calls in memory for the lifetime of each HTTP request.
  - Logging filters redact API keys, Bearer tokens, and authorization headers (`PrivacyFilter`).
- **External Network & AI Boundaries:**
  - **URL Inspection:** Server-side SSRF-hardened DNS, TLS handshake inspection, ICANN RDAP metadata lookup, and bounded HTTP sampling run only against the URL submitted by the user (non-global/private/metadata IPs are rejected before connection). Full path/query URL strings with potential PII are not logged.
  - **AI Chat (`POST /api/chat`):** When configured (`GEMINI_API_KEY`), message text and sanitized deterministic forensic context are forwarded to Google Gemini API. If `GEMINI_API_KEY` is omitted or unreachable, SecurAI uses its deterministic local fallback without external AI calls.
  - **Screenshot Analysis (`POST /api/v1/analyze/image`):** Opt-in external AI gate (`external_ai_consent`). Screenshots are **never** forwarded to Google Gemini Vision unless the user explicitly checks the consent toggle; by default, only local magic-byte, decompression-bomb, and SHA-256 verification execute.
  - **Local Binary File Hashing (`File & SHA-256` tab):** Computed 100% client-side via Web Crypto API (`crypto.subtle.digest`) and binary header inspection; file binaries are not uploaded to the backend or external APIs.

---

## 2. Acceptable-Use Policy

By using SecurAI, you agree to the following defensive boundaries:

1. **Authorized & Defensive Inspection Only:** Use URL inspection, threat triage, and file verification solely for personal protection, phishing/scam assessment, digital literacy, or authorized incident response.
2. **No Unauthorized Reconnaissance or Abuse:** Do not use SecurAI as an automated scanning proxy against third-party infrastructure you are not authorized to inspect, and do not attempt to bypass rate limits, payload size restrictions, or SSRF network boundaries.
3. **Sensitive Data Minimization:** Avoid pasting passwords, live banking PINs, private keys, or unnecessary personally identifiable information (PII) into chat or context fields when using external AI providers.

---

## 3. Forensic & Legal Limitations Disclaimer

- Risk scores (`0–100`), threat classifications (`no_major_indicator`, `needs_caution`, `high_risk`, `inconclusive`), MITRE ATT&CK tags, and AI explanations are **technical triage assistance indicators**, not absolute proof of safety or illegality.
- Full 64-character SHA-256 hashes and canonical manifests prove **integrity since observation** (tamper-evidence), not legal chain-of-custody authentication or pre-capture event truth.
- For financial disputes or cybercrime reporting, verify through official financial institutions and authorized law enforcement agencies.
