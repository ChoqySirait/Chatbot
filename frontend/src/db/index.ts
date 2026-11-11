import Dexie, { type EntityTable } from 'dexie';
import type {
  IncidentCase,
  IncidentTimelineEvent,
  EvidenceItem,
  StoredAnalysisRecord,
} from '../types/api';

// Initialize SecurAI Local-First IndexedDB database
export class SecurAIDatabase extends Dexie {
  incidents!: EntityTable<IncidentCase, 'id'>;
  timeline!: EntityTable<IncidentTimelineEvent, 'id'>;
  evidence!: EntityTable<EvidenceItem, 'id'>;
  analysisHistory!: EntityTable<StoredAnalysisRecord, 'id'>;

  constructor() {
    super('securai_local_vault');

    this.version(1).stores({
      incidents: '++id, caseId, status, severity, incidentType, createdAt, updatedAt',
      timeline: '++id, incidentId, timestamp, source',
      evidence: '++id, evidenceId, incidentId, artifactType, sha256Hash, capturedAt',
      analysisHistory: '++id, analysisId, createdAt, inputType, classification, riskScore',
    });
  }
}

export const db = new SecurAIDatabase();

// Client-side Web Crypto API SHA-256 calculation for binary buffers
export async function computeBufferSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Client-side Web Crypto API SHA-256 calculation for strings
export async function computeClientSha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return computeBufferSha256(data.buffer);
}

// Canonical JSON serialization for deterministic manifest verification
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalJsonStringify(item)).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJsonStringify((obj as Record<string, unknown>)[key])}`
  );
  return '{' + pairs.join(',') + '}';
}

// Export single incident case bundle as JSON
export async function exportIncidentCasePackage(caseId: string): Promise<string> {
  const incident = await db.incidents.where('caseId').equals(caseId).first();
  if (!incident) {
    throw new Error(`Incident ${caseId} not found`);
  }

  const timelineEvents = await db.timeline.where('incidentId').equals(caseId).toArray();
  const evidenceItems = await db.evidence.where('incidentId').equals(caseId).toArray();

  const casePackage = {
    packageVersion: '1.0',
    exportedAt: new Date().toISOString(),
    incident,
    timeline: timelineEvents,
    evidence: evidenceItems,
  };

  const canonical = canonicalJsonStringify(casePackage);
  const integritySeal = await computeClientSha256(canonical);

  const finalPackage = {
    ...casePackage,
    integritySealSha256: integritySeal,
  };

  return JSON.stringify(finalPackage, null, 2);
}

// Import incident case bundle from JSON
export async function importIncidentCasePackage(jsonContent: string): Promise<string> {
  const parsed = JSON.parse(jsonContent);
  if (!parsed.incident || !parsed.incident.caseId) {
    throw new Error('Invalid SecurAI case package format: missing incident metadata');
  }

  const existing = await db.incidents.where('caseId').equals(parsed.incident.caseId).first();
  const incidentToSave: IncidentCase = {
    ...parsed.incident,
    id: undefined, // Let IndexedDB generate new primary key or overwrite
    updatedAt: new Date().toISOString(),
  };

  if (existing && existing.id) {
    await db.incidents.put({ ...incidentToSave, id: existing.id });
  } else {
    await db.incidents.add(incidentToSave);
  }

  if (Array.isArray(parsed.timeline)) {
    for (const event of parsed.timeline) {
      await db.timeline.add({ ...event, id: undefined });
    }
  }

  if (Array.isArray(parsed.evidence)) {
    for (const item of parsed.evidence) {
      await db.evidence.add({ ...item, id: undefined });
    }
  }

  return parsed.incident.caseId;
}

// Complete local vault wipe
export async function purgeAllLocalVault(): Promise<void> {
  await db.incidents.clear();
  await db.timeline.clear();
  await db.evidence.clear();
  await db.analysisHistory.clear();
}
