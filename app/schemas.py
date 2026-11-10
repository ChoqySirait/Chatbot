from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any

# Blok model data pesan percakapan
class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=5000)

# Blok skema permintaan dari frontend
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    history: List[Message] = Field(default_factory=list)
    image_base64: Optional[str] = None

# Blok model temuan terstruktur kanonis (Epic 2: ANA-01)
class AnalysisFinding(BaseModel):
    rule_id: str
    title: str
    severity: Literal["info", "low", "medium", "high", "critical"]
    evidence: str
    source: str
    observed_at: str
    explanation: Optional[str] = None
    limitations: List[str] = Field(default_factory=list)

# Blok skema hasil analisis kanonis standar (Epic 2: ANA-01 & Section 5.5)
class CanonicalAnalysisResult(BaseModel):
    analysis_id: str
    analysis_type: Literal["url", "message", "image", "hybrid"] = "hybrid"
    classification: Literal["no_major_indicator", "needs_caution", "high_risk", "inconclusive"] = "no_major_indicator"
    risk_score: int = Field(ge=0, le=100)
    score_semantics: str = "internal_indicator_score_not_probability"
    confidence: Literal["low", "medium", "high"] = "medium"
    findings: List[AnalysisFinding] = Field(default_factory=list)
    mitre_techniques: List[str] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    provider_status: Dict[str, Any] = Field(default_factory=dict)

# Blok skema hasil telemetri keamanan lokal (kompatibilitas backward)
class HeuristicResult(BaseModel):
    has_suspicious_elements: bool
    inspection_performed: bool = False
    inspected_urls_count: int = 0
    detected_urls: List[str] = Field(default_factory=list)
    defanged_urls: List[str] = Field(default_factory=list)
    risk_flags: List[str] = Field(default_factory=list)
    heuristic_score: int
    network_intel: Optional[Dict[str, Any]] = None
    multi_network_intel: List[Dict[str, Any]] = Field(default_factory=list)
    evidence_hash: Optional[str] = None
    canonical_result: Optional[CanonicalAnalysisResult] = None

# Blok skema respons API ke browser (kompatibilitas penuh)
class ChatResponse(BaseModel):
    reply: str
    heuristics: Optional[HeuristicResult] = None
    mitre_tags: List[str] = Field(default_factory=list)
    threat_category: Literal["Resmi/Aman", "Ilegal (Risiko Iklan/Malvertising)", "Aktif Berbahaya (Malicious)", "Informasi Umum"] = "Informasi Umum"
    canonical_result: Optional[CanonicalAnalysisResult] = None
