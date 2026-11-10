import type {
  IncidentCase,
  IncidentTimelineEvent,
  EvidenceItem,
  CanonicalAnalysisResult,
} from '../types/api';
import { canonicalJsonStringify, computeClientSha256 } from '../db';

export interface ForensicDossierData {
  incident: IncidentCase;
  timeline: IncidentTimelineEvent[];
  evidence: EvidenceItem[];
  analysis?: CanonicalAnalysisResult;
  locale: 'id' | 'en';
}

/**
 * Generates a comprehensive forensic incident report in Markdown format.
 * Follows professional incident response documentation standards.
 */
export async function generateMarkdownDossier(data: ForensicDossierData): Promise<string> {
  const { incident, timeline, evidence, analysis, locale } = data;
  const isId = locale === 'id';
  const nowUtc = new Date().toUTCString();

  // Compute integrity hash of the raw data bundle
  const rawPayload = canonicalJsonStringify({
    caseId: incident.caseId,
    title: incident.title,
    createdAt: incident.createdAt,
    timeline,
    evidence,
  });
  const bundleIntegrityHash = await computeClientSha256(rawPayload);

  if (isId) {
    return `# 📑 LAPORAN FORENSIK INSIDEN & DOSIR BUKTI DIGITAL
**Platform:** SecurAI Digital Trust & Threat Intelligence  
**Nomor Referensi Kasus:** \`${incident.caseId}\`  
**Waktu Pembuatan Dokumen:** ${nowUtc}  
**Status Kasus:** \`${incident.status.toUpperCase()}\` | **Tingkat Keparahan:** \`${incident.severity.toUpperCase()}\`  
**Kategori Insiden:** ${incident.incidentType}  
**Segel Integritas Bundel (SHA-256):** \`${bundleIntegrityHash}\`

---

## 1. RINGKASAN EKSEKUTIF

- **Judul Insiden:** ${incident.title}
- **Pelapor / Korban:** ${incident.reporter}
- **Tanggal Pencatatan:** ${new Date(incident.createdAt).toLocaleString('id-ID')}
- **Pembaruan Terakhir:** ${new Date(incident.updatedAt).toLocaleString('id-ID')}
- **Ringkasan Kejadian:**  
  ${incident.summary || 'Tidak ada ringkasan yang dicatat.'}

---

## 2. KRONOLOGI KEJADIAN (TIMELINE INVESTIGASI)

| No | Waktu (UTC) | Sumber | Aksi / Peristiwa | Keterangan |
|---|---|---|---|---|
${timeline.length > 0 ? timeline.map((evt, idx) => `| ${idx + 1} | ${new Date(evt.timestamp).toISOString()} | \`${evt.source}\` | **${evt.action}** | ${evt.description || '-'} |`).join('\n') : '| - | - | - | Belum ada kronologi yang dicatat. | - |'}

---

## 3. BRANKAS BUKTI DIGITAL & SEGEL KRIPTOGRAFIS (CHAIN OF CUSTODY)

Setiap artefak digital berikut dihitung nilai *hash* menggunakan algoritma kriptografi SHA-256 penuh 64-karakter heksadesimal:

| No | Nama Artefak | Tipe | Ukuran | Waktu Rekam (UTC) | Nilai Hash SHA-256 |
|---|---|---|---|---|---|
${evidence.length > 0 ? evidence.map((ev, idx) => `| ${idx + 1} | ${ev.name} | \`${ev.artifactType}\` | ${ev.sizeBytes} B | ${new Date(ev.capturedAt).toISOString()} | \`${ev.sha256Hash}\` |`).join('\n') : '| - | - | - | - | - | Belum ada artefak bukti yang disimpan. |'}

---

## 4. TEMUAN ANALISIS TEKNIS & PEMETAAN MITRE ATT&CK

${analysis ? `
- **Klasifikasi Risiko:** \`${analysis.classification.toUpperCase()}\` (Skor Indikator: ${analysis.risk_score}/100)
- **Tingkat Keyakinan:** \`${analysis.confidence.toUpperCase()}\`
- **Teknik MITRE ATT&CK Teridentifikasi:**  
  ${analysis.mitre_techniques.length > 0 ? analysis.mitre_techniques.map(t => `- \`${t}\``).join('\n  ') : '- Tidak ada teknik spesifik yang terpetakan.'}

### Temuan Terstruktur:
${analysis.findings.length > 0 ? analysis.findings.map(f => `- **[${f.rule_id}] ${f.title}** (${f.severity.toUpperCase()})\n  - *Bukti Observasi:* ${f.evidence}\n  - *Sumber Data:* ${f.source}`).join('\n') : '- Tidak ada temuan anomalistis terstruktur.'}

