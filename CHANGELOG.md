# Changelog — SecurAI

Seluruh perubahan penting pada platform **SecurAI — Digital Trust, Threat Intelligence & Incident Assistance** didokumentasikan pada berkas ini.

## [2.5.0] - 2026-11-12

Rilis perdana **v2.5.0** yang menuntaskan seluruh Milestones 0–6 pada rencana pengembangan dan backlog keamanan.

### Added
- **Security & Hardening (`SEC-01`–`SEC-09`):**
  - Anti-SSRF guard (`app/core/security.py`) dengan validasi skema ketat (`http`/`https`), resolusi DNS A/AAAA penuh, penolakan IP privat/loopback/link-local/CGNAT/metadata cloud/campuran, serta *pinned IP socket* dengan preservasi SNI.
  - Hardened web scraper (`app/core/scraper.py`) dengan verifikasi TLS aktif (`verify=True`), batas redirect manual 5 hop yang tervalidasi SSRF di tiap hop, dan limit streaming biner 1 MB.
  - Brand Impersonation Engine berbasis Public Suffix List (PSL) lokal luring (`app/core/heuristics.py`) untuk merek perbankan dan e-commerce Indonesia.
  - Segel integritas bukti SHA-256 64-karakter penuh & manifest kanonikal deterministik (*tamper-evident*).
  - Validasi gambar tangkapan layar (`app/core/image_security.py`): decode base64, deteksi *magic bytes* PNG/JPEG/WEBP via Pillow, batas 3 MB, serta mitigasi *decompression bomb* (maks 4096×4096 px).
  - Defensive HTTP security headers (`X-Content-Type-Options`, `X-Frame-Options`, CSP, `Referrer-Policy`, `Permissions-Policy`), kebijakan CORS terkonfigurasi (`ALLOWED_ORIGINS`), batas payload 5 MB (`HTTP 413`), serta *sliding-window rate limiter* (`RATE_LIMIT_PER_MINUTE`, default 120 req/menit, `HTTP 429`).
- **Analysis Engine & Bilingual AI (`ANA-01`–`ANA-10`, `AI-01`–`AI-07`):**
  - Kontrak schema kanonikal Pydantic (`CanonicalAnalysisResult`, `AnalysisFinding`) memisahkan fakta teknis dari interpretasi AI.
  - Pemeriksaan multi-URL paralel (hingga 5 URL), analisis pesan rekayasa sosial, dan inspeksi berkas biner 100% lokal di browser (`Web Crypto SHA-256` + deteksi *extension masquerading*).
  - Integrasi Google GenAI SDK (`MODEL_NAME` terkonfigurasi) dengan Structured JSON Output (`response_schema`), kontrol bahasa `id`/`en` pada `/api/v1/chat` & `/api/chat`, fallback deterministik lokal saat kuota/koneksi gagal, serta gerbang persetujuan eksplisit `external_ai_consent=true` untuk analisis tangkapan layar.
  - `ThreatReputationAdapter` dengan *curated threat feed* luring dan degradasi aman.
- **Local-First SPA & Incident Assistance (`UX-02`–`UX-08`, `INC-02`, `REP-01`, `EDU-01`):**
  - Antarmuka React 19 + TypeScript + Vite + Tailwind CSS v4 dengan tema tunggal Dark Slate minimalis, dukungan penuh dwibahasa (`ID`/`EN`), serta **Consumer Mode** vs **Analyst SOC Mode**.
  - Penyimpanan lokal berbasis IndexedDB via Dexie.js (`securai_local_vault`): Overview Dashboard, Manajemen Kasus Insiden, Kronologi Timeline, Brankas Bukti SHA-256, Surat Sanggahan Bank siap cetak PDF, dan ekspor/impor bundel JSON/Markdown.
  - Explorer Matriks **MITRE ATT&CK** interaktif dan Pusat Edukasi beserta Simulator Kuis Phishing dwibahasa.
- **Release, Governance & CI/CD (`GOV-01`–`GOV-04`, `REL-01`–`REL-06`):**
  - Dokumentasi arsitektur ([`ARCHITECTURE.md`](ARCHITECTURE.md)), kebutuhan produk ([`PRD.md`](PRD.md)), kebijakan keamanan ([`SECURITY.md`](SECURITY.md)), privasi & penggunaan sah ([`PRIVACY.md`](PRIVACY.md)), serta lisensi resmi ([`LICENSE`](LICENSE)).
  - Kemasan produksi container (`Dockerfile` multi-stage non-root `appuser` + `docker-compose.yml` *read-only rootfs*).
  - Pipeline GitHub Actions CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) menjalankan Pytest offline, `oxlint`, `tsc -b --noEmit`, Vitest (`fake-indexeddb`), dan `vite build`.
