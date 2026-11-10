import os
import asyncio
from typing import Dict, Any, List
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.schemas import ChatRequest, ChatResponse, HeuristicResult, CanonicalAnalysisResult
from app.core.security import sanitize_user_input, check_prompt_injection
from app.core.heuristics import analyze_heuristics
from app.services.ai_service import process_chat_with_gemini
from app.core.logging_config import setup_logging

# Inisialisasi logging terpusat dengan filter privasi
setup_logging()

app = FastAPI(
    title="SecurAI — Digital Trust & Incident Assistance Hub",
    description="Platform Triage Anti-Fraud, Multi-Vector Threat Intelligence & Incident Assistance",
    version="2.5.0"
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


# Blok endpoint utama yang menangani request secara non-blocking (Kompatibilitas Penuh)
@app.post("/api/chat", response_model=ChatResponse)
async def handle_chat(req: ChatRequest):
    clean_message = sanitize_user_input(req.message)
    if not clean_message and not req.image_base64:
        raise HTTPException(status_code=400, detail="Pesan atau gambar tidak boleh kosong.")

    if check_prompt_injection(clean_message):
        return ChatResponse(
            reply="Sistem mendeteksi upaya penimpaan instruksi (*Prompt Injection*). Permintaan dibatalkan demi kepatuhan keamanan.",
            heuristics=None,
            mitre_tags=["MITRE T1059 (Command Execution Attempt)"],
            threat_category="Aktif Berbahaya (Malicious)"
        )

    # 1. Jalankan Analisis Heuristik & Jaringan secara Asinkron
    heuristics_dict = await analyze_heuristics(clean_message)

    # 2. Proses AI di background threadpool agar loop server tetap responsif
    reply, mitre_tags, category = await asyncio.to_thread(
        process_chat_with_gemini, clean_message, req.history, heuristics_dict, req.image_base64
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
        canonical_result=heuristics_dict.get("canonical_result")
    )
