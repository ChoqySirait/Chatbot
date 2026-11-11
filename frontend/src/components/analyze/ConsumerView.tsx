import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  CheckCircle,
  FileText,
  KeyRound,
} from 'lucide-react';
import type { CanonicalAnalysisResult, ClassificationType } from '../../types/api';
import { useLanguage } from '../../context/useLanguage';

interface ConsumerViewProps {
  result: CanonicalAnalysisResult;
  onSaveEvidence: () => void;
  onDraftDispute: () => void;
}

export const ConsumerView: React.FC<ConsumerViewProps> = ({
  result,
  onSaveEvidence,
  onDraftDispute,
}) => {
  const { t } = useLanguage();

  const getClassificationBadge = (classification: ClassificationType) => {
    switch (classification) {
      case 'no_major_indicator':
        return {
          bg: 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300',
          icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
          title: t.status.no_major_indicator,
          desc: 'Pemeriksaan otomatis tidak mendeteksi pola phishing atau domain tiruan berbahaya.',
        };
      case 'needs_caution':
        return {
          bg: 'bg-amber-950/70 border-amber-700/60 text-amber-300',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          title: t.status.needs_caution,
          desc: 'Terdapat unsur mencurigakan seperti domain baru terdaftar atau taktik desakan pesan.',
        };
      case 'high_risk':
        return {
          bg: 'bg-rose-950/70 border-rose-700/60 text-rose-300',
          icon: <ShieldAlert className="w-5 h-5 text-rose-400" />,
          title: t.status.high_risk,
          desc: 'Bahaya Tinggi! Terdeteksi indikasi kuat phishing, peniruan merek resmi, atau rekayasa sosial.',
        };
      default:
        return {
          bg: 'bg-slate-900 border-slate-700 text-slate-300',
          icon: <HelpCircle className="w-5 h-5 text-slate-400" />,
          title: t.status.inconclusive,
          desc: 'Data tidak mencukupi untuk menarik kesimpulan pasti.',
        };
    }
  };

  const badge = getClassificationBadge(result.classification);

  return (
    <div className="space-y-6">
      {/* Consumer Headline Risk Card */}
      <div className={`p-6 rounded-2xl border ${badge.bg} space-y-3 shadow-lg`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-black/30 backdrop-blur">
            {badge.icon}
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight">{badge.title}</h3>
            <p className="text-xs opacity-90 mt-0.5">{badge.desc}</p>
          </div>
        </div>

        {/* Action Buttons for Consumer */}
        <div className="pt-2 flex flex-wrap items-center gap-2">
          {result.classification === 'high_risk' && (
            <button
              type="button"
              onClick={onDraftDispute}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>{t.analyzeTab.btnGenerateDispute}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSaveEvidence}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-white text-xs font-medium border border-white/20 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Simpan Bukti (SHA-256)</span>
          </button>
        </div>
      </div>

      {/* Recommended Action Checklist */}
      {result.recommended_actions && result.recommended_actions.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-cyan-400" />
            <span>{t.analyzeTab.actionsTitle}</span>
          </h4>

          <div className="space-y-2">
            {result.recommended_actions.map((act, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-200"
              >
                <span className="font-mono text-cyan-400 font-bold shrink-0">{idx + 1}.</span>
                <span className="leading-relaxed">{act}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Structured Plain-Language Findings */}
      {result.findings && result.findings.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {t.analyzeTab.findingsTitle} ({result.findings.length})
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.findings.map((finding, idx) => (
              <div
                key={idx}
                className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-white">{finding.title}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded ${
                    finding.severity === 'critical' || finding.severity === 'high'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {finding.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {finding.explanation || finding.evidence}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 text-[11px] text-slate-500 leading-relaxed">
        {t.analyzeTab.disclaimer}
      </div>
    </div>
  );
};
