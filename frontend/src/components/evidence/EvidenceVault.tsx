import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  Trash2,
  FileCode,
  Globe,
  MessageSquare,
  FileText,
  Hash,
} from 'lucide-react';
import { db, computeClientSha256 } from '../../db';
import type { EvidenceItem } from '../../types/api';
import { useLanguage } from '../../context/useLanguage';

export const EvidenceVault: React.FC = () => {
  const { t, language } = useLanguage();
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<Record<string, 'valid' | 'tampered' | null>>({});

  const loadEvidence = async () => {
    const list = await db.evidence.reverse().sortBy('capturedAt');
    setEvidenceList(list);
  };

  useEffect(() => {
    let active = true;
    db.evidence
      .reverse()
      .sortBy('capturedAt')
      .then((list) => {
        if (active) {
          setEvidenceList(list);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleVerifyIntegrity = async (item: EvidenceItem) => {
    if (!item.contentPreview) {
      setVerificationStatus((prev) => ({ ...prev, [item.evidenceId]: 'tampered' }));
      return;
    }
    const computed = await computeClientSha256(item.contentPreview);
    const isValid = computed.toLowerCase() === item.sha256Hash.toLowerCase();
    setVerificationStatus((prev) => ({
      ...prev,
      [item.evidenceId]: isValid ? 'valid' : 'tampered',
    }));
  };

  const handleDelete = async (id: number) => {
    const msg =
      language === 'en'
        ? 'Delete this evidence artifact from your local vault?'
        : 'Hapus artefak bukti ini dari brankas lokal?';
    if (!confirm(msg)) return;
    await db.evidence.delete(id);
    await loadEvidence();
  };

  const getArtifactIcon = (type: EvidenceItem['artifactType']) => {
    switch (type) {
      case 'url':
        return <Globe className="w-4 h-4 text-cyan-400" />;
      case 'message_text':
        return <MessageSquare className="w-4 h-4 text-blue-400" />;
      case 'manifest':
        return <FileCode className="w-4 h-4 text-emerald-400" />;
      default:
        return <FileText className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-cyan-400" />
            <span>{t.evidenceTab.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{t.evidenceTab.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-xs text-cyan-300 font-mono">
          <Hash className="w-3.5 h-3.5" />
          <span>Total Artefak: {evidenceList.length}</span>
        </div>
      </div>

      {/* Evidence Cards */}
      {evidenceList.length === 0 ? (
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
          <ShieldCheck className="w-12 h-12 stroke-[1.2] mx-auto mb-3 text-slate-600" />
          <p className="text-sm font-medium text-slate-400">{t.evidenceTab.emptyEvidence}</p>
          <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
            Artefak URL, pesan teks, atau hash file yang Anda periksa di tab Analisis dapat disegel dan disimpan ke dalam brankas ini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {evidenceList.map((item) => {
            const status = verificationStatus[item.evidenceId];
            return (
              <div
                key={item.evidenceId}
                className="bg-slate-900/40 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 space-y-3 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-slate-800">
                      {getArtifactIcon(item.artifactType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">{item.name}</span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {item.artifactType}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        ID: {item.evidenceId} • {new Date(item.capturedAt).toUTCString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleVerifyIntegrity(item)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        status === 'valid'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                          : status === 'tampered'
                          ? 'bg-rose-950 text-rose-300 border-rose-700'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>
                        {status === 'valid'
                          ? (language === 'en' ? 'Verified Intact' : 'Terverifikasi Utuh')
                          : status === 'tampered'
                          ? (language === 'en' ? 'Integrity Mismatch' : 'Integritas Tidak Cocok')
                          : (language === 'en' ? 'Verify SHA-256' : 'Verifikasi SHA-256')}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => item.id && handleDelete(item.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 border border-slate-700"
                      title={language === 'en' ? 'Delete Evidence' : 'Hapus Bukti'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Content Preview */}
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    {language === 'en' ? 'Artifact Preview' : 'Isi Cuplikan Artefak'}
                  </div>
                  <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                    {item.contentPreview}
                  </pre>
                </div>

                {/* Cryptographic SHA-256 Seal */}
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider block mb-0.5">
                      {language === 'en' ? 'SHA-256 Seal (64-Hex Characters)' : 'Segel SHA-256 (64-Hex Characters)'}
                    </span>
                    <span className="font-mono text-xs text-slate-300 break-all select-all">
                      {item.sha256Hash}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(item.sha256Hash, item.evidenceId)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors shrink-0"
                  >
                    {copiedId === item.evidenceId ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t.common.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t.evidenceTab.btnCopyHash}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Size & MIME */}
                <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
                  <span>{language === 'en' ? 'Size' : 'Ukuran'}: {item.sizeBytes} bytes</span>
                  <span>MIME: {item.mimeType}</span>
                  {item.incidentId && <span>{language === 'en' ? 'Case' : 'Terkait Kasus'}: {item.incidentId}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
