import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.schemas import ChatRequest, ChatResponse, HeuristicResult
from app.core.security import sanitize_user_input, check_prompt_injection
from app.core.heuristics import analyze_heuristics
from app.services.ai_service import generate_chat_response

app = FastAPI(
    title="SecurAI - Conversational Incident & Link Triage",
    description="Backend API untuk chatbot analis insiden keamanan siber dan phishing",
    version="1.0.0"
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
    
    if not clean_message:
        raise HTTPException(status_code=400, detail="Pesan tidak boleh kosong.")
    
    if check_prompt_injection(clean_message):
        return ChatResponse(
            reply="⚠️ Sistem mendeteksi percobaan override instruksi keamanan (*Prompt Injection*). Permintaan ditolak demi kepatuhan kebijakan keamanan.",
            heuristics=None
        )

    # 1. Jalankan Analisis Heuristik Deterministik
    heuristics_dict = analyze_heuristics(clean_message)
    
    # 2. Kirim ke LLM Service dengan Konteks Percakapan
    bot_reply = generate_chat_response(clean_message, req.history, heuristics_dict)

    heuristic_result = None
    if heuristics_dict["has_suspicious_elements"]:
        heuristic_result = HeuristicResult(**heuristics_dict)

    return ChatResponse(
        reply=bot_reply,
        heuristics=heuristic_result
    )