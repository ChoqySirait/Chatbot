import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.schemas import ChatRequest, ChatResponse, HeuristicResult
from app.core.security import sanitize_user_input, check_prompt_injection
from app.core.heuristics import analyze_heuristics
from app.services.ai_service import process_chat_with_gemini

app = FastAPI(
    title="SecurAI — Incident & Threat Intelligence Triage",
    description="Sistem Triage Insiden Keamanan & Forensik Tautan Berbasis AI",
    version="2.0.0"
)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@app.post("/api/chat", response_model=ChatResponse)
def handle_chat(req: ChatRequest):
    clean_message = sanitize_user_input(req.message)
    if not clean_message and not req.image_base64:
        raise HTTPException(status_code=400, detail="Pesan atau gambar tidak boleh kosong.")

    if check_prompt_injection(clean_message):
        return ChatResponse(
            reply="🛡️ **Security Alert:** Sistem mendeteksi upaya penimpaan instruksi keamanan (*Prompt Injection*). Permintaan ini ditolak demi kepatuhan kebijakan keamanan.",
            heuristics=None,
            mitre_tags=["MITRE T1059 (Command Execution Attempt)"],
            threat_category="Aktif Berbahaya (Malicious)"
        )

    # 1. Jalankan Analisis Heuristik Deterministik
    heuristics_dict = analyze_heuristics(clean_message)

    # 2. Proses melalui AI Multimodal (Gemini 3.8 Flash)
    reply, mitre_tags, category = process_chat_with_gemini(
        clean_message, req.history, heuristics_dict, req.image_base64
    )

    heuristic_result = None
    if heuristics_dict["has_suspicious_elements"]:
        heuristic_result = HeuristicResult(**heuristics_dict)

    return ChatResponse(
        reply=reply,
        heuristics=heuristic_result,
        mitre_tags=mitre_tags,
        threat_category=category
    )