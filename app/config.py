import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    # Ganti ke gemini-3.8-flash sesuai pesan resmi dari Google
    MODEL_NAME: str = "gemini-3.8-flash"

settings = Settings()