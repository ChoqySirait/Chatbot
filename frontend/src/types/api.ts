// TypeScript contract definitions mirroring backend Pydantic schemas (app/schemas.py)

export type SeverityLevel = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type ClassificationType =
  | 'no_major_indicator'
  | 'needs_caution'
  | 'high_risk'
  | 'inconclusive';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type AnalysisType = 'url' | 'message' | 'image' | 'hybrid';

export interface AnalysisFinding {
  rule_id: string;
  title: string;
  severity: SeverityLevel;
  evidence: string;
  source: string;
  observed_at: string;
  explanation?: string;
  limitations: string[];
}

export interface CanonicalAnalysisResult {
  analysis_id: string;
  analysis_type: AnalysisType;
  classification: ClassificationType;
  risk_score: number;
  score_semantics: string;
  confidence: ConfidenceLevel;
  findings: AnalysisFinding[];
  mitre_techniques: string[];
  recommended_actions: string[];
  limitations: string[];
  provider_status: Record<string, unknown>;
}

export interface NetworkIntel {
  resolved_ip?: string;
  status_code?: number;
  redirect_hops?: number;
  redirect_chain?: string[];
  server_header?: string;
  ssl_issuer?: string;
  ssl_expiry?: string;
  ssl_fingerprint_sha256?: string;
  rdap_domain_age_days?: number;
  rdap_creation_date?: string;
  rdap_registrar?: string;
  [key: string]: unknown;
}

export interface HeuristicResult {
  has_suspicious_elements: boolean;
  inspection_performed: boolean;
  inspected_urls_count: number;
  detected_urls: string[];
  defanged_urls: string[];
  risk_flags: string[];
  heuristic_score: number;
  network_intel?: NetworkIntel;
  multi_network_intel?: NetworkIntel[];
  evidence_hash?: string;
  canonical_result?: CanonicalAnalysisResult;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  heuristics?: HeuristicResult;
  canonical_result?: CanonicalAnalysisResult;
  mitre_tags?: string[];
  threat_category?: string;
}

export interface ChatResponse {
  reply: string;
  heuristics?: HeuristicResult;
  mitre_tags: string[];
  threat_category: string;
  canonical_result?: CanonicalAnalysisResult;
}

// Local-First Storage Types (Dexie.js IndexedDB)
export interface IncidentCase {
  id?: number;
  caseId: string; // e.g. "SEC-2026-001"
  title: string;
  createdAt: string;
  updatedAt: string;
  status: 'open' | 'investigating' | 'resolved';
  severity: SeverityLevel;
  incidentType: 'phishing' | 'financial_fraud' | 'apk_scam' | 'account_takeover' | 'malvertising' | 'other';
  reporter: string;
  summary: string;
  notes: string;
  tags: string[];
  assignedAnalysisIds: string[];
}

export interface IncidentTimelineEvent {
  id?: number;
  incidentId: string;
  timestamp: string;
  source: 'user' | 'analyzer' | 'osint' | 'manual';
  action: string;
  description: string;
  evidenceRef?: string;
  severity?: SeverityLevel;
}

export interface EvidenceItem {
  id?: number;
  evidenceId: string;
  incidentId?: string;
  name: string;
  artifactType: 'url' | 'message_text' | 'screenshot' | 'file_hash' | 'raw_headers' | 'manifest';
  contentPreview: string;
  sha256Hash: string;
  sizeBytes: number;
  mimeType: string;
  capturedAt: string;
  manifestDeterministicHash?: string;
  metadata?: Record<string, unknown>;
}

export interface StoredAnalysisRecord {
  id?: number;
  analysisId: string;
  createdAt: string;
  inputType: 'url' | 'message' | 'file' | 'screenshot';
  inputSummary: string;
  classification: ClassificationType;
  riskScore: number;
  canonicalResult: CanonicalAnalysisResult;
  networkIntel?: NetworkIntel;
  evidenceHash?: string;
}
