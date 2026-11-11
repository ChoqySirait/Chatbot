import { computeBufferSha256 } from '../db';
import type { AnalysisFinding, CanonicalAnalysisResult } from '../types/api';

const DANGEROUS_EXTENSIONS = new Set([
  'apk',
  'exe',
  'msi',
  'bat',
  'cmd',
  'ps1',
  'vbs',
  'js',
  'scr',
  'jar',
  'com',
  'hta',
]);

const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'png', 'jpg', 'jpeg']);

export interface LocalFileInspectionOutput {
  sha256Hash: string;
  detectedMagicType: string;
  sizeBytes: number;
  canonicalResult: CanonicalAnalysisResult;
  evidencePreview: string;
}

function sniffMagicSignature(bytes: Uint8Array): { label: string; isExecutable: boolean; isArchive: boolean } {
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) {
    return { label: 'Windows PE / Executable (MZ)', isExecutable: true, isArchive: false };
  }
  if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
    return { label: 'ELF Executable Binary', isExecutable: true, isArchive: false };
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return { label: 'ZIP / Android APK / OOXML Archive (PK)', isExecutable: false, isArchive: true };
  }
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return { label: 'PDF Document (%PDF-)', isExecutable: false, isArchive: false };
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { label: 'PNG Image', isExecutable: false, isArchive: false };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { label: 'JPEG Image', isExecutable: false, isArchive: false };
  }
  return { label: 'Generic Text / Unknown Binary', isExecutable: false, isArchive: false };
}

