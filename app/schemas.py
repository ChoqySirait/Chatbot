from pydantic import BaseModel, Field
from typing import List, Optional, Literal

class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=4000)

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: List[Message] = Field(default_factory=list)

class HeuristicResult(BaseModel):
    has_suspicious_elements: bool
    detected_urls: List[str] = Field(default_factory=list)
    risk_flags: List[str] = Field(default_factory=list)
    heuristic_score: int

class ChatResponse(BaseModel):
    reply: str
    heuristics: Optional[HeuristicResult] = None