import React, { useState } from 'react';
import {
  Terminal,
  Activity,
  Globe,
  Copy,
  Check,
  Code2,
  FolderPlus,
  KeyRound,
  FileCheck2,
} from 'lucide-react';
import type { CanonicalAnalysisResult, NetworkIntel } from '../../types/api';
import { useLanguage } from '../../context/useLanguage';

interface AnalystViewProps {
  result: CanonicalAnalysisResult;
  networkIntel?: NetworkIntel;
  evidenceHash?: string;
  onSaveEvidence: () => void;
  onLinkCase: () => void;
}

export const AnalystView: React.FC<AnalystViewProps> = ({
  result,
  networkIntel,
  evidenceHash,
  onSaveEvidence,
  onLinkCase,
}) => {
  const { t, language } = useLanguage();
  const [showJson, setShowJson] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Telemetry & Score Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Risk Score */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider truncate">
              {t.analyzeTab.scoreLabel}
            </span>
            <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
          </div>
          <div className="my-2">
            <span className={`text-3xl font-extrabold font-mono ${
              result.risk_score >= 60 ? 'text-rose-400' : result.risk_score >= 30 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {result.risk_score}
            </span>
            <span className="text-xs text-slate-500 font-mono"> / 100</span>
          </div>
          <span className="text-[10px] text-slate-500 leading-tight">
            {t.analyzeTab.scoreHelp}
          </span>
        </div>

        {/* Classification */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between min-w-0">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            {language === 'en' ? 'Classification' : 'Klasifikasi'}
          </span>
          <div className="my-2 min-w-0">
            <span className="text-xs font-bold font-mono uppercase px-2 py-1 rounded bg-slate-800 text-cyan-300 border border-slate-700 inline-block max-w-full break-all leading-tight">
              {result.classification}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            {language === 'en' ? 'Type' : 'Tipe'}: <span className="font-mono text-cyan-400">{result.analysis_type}</span>
          </span>
        </div>

        {/* Confidence Level */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between min-w-0">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider truncate">
            {t.analyzeTab.confidenceLabel}
          </span>
          <div className="my-2">
            <span className={`text-sm font-bold font-mono uppercase px-2.5 py-1 rounded inline-block ${
              result.confidence === 'high' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'bg-slate-800 text-slate-300'
            }`}>
              {result.confidence}
            </span>
          </div>
          <span className="text-[10px] text-slate-500">
            Engine: Dual Heuristic + Gemini
          </span>
        </div>

        {/* Quick Action Controls */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-2 min-w-0">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            SOC Actions
          </span>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={onSaveEvidence}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
              <span>{language === 'en' ? 'Save Evidence (SHA-256)' : 'Simpan Bukti (SHA-256)'}</span>
            </button>

            <button
              type="button"
              onClick={onLinkCase}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-medium border border-slate-700 transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'Attach to Case' : 'Lampirkan ke Kasus'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cryptographic Manifest Hash Seal if available */}
      {evidenceHash && (
        <div className="bg-slate-950 p-3.5 rounded-xl border border-cyan-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileCheck2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400 block">
                Evidence Manifest SHA-256 Seal
              </span>
              <span className="font-mono text-xs text-slate-300 truncate block select-all">
                {evidenceHash}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleCopyHash(evidenceHash)}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono shrink-0"
          >
            {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedHash ? t.common.copied : t.evidenceTab.btnCopyHash}</span>
          </button>
        </div>
      )}

      {/* MITRE ATT&CK Tactics & Techniques */}
      {result.mitre_techniques && result.mitre_techniques.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-purple-400" />
            <span>{t.analyzeTab.mitreTitle}</span>
          </h4>

          <div className="flex flex-wrap gap-2">
            {result.mitre_techniques.map((tech, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-800/80 text-xs font-mono text-purple-300"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Network Telemetry Inspection Details */}
      {networkIntel && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>{t.analyzeTab.telemetryTitle}</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 min-w-0">
              <div className="flex justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-500 shrink-0">Resolved IP:</span>
                <span className="text-cyan-300 font-semibold truncate">{networkIntel.resolved_ip || 'N/A'}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-500 shrink-0">HTTP Status:</span>
                <span className="text-slate-200">{networkIntel.status_code || 'N/A'}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-500 shrink-0">Server Header:</span>
                <span className="text-slate-200 truncate">{networkIntel.server_header || 'N/A'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 shrink-0">Redirect Hops:</span>
                <span className="text-slate-200">{networkIntel.redirect_hops ?? 0}</span>
              </div>
            </div>

            <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 min-w-0">
              <div className="flex justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-500 shrink-0">SSL Issuer:</span>
                <span className="text-slate-200 truncate">{networkIntel.ssl_issuer || 'N/A'}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-500 shrink-0">SSL Expiry:</span>
                <span className="text-slate-200 truncate">{networkIntel.ssl_expiry || 'N/A'}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-500 shrink-0">RDAP Domain Age:</span>
                <span className="text-slate-200">
                  {networkIntel.rdap_domain_age_days !== undefined
                    ? `${networkIntel.rdap_domain_age_days} days`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 shrink-0">Registrar:</span>
                <span className="text-slate-200 truncate">{networkIntel.rdap_registrar || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Multi-Hop Redirect Chain */}
          {networkIntel.redirect_chain && networkIntel.redirect_chain.length > 1 && (
            <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                Redirect Route (SSRF Validated):
              </span>
              {networkIntel.redirect_chain.map((hop, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-300 truncate">
                  <span className="text-cyan-400 font-bold">{i}</span>
                  <span className="text-slate-500">→</span>
                  <span className="truncate">{hop}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Structured Findings Table */}
      {result.findings && result.findings.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {t.analyzeTab.findingsTitle} ({result.findings.length})
          </h4>

          <div className="space-y-2">
            {result.findings.map((f, idx) => (
              <div
                key={idx}
                className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-cyan-400 font-bold bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/60 text-[10px] shrink-0">
                      {f.rule_id}
                    </span>
                    <span className="font-semibold text-white">{f.title}</span>
                  </div>
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    f.severity === 'critical' || f.severity === 'high'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {f.severity}
                  </span>
                </div>
                <div className="font-mono text-slate-300 text-[11px] pt-1 break-words">
                  Evidence: {f.evidence}
                </div>
                {f.limitations && f.limitations.length > 0 && (
                  <div className="text-[10px] text-slate-500 italic break-words">
                    Limitation: {f.limitations.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw Canonical JSON Toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowJson(!showJson)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-mono"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>
              {showJson
                ? (language === 'en' ? 'Hide Raw JSON' : 'Sembunyikan Raw JSON')
                : (language === 'en' ? 'Show Canonical JSON Schema' : 'Tampilkan Canonical JSON Schema')}
            </span>
          </button>

          {showJson && (
            <button
              type="button"
              onClick={handleCopyJson}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-mono"
            >
              {copiedJson ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedJson ? t.common.copied : t.common.copy} JSON</span>
            </button>
          )}
        </div>

        {showJson && (
          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-96 max-w-full">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};
