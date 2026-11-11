import os
from typing import List
from dotenv import load_dotenv

load_dotenv()


def _parse_origins(raw: str) -> List[str]:
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]


class Settings:
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    # Model resmi produksi Google GenAI yang stabil dan cepat
    MODEL_NAME: str = os.getenv("MODEL_NAME", "gemini-2.5-flash")
    # Daftar model cadangan resmi jika server Google mengalami lonjakan (503/429)
    FALLBACK_MODELS: List[str] = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
    ]
    # Konfigurasi timeout & batasan
    REQUEST_TIMEOUT_SECONDS: float = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "8.0"))
    MAX_IMAGE_SIZE_BYTES: int = 3 * 1024 * 1024  # 3 MB raw image (~4 MB base64 < 5 MB HTTP limit)
    MAX_IMAGE_DIMENSION: int = 4096
    MAX_IMAGE_PIXELS: int = 4096 * 4096  # ~16.7 MP

    # Keamanan operasional & profil deployment (REL-04, SEC-08, SEC-09)
    ALLOWED_ORIGINS: List[str] = _parse_origins(os.getenv("ALLOWED_ORIGINS", ""))
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))

    def get_ordered_models(self) -> List[str]:
        """Prioritizes configured MODEL_NAME before deduplicated fallback models."""
        seen = []
        for m in [self.MODEL_NAME, *self.FALLBACK_MODELS]:
            if m and m not in seen:
                seen.append(m)
        return seen


settings = Settings()