### Rekomendasi Tindakan Keamanan:
${analysis.recommended_actions.length > 0 ? analysis.recommended_actions.map(a => `- ${a}`).join('\n') : '- Terapkan kehati-hatian standar dan jangan bagikan kredensial.'}
` : '- Tidak ada hasil analisis kanonis yang dilampirkan langsung.'}

---

## 5. CATATAN INVESTIGATOR & TINDAK LANJUT

\`\`\`text
${incident.notes || 'Belum ada catatan investigasi tambahan.'}
\`\`\`

---

## 6. PERNYATAAN INTEGRITAS & BATASAN HUKUM (DISCLAIMER)

1. Dokumen ini dihasilkan secara otomatis oleh sistem **SecurAI On-Device Digital Trust Engine** berdasarkan data yang disimpan pada penyimpanan lokal perangkat pengguna (*Local-First Storage*).
2. Segel SHA-256 membuktikan integritas matematis berkas (bahwa artefak belum mengalami perubahan/modifikasi sejak direkam).
3. Analisis ini bersifat indikatif teknis dan asistensi pencegahan, bukan putusan pengadilan atau jaminan hukum absolut. Dokumen ini disiapkan sebagai berkas pendukung dalam pelaporan ke pihak perbankan atau Kepolisian Republik Indonesia.
`;
  }

  // English Version
  return `# 📑 FORENSIC INCIDENT DOSSIER & DIGITAL EVIDENCE REPORT
**Platform:** SecurAI Digital Trust & Threat Intelligence  
**Case Reference:** \`${incident.caseId}\`  
**Generated At:** ${nowUtc}  
**Status:** \`${incident.status.toUpperCase()}\` | **Severity:** \`${incident.severity.toUpperCase()}\`  
**Incident Type:** ${incident.incidentType}  
**Bundle Integrity Seal (SHA-256):** \`${bundleIntegrityHash}\`

---

## 1. EXECUTIVE SUMMARY

- **Incident Title:** ${incident.title}
- **Reporter / Victim:** ${incident.reporter}
- **Created Date:** ${new Date(incident.createdAt).toISOString()}
- **Last Updated:** ${new Date(incident.updatedAt).toISOString()}
- **Incident Summary:**  
  ${incident.summary || 'No summary recorded.'}

---

## 2. INCIDENT CHRONOLOGY (TIMELINE)

| No | Timestamp (UTC) | Source | Action / Event | Description |
|---|---|---|---|---|
${timeline.length > 0 ? timeline.map((evt, idx) => `| ${idx + 1} | ${new Date(evt.timestamp).toISOString()} | \`${evt.source}\` | **${evt.action}** | ${evt.description || '-'} |`).join('\n') : '| - | - | - | No timeline events recorded. | - |'}

---

## 3. DIGITAL EVIDENCE VAULT & CRYPTOGRAPHIC SEALS (CHAIN OF CUSTODY)

Each digital artifact has been computed with a full 64-character SHA-256 cryptographic hash:

| No | Artifact Name | Type | Size | Captured (UTC) | SHA-256 Hash Seal |
|---|---|---|---|---|---|
${evidence.length > 0 ? evidence.map((ev, idx) => `| ${idx + 1} | ${ev.name} | \`${ev.artifactType}\` | ${ev.sizeBytes} B | ${new Date(ev.capturedAt).toISOString()} | \`${ev.sha256Hash}\` |`).join('\n') : '| - | - | - | - | - | No evidence artifacts stored. |'}

---

## 4. TECHNICAL FINDINGS & MITRE ATT&CK MAPPING

${analysis ? `
- **Risk Classification:** \`${analysis.classification.toUpperCase()}\` (Risk Indicator Score: ${analysis.risk_score}/100)
- **Confidence Level:** \`${analysis.confidence.toUpperCase()}\`
- **MITRE ATT&CK Techniques:**  
  ${analysis.mitre_techniques.length > 0 ? analysis.mitre_techniques.map(t => `- \`${t}\``).join('\n  ') : '- No specific techniques identified.'}

### Structured Findings:
${analysis.findings.length > 0 ? analysis.findings.map(f => `- **[${f.rule_id}] ${f.title}** (${f.severity.toUpperCase()})\n  - *Observation:* ${f.evidence}\n  - *Data Source:* ${f.source}`).join('\n') : '- No structured anomalies.'}

### Recommended Actions:
${analysis.recommended_actions.length > 0 ? analysis.recommended_actions.map(a => `- ${a}`).join('\n') : '- Exercise standard caution.'}
` : '- No canonical analysis directly linked.'}

---

## 5. INVESTIGATOR NOTES

\`\`\`text
${incident.notes || 'No investigator notes added.'}
\`\`\`

---

## 6. INTEGRITY STATEMENT & LEGAL DISCLAIMER

1. This report was generated by the **SecurAI On-Device Digital Trust Engine** utilizing on-device local storage.
2. SHA-256 cryptographic hash seals prove mathematical tamper-evident integrity of recorded artifacts.
3. This technical report provides indicative forensic assistance and is not a judicial verdict. Intended for institutional submission (e.g. banking fraud desk, law enforcement).
`;
}

/**
 * Triggers a browser download of a generated text/markdown file.
 */
export function downloadFile(filename: string, content: string, mimeType = 'text/markdown'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
