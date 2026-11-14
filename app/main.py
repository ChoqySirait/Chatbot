import os
import asyncio
from typing import Dict, Any, List
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.schemas import ChatRequest, ChatResponse, HeuristicResult, CanonicalAnalysisResult, ImageAnalysisRequest
from app.core.security import sanitize_user_input, check_prompt_injection
from app.core.heuristics import analyze_heuristics
from app.core.image_security import validate_and_inspect_image, ImageValidationError
from app.services.ai_service import process_chat_with_gemini, analyze_image_with_ai
from app.core.logging_config import setup_logging
from app.core.middleware import SecurityHeadersMiddleware, RateLimitAndPayloadMiddleware
from fastapi.middleware.cors import CORSMiddleware

# Inisialisasi logging terpusat dengan filter privasi
setup_logging()

app = FastAPI(
    title="SecurAI — Digital Trust & Incident Assistance Hub",
    description="Platform Triage Anti-Fraud, Multi-Vector Threat Intelligence & Incident Assistance",
    version="2.8.0"
)

# Registrasi middleware keamanan dan rate limiting (SEC-08, SEC-09)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitAndPayloadMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
DIST_DIR = os.path.join(STATIC_DIR, "dist")
DIST_ASSETS = os.path.join(DIST_DIR, "assets")

if os.path.exists(DIST_ASSETS):
    app.mount("/assets", StaticFiles(directory=DIST_ASSETS), name="assets")
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# Skema permintaan API v1
class UrlAnalysisRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2000, description="Tautan publik yang akan diinspeksi")


class MessageAnalysisRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000, description="Teks pesan untuk evaluasi rekayasa sosial")


@app.get("/")
def serve_index():
    dist_index = os.path.join(DIST_DIR, "index.html")
    if os.path.exists(dist_index):
        return FileResponse(dist_index)
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.get("/favicon.svg")
def serve_favicon():
    dist_fav = os.path.join(DIST_DIR, "favicon.svg")
    if os.path.exists(dist_fav):
        return FileResponse(dist_fav, media_type="image/svg+xml")
    static_fav = os.path.join(STATIC_DIR, "favicon.svg")
    if os.path.exists(static_fav):
        return FileResponse(static_fav, media_type="image/svg+xml")
    raise HTTPException(status_code=404, detail="Favicon not found")


# Endpoint Health & Readiness (Epic 1 / Section 5.4)
@app.get("/api/v1/health")
def health_check() -> Dict[str, str]:
    return {"status": "healthy", "version": "2.5.0"}


@app.get("/api/v1/ready")
def readiness_check() -> Dict[str, Any]:
    return {
        "status": "ready",
        "providers": {
            "gemini_api": "configured" if settings.GEMINI_API_KEY else "unconfigured_local_fallback_active",
            "heuristics_engine": "operational",
            "ssrf_guard": "active"
        }
    }


# Endpoint Analisis Terpisah API v1 (Section 5.4)
@app.post("/api/v1/analyze/url", response_model=CanonicalAnalysisResult)
async def analyze_url_endpoint(req: UrlAnalysisRequest):
    clean_url = sanitize_user_input(req.url)
    res = await analyze_heuristics(clean_url)
    canonical = res.get("canonical_result")
    if not canonical:
        raise HTTPException(status_code=500, detail="Gagal menghasilkan analisis kanonis untuk URL.")
    return canonical


@app.post("/api/v1/analyze/message", response_model=CanonicalAnalysisResult)
async def analyze_message_endpoint(req: MessageAnalysisRequest):
    clean_msg = sanitize_user_input(req.message)
    res = await analyze_heuristics(clean_msg)
    canonical = res.get("canonical_result")
    if not canonical:
        raise HTTPException(status_code=500, detail="Gagal menghasilkan analisis kanonis untuk pesan.")
    return canonical


@app.post("/api/v1/analyze/image", response_model=CanonicalAnalysisResult)
async def analyze_image_endpoint(req: ImageAnalysisRequest):
    try:
        validated_image = validate_and_inspect_image(req.image_base64)
    except ImageValidationError as err:
        raise HTTPException(status_code=err.status_code, detail=err.message)

    clean_note = sanitize_user_input(req.context_note or "")
    if clean_note and check_prompt_injection(clean_note):
        raise HTTPException(
            status_code=400,
            detail="Catatan konteks ditolak karena terdeteksi indikasi prompt injection."
        )

    return await asyncio.to_thread(
        analyze_image_with_ai,
        validated_image,
        clean_note,
        req.mode,
        req.external_ai_consent,
        req.language,
    )


# Blok endpoint utama yang menangani request secara non-blocking (Kompatibilitas Penuh + /api/v1/chat)
@app.post("/api/v1/chat", response_model=ChatResponse)
@app.post("/api/chat", response_model=ChatResponse)
async def handle_chat(req: ChatRequest):
    clean_message = sanitize_user_input(req.message)
    if not clean_message and not req.image_base64:
        raise HTTPException(
            status_code=400,
            detail="Message or image cannot be empty." if req.language == "en" else "Pesan atau gambar tidak boleh kosong.",
        )

    if check_prompt_injection(clean_message):
        injection_reply = (
            "Security control detected a prompt-injection override attempt. The request was blocked to preserve policy boundaries."
            if req.language == "en"
            else "Sistem mendeteksi upaya penimpaan instruksi (*Prompt Injection*). Permintaan dibatalkan demi kepatuhan keamanan."
        )
        return ChatResponse(
            reply=injection_reply,
            heuristics=None,
            mitre_tags=["MITRE T1059 (Command Execution Attempt)"],
            threat_category="Aktif Berbahaya (Malicious)"
        )

    if req.image_base64:
        try:
            validate_and_inspect_image(req.image_base64)
        except ImageValidationError as err:
            raise HTTPException(status_code=err.status_code, detail=err.message)

    # 1. Jalankan Analisis Heuristik & Jaringan secara Asinkron
    heuristics_dict = await analyze_heuristics(clean_message)

    # 2. Proses AI di background threadpool agar loop server tetap responsif
    reply, mitre_tags, category = await asyncio.to_thread(
        process_chat_with_gemini,
        clean_message,
        req.history,
        heuristics_dict,
        req.image_base64,
        req.mode,
        req.language,
    )

    heuristic_result = None
    if (
        heuristics_dict.get("inspection_performed")
        or heuristics_dict.get("network_intel") is not None
        or heuristics_dict.get("has_suspicious_elements")
    ):
        heuristic_result = HeuristicResult(**heuristics_dict)

    return ChatResponse(
        reply=reply,
        heuristics=heuristic_result,
        mitre_tags=mitre_tags,
        threat_category=category,
        canonical_result=heuristics_dict.get("canonical_result") if heuristic_result is not None else None
    )
