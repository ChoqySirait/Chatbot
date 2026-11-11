import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  canonicalJsonStringify,
  computeClientSha256,
  db,
  exportIncidentCasePackage,
  importIncidentCasePackage,
  purgeAllLocalVault,
} from '../db';

describe('Local IndexedDB Vault & Cryptographic Integrity', () => {
  beforeEach(async () => {
    await purgeAllLocalVault();
  });

  it('computes a valid 64-char SHA-256 hex digest deterministically', async () => {
    const hashA = await computeClientSha256('https://example-phish.invalid/login');
    const hashB = await computeClientSha256('https://example-phish.invalid/login');
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
    expect(hashA).toBe(hashB);
  });

  it('serializes JSON canonically independent of object key order', () => {
    const obj1 = { b: 2, a: { d: 4, c: 3 }, items: [{ z: 1, a: 0 }] };
    const obj2 = { a: { c: 3, d: 4 }, items: [{ a: 0, z: 1 }], b: 2 };
    expect(canonicalJsonStringify(obj1)).toBe(canonicalJsonStringify(obj2));
  });

  it('exports sealed case bundle, detects tampering, and imports round-trip cleanly', async () => {
    const now = new Date().toISOString();
    const caseId = 'INC-TEST-001';

    await db.incidents.add({
      caseId,
      title: 'Phishing SMS Bank Demo',
      status: 'open',
      severity: 'high',
      incidentType: 'phishing',
      reporter: 'QA Tester',
      summary: 'Received spoofed SMS link.',
      notes: 'Preserve evidence.',
      tags: ['phishing', 'sms'],
      assignedAnalysisIds: [],
      createdAt: now,
      updatedAt: now,
    });

    await db.timeline.add({
      incidentId: caseId,
      timestamp: now,
      source: 'user',
      action: 'Reported SMS',
      description: 'Submitted suspicious message.',
      severity: 'high',
    });

    await db.evidence.add({
      evidenceId: 'EVD-TEST-001',
      incidentId: caseId,
      name: 'SMS Text Evidence',
      artifactType: 'message_text',
      contentPreview: 'URGENT verify account',
      sha256Hash: await computeClientSha256('URGENT verify account'),
      sizeBytes: 21,
      mimeType: 'text/plain',
      capturedAt: now,
    });

    const exportedJson = await exportIncidentCasePackage(caseId);
    const parsed = JSON.parse(exportedJson) as {
      packageVersion: string;
      exportedAt: string;
      incident: unknown;
      timeline: unknown[];
      evidence: unknown[];
      integritySealSha256: string;
    };

    expect(parsed.integritySealSha256).toMatch(/^[a-f0-9]{64}$/);

    const { integritySealSha256, ...unsignedPayload } = parsed;
    const expectedSeal = await computeClientSha256(canonicalJsonStringify(unsignedPayload));
    expect(integritySealSha256).toBe(expectedSeal);

    const tamperedPayload = {
      ...unsignedPayload,
      timeline: [],
    };
    const tamperedSeal = await computeClientSha256(canonicalJsonStringify(tamperedPayload));
    expect(tamperedSeal).not.toBe(integritySealSha256);

    await purgeAllLocalVault();
    expect(await db.incidents.count()).toBe(0);

    const restoredCaseId = await importIncidentCasePackage(exportedJson);
    expect(restoredCaseId).toBe(caseId);
    expect(await db.incidents.count()).toBe(1);
    expect(await db.timeline.count()).toBe(1);
    expect(await db.evidence.count()).toBe(1);
  });
});
