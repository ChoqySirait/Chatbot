import { describe, expect, it } from 'vitest';
import { inspectLocalBinaryFile } from '../utils/fileInspector';

describe('Local Binary File & Magic-Byte Inspector (Zero Upload)', () => {
  it('flags Android APK packages as high_risk without external transfer', async () => {
    const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const file = new File([zipHeader], 'Undangan_Resmi.apk', {
      type: 'application/vnd.android.package-archive',
    });

    const result = await inspectLocalBinaryFile(file);
    expect(result.sha256Hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.canonicalResult.classification).toBe('high_risk');
    expect(result.canonicalResult.risk_score).toBeGreaterThanOrEqual(75);
    expect(result.canonicalResult.provider_status?.external_data_sent).toBe(false);
    expect(result.canonicalResult.findings.some((f) => f.rule_id === 'FILE-EXT-APK-001')).toBe(true);
  });

  it('detects Windows MZ executables masquerading as PDF documents', async () => {
    const peHeader = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    const file = new File([peHeader], 'Surat_Tilang.pdf', {
      type: 'application/pdf',
    });

    const result = await inspectLocalBinaryFile(file);
    expect(result.canonicalResult.classification).toBe('high_risk');
    expect(result.canonicalResult.risk_score).toBeGreaterThanOrEqual(90);
    expect(result.canonicalResult.findings.some((f) => f.rule_id === 'FILE-SPOOF-MAGIC-001')).toBe(true);
    expect(result.canonicalResult.mitre_techniques.some((t) => t.includes('T1036.007'))).toBe(true);
  });

  it('processes valid PNG bytes conservatively with zero masquerading flags', async () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([pngHeader], 'evidence.png', { type: 'image/png' });

    const result = await inspectLocalBinaryFile(file);
    expect(result.detectedMagicType).toBe('PNG Image');
    expect(result.canonicalResult.risk_score).toBeLessThan(20);
    expect(result.canonicalResult.findings.some((f) => f.rule_id === 'FILE-SPOOF-MAGIC-001')).toBe(false);
  });
});
