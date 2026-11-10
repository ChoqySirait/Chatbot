import React, { useState } from 'react';
import {
  Search,
  MessageSquare,
  Globe,
  FileCode,
  Send,
  Loader2,
  Shield,
  FolderPlus,
  Sparkles,
  Link2,
} from 'lucide-react';
import type {
  CanonicalAnalysisResult,
  ChatResponse,
  NetworkIntel,
} from '../../types/api';
import { db, computeClientSha256 } from '../../db';
import { useLanguage } from '../../context/LanguageContext';
import { useMode } from '../../context/ModeContext';
import { ConsumerView } from './ConsumerView';
import { AnalystView } from './AnalystView';

interface AnalyzeWorkspaceProps {
  onSwitchTab: (tab: 'incidents' | 'evidence' | 'reports') => void;
}

export const AnalyzeWorkspace: React.FC<AnalyzeWorkspaceProps> = ({ onSwitchTab }) => {
  const { t } = useLanguage();
  const { mode } = useMode();

  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'url' | 'message' | 'file'>('chat');

  // Input states
  const [chatInput, setChatInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [fileHashInput, setFileHashInput] = useState('');
  const [fileName, setFileName] = useState('');

  // Execution states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chat message history
  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; content: string; canonical?: CanonicalAnalysisResult }[]
  >([
    {
      role: 'assistant',
      content:
        'Halo! Saya asisten SecurAI. Anda dapat menempelkan tautan mencurigakan, pesan SMS/WhatsApp penipuan, atau menceritakan kendala keamanan yang sedang dihadapi.',
    },
  ]);

  // Active analysis results
  const [currentResult, setCurrentResult] = useState<CanonicalAnalysisResult | null>(null);
  const [currentTelemetry, setCurrentTelemetry] = useState<NetworkIntel | undefined>(undefined);
  const [currentEvidenceHash, setCurrentEvidenceHash] = useState<string | undefined>(undefined);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [casesList, setCasesList] = useState<{ id?: number; caseId: string; title: string }[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');

  // Utility: Defang URL
  const defangUrl = (url: string): string => {
    return url
      .replace(/http:\/\//gi, 'hxxp://')
      .replace(/https:\/\//gi, 'hxxps://')
      .replace(/\./g, '[.]');
  };

  // Action: Analyze Chat
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || loading) return;

    const userText = chatInput.trim();
    setChatInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      const historyPayload = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, history: historyPayload }),
      });

      if (!res.ok) {
        throw new Error(`API Error (${res.status})`);
      }

      const data: ChatResponse = await res.json();
      const canonical = data.canonical_result || undefined;
      const intel = data.heuristics?.network_intel || undefined;
      const evHash = data.heuristics?.evidence_hash || undefined;

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply, canonical },
      ]);

      if (canonical) {
        setCurrentResult(canonical);
        setCurrentTelemetry(intel);
        setCurrentEvidenceHash(evHash);
      }
    } catch (err) {
      setError(`Gagal menghubungi server analisis: ${err}`);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Maaf, terjadi kendala komunikasi dengan backend SecurAI. Pastikan server backend berjalan.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Action: Analyze Single URL
  const handleAnalyzeUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || loading) return;

    setLoading(true);
    setError(null);
    setCurrentResult(null);

    try {
      const res = await fetch('/api/v1/analyze/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      if (!res.ok) {
        throw new Error(`API Error (${res.status})`);
      }

      const data: CanonicalAnalysisResult = await res.json();
      setCurrentResult(data);
      const computedHash = await computeClientSha256(urlInput.trim());
      setCurrentEvidenceHash(computedHash);
    } catch (err) {
      setError(`Gagal menganalisis URL: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Action: Analyze Message
  const handleAnalyzeMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || loading) return;

    setLoading(true);
    setError(null);
    setCurrentResult(null);

    try {
      const res = await fetch('/api/v1/analyze/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageInput.trim() }),
      });

      if (!res.ok) {
        throw new Error(`API Error (${res.status})`);
      }

      const data: CanonicalAnalysisResult = await res.json();
      setCurrentResult(data);
      const computedHash = await computeClientSha256(messageInput.trim());
      setCurrentEvidenceHash(computedHash);
    } catch (err) {
      setError(`Gagal menganalisis pesan: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Action: Save Current Analysis as Evidence
  const handleSaveToEvidence = async () => {
    if (!currentResult) return;

    const content = JSON.stringify(currentResult, null, 2);
    const hash = currentEvidenceHash || (await computeClientSha256(content));
    const evidenceId = `EVD-${Date.now().toString(36).toUpperCase()}`;

    await db.evidence.add({
      evidenceId,
      name: `Analysis Evidence (${currentResult.analysis_type.toUpperCase()})`,
      artifactType: currentResult.analysis_type === 'url' ? 'url' : 'manifest',
      contentPreview: content,
      sha256Hash: hash,
      sizeBytes: new TextEncoder().encode(content).length,
      mimeType: 'application/json',
      capturedAt: new Date().toISOString(),
    });

    alert(`Artefak bukti tersimpan di Brankas dengan ID: ${evidenceId}`);
  };

  // Action: Open Case Link Modal
  const handleOpenCaseModal = async () => {
    const list = await db.incidents.toArray();
    setCasesList(list);
    if (list.length > 0) {
      setSelectedCaseId(list[0].caseId);
    }
    setShowCaseModal(true);
  };

  const handleLinkToCase = async () => {
    if (!selectedCaseId || !currentResult) return;

    await db.timeline.add({
      incidentId: selectedCaseId,
      timestamp: new Date().toISOString(),
      source: 'analyzer',
      action: 'Analysis Finding Attached',
      description: `Risk Score: ${currentResult.risk_score} | Classification: ${currentResult.classification}`,
      severity: currentResult.risk_score >= 60 ? 'high' : 'medium',
    });

    setShowCaseModal(false);
    alert(`Temuan berhasil dilampirkan ke kasus ${selectedCaseId}`);
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs: Chat Triage vs Direct Scanners */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex space-x-1 sm:space-x-2 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSubTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'chat'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat Triage AI</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('url')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'url'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Inspeksi URL</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('message')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'message'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Deteksi Pesan Phishing</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('file')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'file'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Hash Artefak & File</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {urlInput && (
            <button
              type="button"
              onClick={() => setUrlInput(defangUrl(urlInput))}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono border border-slate-700"
              title="Defang URL (hxxp://...)"
            >
              <Link2 className="w-3 h-3 text-cyan-400" />
              <span>{t.analyzeTab.btnDefang}</span>
            </button>
          )}
        </div>
      </div>

      {/* Error alert if any */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Inputs */}
        <div className="lg:col-span-5 space-y-4">
          {/* SubTab 1: Chat Triage */}
          {activeSubTab === 'chat' && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col h-[560px] overflow-hidden">
              <div className="p-3.5 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Interactive Incident Triage Assistant</span>
                </span>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/60">
                  Dual-Engine
                </span>
              </div>

              {/* Message scroll container */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-cyan-600 text-white rounded-br-none shadow-md shadow-cyan-600/20'
                          : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-bl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>

                      {/* Attached risk pill if assistant reply has canonical data */}
                      {m.canonical && (
                        <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between gap-2 text-[10px] font-mono">
                          <span className="text-cyan-300">
                            Risk: {m.canonical.risk_score}/100
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentResult(m.canonical || null)}
                            className="underline hover:text-white"
                          >
                            Buka Detail Forensik
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 p-2 font-mono">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Menganalisis indikator keamanan...</span>
                  </div>
                )}
              </div>

              {/* Input box */}
              <form onSubmit={handleSendChat} className="p-3 border-t border-slate-800 bg-slate-950/60 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ketik pertanyaan atau tempel teks penipuan..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  disabled={loading || !chatInput.trim()}
                  className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* SubTab 2: URL Inspector */}
          {activeSubTab === 'url' && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span>Inspeksi Tautan URL Mendalam</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Menganalisis SSL, DNS A/AAAA, SSRF pre-check, Brand Impersonation, dan Redirect Chain.
                </p>
              </div>

              <form onSubmit={handleAnalyzeUrl} className="space-y-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-medium">Tautan Sasaran (URL)</label>
                  <input
                    type="text"
                    required
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://contoh-domain-login.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 disabled:opacity-50 transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t.analyzeTab.btnAnalyzing}</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>{t.analyzeTab.btnAnalyze}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* SubTab 3: Message Intel */}
          {activeSubTab === 'message' && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Search className="w-4 h-4 text-cyan-400" />
                  <span>Deteksi Rekayasa Sosial Pesan Teks</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Evaluasi kata kunci desakan psikologis, ancaman pemblokiran rekening, dan pola penipuan SMS/WA.
                </p>
              </div>

              <form onSubmit={handleAnalyzeMessage} className="space-y-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-medium">Teks Pesan</label>
                  <textarea
                    rows={6}
                    required
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Tempel pesan SMS atau WhatsApp yang Anda terima..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 disabled:opacity-50 transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t.analyzeTab.btnAnalyzing}</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>{t.analyzeTab.btnAnalyze}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* SubTab 4: File Hash & Seal Generator */}
          {activeSubTab === 'file' && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-cyan-400" />
                  <span>Perhitungan Hash Kriptografis SHA-256</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Hitung nilai hash SHA-256 dari teks, artefak, atau file lokal untuk integritas rantai bukti.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-medium">Nama Artefak</label>
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="misal: Surat_Tagihan_Palsu.pdf atau Pesan_WhatsApp.txt"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-medium">Isi / Metadata Artefak</label>
                  <textarea
                    rows={4}
                    value={fileHashInput}
                    onChange={(e) => setFileHashInput(e.target.value)}
                    placeholder="Tempel konten atau masukkan string representasi..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    if (!fileHashInput) return;
                    const hash = await computeClientSha256(fileHashInput);
                    setCurrentEvidenceHash(hash);
                    alert(`Hash SHA-256 Dihasilkan: ${hash}`);
                  }}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                >
                  Hitung SHA-256
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Mode-Specific Output View */}
        <div className="lg:col-span-7">
          {currentResult ? (
            mode === 'consumer' ? (
              <ConsumerView
                result={currentResult}
                onSaveEvidence={handleSaveToEvidence}
                onDraftDispute={() => onSwitchTab('reports')}
              />
            ) : (
              <AnalystView
                result={currentResult}
                networkIntel={currentTelemetry}
                evidenceHash={currentEvidenceHash}
                onSaveEvidence={handleSaveToEvidence}
                onLinkCase={handleOpenCaseModal}
              />
            )
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-slate-900/30 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
              <Shield className="w-12 h-12 stroke-[1.2] mb-3 text-slate-600" />
              <p className="text-sm font-medium text-slate-400">Hasil Analisis Siap Ditampilkan</p>
              <p className="text-xs text-slate-600 mt-1 max-w-sm">
                Kirim pesan pada chat triage atau lakukan inspeksi URL/Pesan di kolom kiri untuk melihat hasil forensik terstruktur.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Link to Incident Case */}
      {showCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-cyan-400" />
              <span>Lampirkan ke Kasus Insiden</span>
            </h3>

            {casesList.length === 0 ? (
              <div className="text-xs text-slate-400">
                Belum ada kasus insiden. Silakan buat kasus baru di tab <strong>Kasus Insiden</strong> terlebih dahulu.
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Pilih Kasus</label>
                  <select
                    value={selectedCaseId}
                    onChange={(e) => setSelectedCaseId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                  >
                    {casesList.map((c) => (
                      <option key={c.caseId} value={c.caseId}>
                        [{c.caseId}] {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCaseModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg"
              >
                Batal
              </button>
              {casesList.length > 0 && (
                <button
                  type="button"
                  onClick={handleLinkToCase}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg"
                >
                  Lampirkan
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
