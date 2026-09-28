from pydantic import BaseModel, Field
from typing import List, Optional, Literal

class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=5000)

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    history: List[Message] = Field(default_factory=list)
    image_base64: Optional[str] = None  # Format data URI / base64 string

class HeuristicResult(BaseModel):
    has_suspicious_elements: bool
    detected_urls: List[str] = Field(default_factory=list)
    defanged_urls: List[str] = Field(default_factory=list)
    risk_flags: List[str] = Field(default_factory=list)
    heuristic_score: int
    web_accessible: Optional[bool] = None
    web_title: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    heuristics: Optional[HeuristicResult] = None
    mitre_tags: List[str] = Field(default_factory=list)
    threat_category: Literal["Resmi/Aman", "Ilegal (Risiko Iklan/Malvertising)", "Aktif Berbahaya (Malicious)", "Informasi Umum"] = "Informasi Umum"