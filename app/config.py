import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    # Model utama yang berkecepatan tinggi dan stabil
    MODEL_NAME: str = "gemini-3.1-flash-lite"
    # Daftar model cadangan jika server Google mengalami lonjakan (503/429)
    FALLBACK_MODELS: list = [
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.8-flash",
        "gemini-2.5-flash-lite"
    ]

settings = Settings()