export async function inspectLocalBinaryFile(file: File): Promise<LocalFileInspectionOutput> {
  const MAX_CLIENT_HASH_BYTES = 50 * 1024 * 1024;
  if (file.size > MAX_CLIENT_HASH_BYTES) {
    throw new Error('Ukuran berkas melebihi batas pemeriksaan browser 50 MB.');
  }

  const buffer = await file.arrayBuffer();
  const sha256Hash = await computeBufferSha256(buffer);
  const headerBytes = new Uint8Array(buffer.slice(0, 16));
  const magic = sniffMagicSignature(headerBytes);

  const extMatch = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : '';
  const nowUtc = new Date().toISOString();

  const findings: AnalysisFinding[] = [
    {
      rule_id: 'FILE-HASH-LOCAL-001',
      title: 'Identitas Hash Kriptografis & Metadata Berkas Lokal',
      severity: 'info',
      evidence: `Nama=${file.name}, Ukuran=${file.size} bytes, MIME=${file.type || 'unknown'}, Signature=${magic.label}, SHA-256=${sha256Hash}`,
      source: 'Browser Web Crypto API (Local-Only)',
      observed_at: nowUtc,
      explanation: 'Hash SHA-256 dan pemeriksaan signature header dilakukan sepenuhnya di perangkat Anda tanpa mengunggah isi berkas.',
      limitations: ['Hash unik mengidentifikasi berkas secara persis; reputasi eksternal VirusTotal tidak dikueri otomatis.'],
    },
  ];

  const mitreTechniques: string[] = [];
  let riskScore = 5;
  let classification: CanonicalAnalysisResult['classification'] = 'inconclusive';

  if (ext === 'apk') {
    riskScore = 75;
    classification = 'high_risk';
    mitreTechniques.push('MITRE T1417 / T1204.002 (Malicious Installer)');
    findings.push({
      rule_id: 'FILE-EXT-APK-001',
      title: 'Berkas Installer Android (.APK) Berisiko Tinggi jika dari Luar Play Store',
      severity: 'high',
      evidence: `Ekstensi=.${ext} (${magic.label})`,
      source: 'Static Extension & Magic-Byte Guard',
      observed_at: nowUtc,
      explanation: 'File APK dari WhatsApp/Telegram sering digunakan dalam penipuan undangan nikah/resi kurir untuk mencuri SMS OTP m-banking.',
      limitations: ['Pemeriksaan statis header tidak mendekompile isi AndroidManifest atau kode DEX.'],
    });
  } else if (DANGEROUS_EXTENSIONS.has(ext) || magic.isExecutable) {
    riskScore = 65;
    classification = 'needs_caution';
    mitreTechniques.push('MITRE T1204.002 (User Execution: Malicious File)');
    findings.push({
      rule_id: 'FILE-EXEC-RISK-001',
      title: 'Berkas Eksekusi / Skrip Terdeteksi',
      severity: 'high',
      evidence: `Ekstensi=.${ext || 'none'}, Signature=${magic.label}`,
      source: 'Static Extension & Magic-Byte Guard',
      observed_at: nowUtc,
      explanation: 'Berkas ini mengandung format yang dapat mengeksekusi kode di sistem operasi bila dijalankan.',
      limitations: ['Belum ada sandbox dinamis pada browser untuk menjalankan isi biner secara aman.'],
    });
  }

  // Extension vs Magic-byte masquerading check (e.g., .pdf/.jpg containing MZ executable header)
  if (DOCUMENT_EXTENSIONS.has(ext) && magic.isExecutable) {
    riskScore = 90;
    classification = 'high_risk';
    mitreTechniques.push('MITRE T1036.007 (Masquerading: Double File Extension / Spoofed Format)');
    findings.push({
      rule_id: 'FILE-SPOOF-MAGIC-001',
      title: 'Indikasi Kuat Penyamaran Tipe Berkas (Extension Masquerading)',
      severity: 'critical',
      evidence: `Nama berkas memakai ekstensi .${ext}, tetapi header biner sebenarnya adalah ${magic.label}.`,
      source: 'Magic-Byte Mismatch Detector',
      observed_at: nowUtc,
      explanation: 'Teknik klasik penyebaran malware dengan menyamarkan program eksekusi seolah-olah dokumen atau gambar.',
      limitations: [],
    });
  } else if (ext === 'pdf' && magic.label.startsWith('ZIP')) {
    riskScore = 60;
    classification = 'needs_caution';
    mitreTechniques.push('MITRE T1036 (Masquerading)');
    findings.push({
      rule_id: 'FILE-MISMATCH-ZIPPDF-001',
      title: 'Header Biner Tidak Cocok dengan Ekstensi .PDF',
      severity: 'medium',
      evidence: `Ekstensi .pdf memiliki header arsip ZIP/APK (${magic.label}).`,
      source: 'Magic-Byte Mismatch Detector',
      observed_at: nowUtc,
      limitations: ['Pemeriksaan header statis tidak mendekompile isi dokumen.'],
    });
  }

  const canonicalResult: CanonicalAnalysisResult = {
    analysis_id: `FILE-${Date.now().toString(36).toUpperCase()}`,
    analysis_type: 'hybrid',
    classification,
    risk_score: riskScore,
    score_semantics: 'Local Static Metadata & Magic-Byte Heuristic (0-100)',
    confidence: riskScore >= 60 ? 'medium' : 'low',
    findings,
    mitre_techniques: mitreTechniques,
    recommended_actions:
      riskScore >= 60
        ? [
            'JANGAN membuka atau menginstal berkas dari pengirim yang tidak terverifikasi.',
            'Simpan hash SHA-256 ke Brankas Bukti bila diperlukan untuk pelaporan insiden.',
            'Pindai hash SHA-256 di mesin antivirus tepercaya atau VirusTotal secara terpisah jika berwenang.',
          ]
        : [
            'Pastikan keaslian pengirim melalui kanal resmi sebelum membuka dokumen.',
            'Gunakan nilai SHA-256 sebagai segel integritas lokal.',
          ],
    limitations: [
      'Pemeriksaan dilakukan 100% secara lokal di browser menggunakan metadata & magic bytes awal.',
      'Tidak melakukan pemindaian antivirus tanda tangan lengkap atau dekompilasi payload biner.',
    ],
    provider_status: {
      file_inspector: 'local_webcrypto_static',
      external_data_sent: false,
      sha256_hash: sha256Hash,
    },
  };

  return {
    sha256Hash,
    detectedMagicType: magic.label,
    sizeBytes: file.size,
    canonicalResult,
    evidencePreview: JSON.stringify(
      {
        fileName: file.name,
        sizeBytes: file.size,
        declaredMime: file.type || 'unknown',
        detectedMagicType: magic.label,
        sha256Hash,
        inspectedAtUtc: nowUtc,
        canonicalSummary: {
          classification,
          risk_score: riskScore,
        },
      },
      null,
      2
    ),
  };
}
