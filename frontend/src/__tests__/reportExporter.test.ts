import { describe, it, expect } from 'vitest';
import { generateMarkdownDossier } from '../utils/reportExporter';
import type { EvidenceItem, IncidentCase, IncidentTimelineEvent } from '../types/api';

const sampleIncident: IncidentCase = {
  caseId: 'INC-2026-001',
  title: 'Fake Bank Fee Notice',
  incidentType: 'phishing',
  severity: 'high',
  status: 'open',
  reporter: 'Test User',
  summary: 'Suspicious SMS link impersonating bank domain.',
  notes: 'Blocked card and reported handle.',
  tags: ['phishing'],
  assignedAnalysisIds: [],
  createdAt: '2026-11-12T08:00:00.000Z',
  updatedAt: '2026-11-12T08:30:00.000Z',
};

const sampleTimeline: IncidentTimelineEvent[] = [
  {
    incidentId: 'INC-2026-001',
    timestamp: '2026-11-12T08:05:00.000Z',
    action: 'URL Inspected',
    description: 'Flagged lookalike domain',
    source: 'analyzer',
  },
];

const sampleEvidence: EvidenceItem[] = [
  {
    evidenceId: 'EV-001',
    incidentId: 'INC-2026-001',
    artifactType: 'url',
    name: 'bca-tarif-promo.top',
    contentPreview: 'https://bca-tarif-promo.top',
    sha256Hash: 'a'.repeat(64),
    mimeType: 'text/plain',
    sizeBytes: 25,
    capturedAt: '2026-11-12T08:06:00.000Z',
  },
];

describe('reportExporter (REP-01 / REP-02 / REP-03)', () => {
  it('generates Indonesian dossier with full SHA-256 seal and disclaimer', async () => {
    const md = await generateMarkdownDossier({
      incident: sampleIncident,
      timeline: sampleTimeline,
      evidence: sampleEvidence,
      locale: 'id',
    });

    expect(md).toContain('LAPORAN FORENSIK INSIDEN');
    expect(md).toContain('INC-2026-001');
    expect(md).toContain('a'.repeat(64));
    expect(md).toContain('PERNYATAAN INTEGRITAS & BATASAN HUKUM');
  });

  it('generates English dossier cleanly when locale is en', async () => {
    const md = await generateMarkdownDossier({
      incident: sampleIncident,
      timeline: sampleTimeline,
      evidence: sampleEvidence,
      locale: 'en',
    });

    expect(md).toContain('FORENSIC INCIDENT DOSSIER');
    expect(md).toContain('EXECUTIVE SUMMARY');
    expect(md).toContain('INC-2026-001');
    expect(md).toContain('bca-tarif-promo.top');
  });
});
