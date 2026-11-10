import os
from typing import List
from dotenv import load_dotenv

load_dotenv()

class Settings:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    # Model resmi produksi Google GenAI yang stabil dan cepat
    MODEL_NAME: str = os.getenv("MODEL_NAME", "gemini-2.5-flash")
    # Daftar model cadangan resmi jika server Google mengalami lonjakan (503/429)
    FALLBACK_MODELS: List[str] = [
        "gemini-2.5-flash",
        "gemini-1.5-flash",
        "gemini-2.0-flash"
    ]
    # Konfigurasi timeout & batasan
    REQUEST_TIMEOUT_SECONDS: float = 8.0
    MAX_IMAGE_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 MB

settings = Settings()
