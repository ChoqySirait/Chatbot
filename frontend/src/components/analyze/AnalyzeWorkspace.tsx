import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  MessageSquare,
  Globe,
  FileCode,
  Image as ImageIcon,
  Send,
  Loader2,
  Shield,
  FolderPlus,
  Link2,
  Upload,
  CheckCircle2,
  Lock,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  CanonicalAnalysisResult,
  ChatResponse,
  NetworkIntel,
  StoredAnalysisRecord,
} from '../../types/api';
import { db, computeBufferSha256, computeClientSha256 } from '../../db';
import { inspectLocalBinaryFile } from '../../utils/fileInspector';
import { useLanguage } from '../../context/useLanguage';
import { useMode } from '../../context/useMode';
import { ConsumerView } from './ConsumerView';
import { AnalystView } from './AnalystView';
import { AnalyzeWorkspaceSkeleton } from '../common/SkeletonLoader';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  stopSpeaking,
  createSpeechRecognizer,
  type SpeechRecognitionController,
} from '../../utils/speechController';

interface AnalyzeWorkspaceProps {
  onSwitchTab: (tab: 'incidents' | 'evidence' | 'reports') => void;
  onVaultUpdated?: () => void;
}

const MAX_CLIENT_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export const AnalyzeWorkspace: React.FC<AnalyzeWorkspaceProps> = ({
  onSwitchTab,
  onVaultUpdated,
}) => {
  const { t, language } = useLanguage();
  const { mode } = useMode();

  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'url' | 'message' | 'screenshot' | 'file'>('chat');

  // Input states
  const [chatInput, setChatInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [fileHashInput, setFileHashInput] = useState('');
  const [fileName, setFileName] = useState('');
  const [localFileResultHash, setLocalFileResultHash] = useState('');

  // Screenshot analysis state (SEC-06 / AI-07)
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string>('');
  const [screenshotName, setScreenshotName] = useState<string>('');
  const [screenshotLocalHash, setScreenshotLocalHash] = useState<string>('');
  const [screenshotNote, setScreenshotNote] = useState<string>('');
  const [externalAiConsent, setExternalAiConsent] = useState<boolean>(false);

  // Execution & notification states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Chat message history
  const welcomeContent =
    language === 'en'
      ? "Hello! I'm the SecurAI triage assistant. Paste any suspicious link, scam SMS/WhatsApp message, or describe your security incident here."
      : 'Halo! Saya asisten SecurAI. Anda dapat menempelkan tautan mencurigakan, pesan SMS/WhatsApp penipuan, atau menceritakan kendala keamanan yang sedang dihadapi.';

  const [messages, setMessages] = useState<
    { id?: string; role: 'user' | 'assistant'; content: string; canonical?: CanonicalAnalysisResult }[]
  >(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: '',
    },
  ]);

  // Active analysis results
  const [currentResult, setCurrentResult] = useState<CanonicalAnalysisResult | null>(null);
  const [currentTelemetry, setCurrentTelemetry] = useState<NetworkIntel | undefined>(undefined);
  const [currentEvidenceHash, setCurrentEvidenceHash] = useState<string | undefined>(undefined);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [casesList, setCasesList] = useState<{ id?: number; caseId: string; title: string }[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Voice interaction states (VOICE-01 / VOICE-02)
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const speechRecognizerRef = useRef<SpeechRecognitionController | null>(null);

  // Clean up speech synthesis & recognition on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      speechRecognizerRef.current?.abort();
    };
  }, []);

  const handleToggleListen = () => {
    if (isListening) {
      speechRecognizerRef.current?.stop();
      setIsListening(false);
      setNotice(
        language === 'en'
          ? 'Microphone stopped.'
          : 'Perekaman mikrofon dihentikan.'
      );
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setError(
        language === 'en'
          ? 'Web Speech voice recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.'
          : 'Fitur input suara Web Speech belum didukung di browser ini. Mohon gunakan Google Chrome atau Microsoft Edge.'
      );
      return;
    }

    setError(null);
    setNotice(
      language === 'en'
        ? 'Microphone is listening... Speak your question or incident.'
        : 'Mikrofon aktif mendengarkan... Silakan ceritakan pesan atau kendala keamanan Anda.'
    );

    try {
      const recognizer = createSpeechRecognizer({
        lang: language,
        onStart: () => {
          setIsListening(true);
        },
        onEnd: () => {
          setIsListening(false);
        },
        onError: (err) => {
          setIsListening(false);
          const errorMsg = err instanceof Error ? err.message : String(err);
          setError(errorMsg);
        },
        onResult: (transcript, isFinal) => {
          setChatInput(transcript);
          if (isFinal) {
            setIsListening(false);
            setNotice(
              language === 'en'
                ? 'Voice input converted to text!'
                : 'Suara Anda berhasil diubah menjadi teks!'
            );
          }
        },
      });

      if (recognizer) {
        speechRecognizerRef.current = recognizer;
        recognizer.start();
      }
    } catch (err) {
      setIsListening(false);
      setError(
        language === 'en'
          ? `Microphone error: ${err}`
          : `Kendala mikrofon: ${err}`
      );
    }
  };

  const handleToggleSpeak = (msgId: string, textToSpeak: string) => {
    if (speakingMessageId === msgId) {
      stopSpeaking();
      setSpeakingMessageId(null);
      return;
    }

    if (!isSpeechSynthesisSupported()) {
      setError(
        language === 'en'
          ? 'Speech playback is not supported on this device/browser.'
          : 'Pemutar suara (Speech Synthesis) belum didukung pada browser ini.'
      );
      return;
    }

    setSpeakingMessageId(msgId);
    setError(null);
    const rate = Number(localStorage.getItem('securai_speech_rate') || '1.0');
    speakText(textToSpeak, {
      lang: language,
      rate,
      onStart: () => setSpeakingMessageId(msgId),
      onEnd: () => setSpeakingMessageId(null),
      onError: (err) => {
        setSpeakingMessageId(null);
        setError(
          language === 'en'
            ? `Audio playback error: ${err instanceof Error ? err.message : err}`
            : `Kendala pemutaran suara: ${err instanceof Error ? err.message : err}`
        );
      },
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const persistHistory = async (
    inputType: StoredAnalysisRecord['inputType'],
    inputSummary: string,
    canonicalResult: CanonicalAnalysisResult,
    evidenceHash?: string,
    networkIntel?: NetworkIntel
  ) => {
    try {
      await db.analysisHistory.add({
        analysisId: canonicalResult.analysis_id,
        createdAt: new Date().toISOString(),
        inputType,
        inputSummary: inputSummary.slice(0, 120),
        classification: canonicalResult.classification,
        riskScore: canonicalResult.risk_score,
        canonicalResult,
        networkIntel,
        evidenceHash,
      });
      onVaultUpdated?.();
    } catch {
      // Ignore IndexedDB persistence errors in restricted browsing contexts
    }
  };

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
    setNotice(null);
    setMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.id === 'welcome' ? welcomeContent : m.content,
      }));
      const res = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, history: historyPayload, mode, language }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.detail || `API Error (${res.status})`);
      }

      const data: ChatResponse = await res.json();
      const canonical = data.canonical_result || undefined;
      const intel = data.heuristics?.network_intel || undefined;
      const evHash = data.heuristics?.evidence_hash || undefined;
      const replyId = 'reply-' + Date.now();

      setMessages((prev) => [
        ...prev,
        { id: replyId, role: 'assistant', content: data.reply, canonical },
      ]);

      if (typeof window !== 'undefined' && localStorage.getItem('securai_auto_speak') === 'true' && data.reply) {
        setSpeakingMessageId(replyId);
        const rate = Number(localStorage.getItem('securai_speech_rate') || '1.0');
        speakText(data.reply, {
          lang: language,
          rate,
          onEnd: () => setSpeakingMessageId(null),
          onError: () => setSpeakingMessageId(null),
        });
      }

      if (canonical) {
        setCurrentResult(canonical);
        setCurrentTelemetry(intel);
        setCurrentEvidenceHash(evHash);
        await persistHistory(
          canonical.analysis_type === 'url' ? 'url' : 'message',
          userText,
          canonical,
          evHash,
          intel
        );
      }
    } catch (err) {
      setError(
        language === 'en'
          ? `Failed to reach analysis server: ${err}`
          : `Gagal menghubungi server analisis: ${err}`
      );
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            language === 'en'
              ? 'Sorry, failed to communicate with the SecurAI backend. Please verify the server is running.'
              : 'Maaf, terjadi kendala komunikasi dengan backend SecurAI. Pastikan server backend berjalan.',
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

    const targetUrl = urlInput.trim();
    setLoading(true);
    setError(null);
    setNotice(null);
    setCurrentResult(null);

    try {
      const res = await fetch('/api/v1/analyze/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.detail || `API Error (${res.status})`);
      }

      const data: CanonicalAnalysisResult = await res.json();
      const computedHash = await computeClientSha256(targetUrl);
      setCurrentResult(data);
      setCurrentTelemetry(undefined);
      setCurrentEvidenceHash(computedHash);
      await persistHistory('url', targetUrl, data, computedHash);
    } catch (err) {
      setError(
        language === 'en'
          ? `Failed to analyze URL: ${err}`
          : `Gagal menganalisis URL: ${err}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Action: Analyze Message
  const handleAnalyzeMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || loading) return;

    const text = messageInput.trim();
    setLoading(true);
    setError(null);
    setNotice(null);
    setCurrentResult(null);

    try {
      const res = await fetch('/api/v1/analyze/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.detail || `API Error (${res.status})`);
      }

      const data: CanonicalAnalysisResult = await res.json();
      const computedHash = await computeClientSha256(text);
      setCurrentResult(data);
      setCurrentTelemetry(undefined);
      setCurrentEvidenceHash(computedHash);
      await persistHistory('message', text, data, computedHash);
    } catch (err) {
      setError(
        language === 'en'
          ? `Failed to analyze message: ${err}`
          : `Gagal menganalisis pesan: ${err}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Action: Select Screenshot Image locally (compute preview & SHA-256 without sending yet)
  const handleSelectScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    setNotice(null);
    if (!file) return;

    if (!ALLOWED_IMAGE_MIMES.has(file.type)) {
      setError(
        language === 'en'
          ? 'Unsupported image format. Please choose PNG, JPEG, or WEBP.'
          : 'Format gambar tidak didukung. Pilih berkas PNG, JPEG, atau WEBP.'
      );
      return;
    }

    if (file.size > MAX_CLIENT_IMAGE_BYTES) {
      setError(
        language === 'en'
          ? 'Image exceeds 3 MB maximum limit.'
          : 'Ukuran gambar melebihi batas maksimum 3 MB.'
      );
      return;
    }

    const buffer = await file.arrayBuffer();
    const localHash = await computeBufferSha256(buffer);
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotDataUrl(String(reader.result || ''));
      setScreenshotName(file.name);
      setScreenshotLocalHash(localHash);
    };
    reader.readAsDataURL(file);
  };

  // Action: Analyze Screenshot via /api/v1/analyze/image with opt-in consent
  const handleAnalyzeScreenshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshotDataUrl || loading) return;

    setLoading(true);
    setError(null);
    setNotice(null);
    setCurrentResult(null);

    try {
      const res = await fetch('/api/v1/analyze/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: screenshotDataUrl,
          context_note: screenshotNote.trim(),
          mode,
          external_ai_consent: externalAiConsent,
          language,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.detail || `API Error (${res.status})`);
      }

      const data: CanonicalAnalysisResult = await res.json();
      const sha = String(data.provider_status?.sha256_hash || screenshotLocalHash);
      setCurrentResult(data);
      setCurrentTelemetry(undefined);
      setCurrentEvidenceHash(sha);
      await persistHistory('screenshot', screenshotName || 'Screenshot upload', data, sha);
    } catch (err) {
      setError(
        language === 'en'
          ? `Failed to analyze screenshot: ${err}`
          : `Gagal menganalisis tangkapan layar: ${err}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Action: Local Binary File Inspection (100% browser Web Crypto SHA-256 + magic bytes)
  const handleInspectBinaryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const outcome = await inspectLocalBinaryFile(file);
      setFileName(file.name);
      setLocalFileResultHash(outcome.sha256Hash);
      setFileHashInput(outcome.evidencePreview);
      setCurrentResult(outcome.canonicalResult);
      setCurrentTelemetry(undefined);
      setCurrentEvidenceHash(outcome.sha256Hash);
      await persistHistory('file', `${file.name} (${outcome.detectedMagicType})`, outcome.canonicalResult, outcome.sha256Hash);
      setNotice(
        language === 'en'
          ? `Local inspection complete: ${file.name} (${outcome.detectedMagicType})`
          : `Inspeksi lokal selesai: ${file.name} (${outcome.detectedMagicType})`
      );
    } catch (err) {
      setError(
        language === 'en'
          ? `Failed to inspect local file: ${err}`
          : `Gagal memeriksa berkas lokal: ${err}`
      );
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
    const artifactType =
      currentResult.analysis_type === 'url'
        ? 'url'
        : currentResult.analysis_type === 'image'
        ? 'screenshot'
        : 'manifest';

    await db.evidence.add({
      evidenceId,
      name: fileName
        ? `Evidence: ${fileName}`
        : `Analysis Evidence (${currentResult.analysis_type.toUpperCase()})`,
      artifactType,
      contentPreview: content,
      sha256Hash: hash,
      sizeBytes: new TextEncoder().encode(content).length,
      mimeType: 'application/json',
      capturedAt: new Date().toISOString(),
    });

    onVaultUpdated?.();
    setNotice(
      language === 'en'
        ? `Evidence artifact saved to Vault with ID: ${evidenceId}`
        : `Artefak bukti tersimpan di Brankas dengan ID: ${evidenceId}`
    );
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

    onVaultUpdated?.();
    setShowCaseModal(false);
    setNotice(
      language === 'en'
        ? `Finding attached to case ${selectedCaseId}`
        : `Temuan berhasil dilampirkan ke kasus ${selectedCaseId}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs: Chat Triage vs Direct Scanners */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex flex-wrap gap-1 sm:gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSubTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'chat'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'AI Chat Triage' : 'Chat Triage AI'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('url')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'url'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'URL Inspect' : 'Inspeksi URL'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('message')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'message'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'Message Check' : 'Deteksi Pesan'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('screenshot')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'screenshot'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'Screenshot' : 'Tangkapan Layar'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('file')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'file'
                ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'File & SHA-256' : 'Berkas & SHA-256'}</span>
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

      {/* Status alerts */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </span>
          <button type="button" onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Inputs */}
        <div className="lg:col-span-5 space-y-4 min-w-0">
          {/* SubTab 1: Chat Triage */}
          {activeSubTab === 'chat' && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col h-[560px] overflow-hidden">
              <div className="p-3.5 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  {language === 'en' ? 'Incident Triage Chat' : 'Asisten Triage Insiden'}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {mode === 'analyst' ? t.modes.analyst : t.modes.consumer}
                </span>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-cyan-600 text-white rounded-br-none'
                          : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-bl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">
                        {m.id === 'welcome' ? welcomeContent : m.content}
                      </p>

                      {m.role === 'assistant' && (
                        <div className="mt-2 pt-1.5 border-t border-slate-700/60 flex items-center justify-between gap-2 text-[10px]">
                          {isSpeechSynthesisSupported() && (
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleSpeak(
                                  m.id || `msg-${idx}`,
                                  m.id === 'welcome' ? welcomeContent : m.content
                                )
                              }
                              className={`flex items-center gap-1 transition-colors cursor-pointer ${
                                speakingMessageId === (m.id || `msg-${idx}`)
                                  ? 'text-rose-400 font-semibold'
                                  : 'text-slate-400 hover:text-cyan-300'
                              }`}
                              title={
                                speakingMessageId === (m.id || `msg-${idx}`)
                                  ? t.voice.stopSpeaking
                                  : t.voice.speakResponse
                              }
                            >
                              {speakingMessageId === (m.id || `msg-${idx}`) ? (
                                <>
                                  <VolumeX className="w-3.5 h-3.5" />
                                  <span>{t.voice.stopSpeaking}</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>{t.voice.speakResponse}</span>
                                </>
                              )}
                            </button>
                          )}

                          {m.canonical && (
                            <div className="flex items-center gap-2 font-mono ml-auto">
                              <span className="text-cyan-300">Risk: {m.canonical.risk_score}/100</span>
                              <button
                                type="button"
                                onClick={() => setCurrentResult(m.canonical || null)}
                                className="underline hover:text-white"
                              >
                                {language === 'en' ? 'Open Details' : 'Buka Detail'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 p-2 font-mono">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>
                      {language === 'en' ? 'Analyzing security indicators...' : 'Menganalisis indikator keamanan...'}
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendChat} className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={
                    isListening
                      ? t.voice.micListening
                      : (language === 'en'
                          ? 'Ask a security question or paste suspicious text...'
                          : 'Ketik pertanyaan atau tempel teks penipuan...')
                  }
                  className={`flex-1 bg-slate-900 border rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
                    isListening
                      ? 'border-rose-500/80 bg-rose-950/20 shadow-inner'
                      : 'border-slate-700 focus:border-cyan-500'
                  }`}
                />

                <button
                  type="button"
                  onClick={handleToggleListen}
                  disabled={loading}
                  title={
                    !isSpeechRecognitionSupported()
                      ? t.voice.micNotSupported
                      : isListening
                      ? t.voice.micStop
                      : t.voice.micStart
                  }
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    !isSpeechRecognitionSupported()
                      ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                      : isListening
                      ? 'bg-rose-500/25 border-rose-500 text-rose-300 animate-pulse'
                      : 'bg-slate-900 border-slate-700 hover:border-cyan-500/70 text-slate-400 hover:text-cyan-400'
                  }`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <button
                  type="submit"
                  disabled={loading || !chatInput.trim()}
                  className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white transition-colors cursor-pointer"
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
                  <span>{language === 'en' ? 'Deep URL Inspection' : 'Inspeksi Tautan URL Mendalam'}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {language === 'en'
                    ? 'Inspects SSL, DNS A/AAAA, SSRF guards, brand impersonation, and redirect chains.'
                    : 'Menganalisis SSL, DNS A/AAAA, SSRF pre-check, Brand Impersonation, dan Redirect Chain.'}
                </p>
              </div>

              <form onSubmit={handleAnalyzeUrl} className="space-y-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-medium">
                    {language === 'en' ? 'Target URL' : 'Tautan Sasaran (URL)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example-login-check.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
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
                  <span>
                    {language === 'en'
                      ? 'Text Social Engineering Detector'
                      : 'Deteksi Rekayasa Sosial Pesan Teks'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {language === 'en'
                    ? 'Evaluates urgency pressure tactics, fake account-block threats, and SMS/WhatsApp scam cues.'
                    : 'Evaluasi kata kunci desakan psikologis, ancaman pemblokiran rekening, dan pola penipuan SMS/WA.'}
                </p>
              </div>

              <form onSubmit={handleAnalyzeMessage} className="space-y-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-medium">
                    {language === 'en' ? 'Message Content' : 'Teks Pesan'}
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={
                      language === 'en'
                        ? 'Paste suspicious SMS or WhatsApp message here...'
                        : 'Tempel pesan SMS atau WhatsApp yang Anda terima...'
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
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

          {/* SubTab 4: Screenshot Verification & Consent-Gated AI Vision (UX-06 / SEC-06 / AI-07) */}
          {activeSubTab === 'screenshot' && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-cyan-400" />
                  <span>{language === 'en' ? 'Screenshot Verification & Triage' : 'Verifikasi Tangkapan Layar & AI'}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {language === 'en'
                    ? 'Validates PNG/JPEG/WEBP magic bytes, seals SHA-256 locally, and optionally runs visual AI inspection.'
                    : 'Memvalidasi magic bytes PNG/JPEG/WEBP, menyegel SHA-256, dan menganalisis visual opsional via AI.'}
                </p>
              </div>

              <form onSubmit={handleAnalyzeScreenshot} className="space-y-3">
                <label className="block border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-4 text-center cursor-pointer bg-slate-950/60 transition-colors">
                  <Upload className="w-6 h-6 text-cyan-400 mx-auto mb-1.5" />
                  <span className="block text-xs font-semibold text-slate-200">
                    {screenshotName || (language === 'en' ? 'Choose PNG / JPEG / WEBP (Max 3 MB)' : 'Pilih PNG / JPEG / WEBP (Maks 3 MB)')}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleSelectScreenshot}
                    className="hidden"
                  />
                </label>

                {screenshotDataUrl && (
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
                    <img
                      src={screenshotDataUrl}
                      alt="Screenshot preview"
                      className="max-h-44 mx-auto rounded-lg border border-slate-800 object-contain"
                    />
                    <p className="text-[10px] font-mono text-emerald-400 break-all">
                      SHA-256: {screenshotLocalHash}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-medium">
                    {language === 'en' ? 'Context Note (optional)' : 'Catatan Konteks (opsional)'}
                  </label>
                  <input
                    type="text"
                    value={screenshotNote}
                    onChange={(e) => setScreenshotNote(e.target.value)}
                    placeholder={language === 'en' ? 'e.g. Received via WhatsApp claiming bank promo' : 'misal: Diterima via WhatsApp mengatasnamakan bank'}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Explicit External AI Consent Gate (AI-07) */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-950/20 border border-amber-800/50 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={externalAiConsent}
                    onChange={(e) => setExternalAiConsent(e.target.checked)}
                    className="mt-0.5 rounded border-slate-600 bg-slate-900 text-cyan-500"
                  />
                  <span>
                    <strong className="text-amber-300 block mb-0.5">
                      {language === 'en' ? 'External AI Vision Consent (Optional)' : 'Persetujuan Pengiriman AI Eksternal (Opsional)'}
                    </strong>
                    {language === 'en'
                      ? 'Allow sending this image to Google Gemini Vision API for visual phishing evaluation. When unchecked, only container security checks and SHA-256 sealing run.'
                      : 'Izinkan pengiriman gambar ini ke Google Gemini Vision API untuk evaluasi phishing visual. Jika tidak dicentang, hanya validasi keamanan lokal & segel SHA-256 yang berjalan.'}
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!screenshotDataUrl || loading}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t.analyzeTab.btnAnalyzing}</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>{language === 'en' ? 'Verify & Inspect Screenshot' : 'Verifikasi & Analisis Tangkapan Layar'}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* SubTab 5: Local Binary File Inspection & SHA-256 (ANA-10) */}
          {activeSubTab === 'file' && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-cyan-400" />
                  <span>{language === 'en' ? 'Local Binary Inspector & SHA-256' : 'Pemeriksa Berkas Lokal & Hash SHA-256'}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {language === 'en'
                    ? 'Computes real SHA-256 & inspects binary magic bytes 100% locally in your browser without uploading files.'
                    : 'Menghitung SHA-256 & memeriksa header biner 100% lokal di browser tanpa mengunggah berkas ke server.'}
                </p>
              </div>

              <label className="block border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-4 text-center cursor-pointer bg-slate-950/60 transition-colors">
                <Lock className="w-5 h-5 text-emerald-400 mx-auto mb-1.5" />
                <span className="block text-xs font-semibold text-slate-200">
                  {language === 'en'
                    ? 'Select any local file (.apk, .pdf, .exe, .zip, etc.)'
                    : 'Pilih berkas lokal (.apk, .pdf, .exe, .zip, dll.)'}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  Zero upload • Web Crypto API SHA-256 + Magic-Byte Masquerade Check
                </span>
                <input type="file" onChange={handleInspectBinaryFile} className="hidden" />
              </label>

              {localFileResultHash && (
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] font-mono text-emerald-400 break-all">
                  SHA-256 ({fileName}): {localFileResultHash}
                </div>
              )}

              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-medium">
                    {language === 'en' ? 'Artifact Name' : 'Nama Artefak'}
                  </label>
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder={
                      language === 'en'
                        ? 'e.g. Fake_Invoice.pdf or WhatsApp_Message.txt'
                        : 'misal: Surat_Tagihan_Palsu.pdf atau Pesan_WhatsApp.txt'
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-medium">
                    {language === 'en' ? 'Artifact Content / Metadata (Text)' : 'Isi / Metadata Artefak (Teks)'}
                  </label>
                  <textarea
                    rows={4}
                    value={fileHashInput}
                    onChange={(e) => setFileHashInput(e.target.value)}
                    placeholder={
                      language === 'en'
                        ? 'Paste text content or review computed binary metadata summary...'
                        : 'Tempel konten teks atau lihat ringkasan metadata berkas...'
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    if (!fileHashInput) return;
                    const hash = await computeClientSha256(fileHashInput);
                    setCurrentEvidenceHash(hash);
                    setNotice(
                      language === 'en'
                        ? `Computed text SHA-256: ${hash}`
                        : `Hash SHA-256 teks dihitung: ${hash}`
                    );
                  }}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                >
                  {language === 'en' ? 'Compute Text SHA-256' : 'Hitung SHA-256 Teks'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Mode-Specific Output View */}
        <div className="lg:col-span-7 min-w-0">
          {loading ? (
            <AnalyzeWorkspaceSkeleton language={language} />
          ) : currentResult ? (
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
              <Shield className="w-10 h-10 stroke-[1.2] mb-3 text-slate-600" />
              <p className="text-sm font-medium text-slate-400">
                {language === 'en' ? 'Analysis Results Ready' : 'Hasil Analisis Siap Ditampilkan'}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {language === 'en'
                  ? 'Send a chat triage prompt or inspect a URL, Message, Screenshot, or Local File in the left panel.'
                  : 'Kirim pesan pada chat triage atau lakukan inspeksi URL, Pesan, Tangkapan Layar, maupun Berkas Lokal di kolom kiri.'}
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
              <span>{language === 'en' ? 'Attach to Incident Case' : 'Lampirkan ke Kasus Insiden'}</span>
            </h3>

            {casesList.length === 0 ? (
              <div className="text-xs text-slate-400">
                {language === 'en' ? (
                  <>
                    No incident cases yet. Please create a case in the <strong>{t.nav.incidents}</strong> tab first.
                  </>
                ) : (
                  <>
                    Belum ada kasus insiden. Silakan buat kasus baru di tab <strong>{t.nav.incidents}</strong> terlebih dahulu.
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">
                    {language === 'en' ? 'Select Case' : 'Pilih Kasus'}
                  </label>
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
                {t.common.cancel}
              </button>
              {casesList.length > 0 && (
                <button
                  type="button"
                  onClick={handleLinkToCase}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg"
                >
                  {language === 'en' ? 'Attach' : 'Lampirkan'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
