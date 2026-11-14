import React, { useState, useEffect } from 'react';
import {
  Settings2,
  Database,
  Trash2,
  Download,
  Lock,
  Server,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Volume2,
  Play,
} from 'lucide-react';
import { db, purgeAllLocalVault } from '../../db';
import { useLanguage } from '../../context/useLanguage';
import { encryptVaultPayload } from '../../utils/vaultCrypto';
import { speakText, isSpeechSynthesisSupported, stopSpeaking } from '../../utils/speechController';

export const SettingsManager: React.FC = () => {
  const { t, language } = useLanguage();
  const [incidentCount, setIncidentCount] = useState(0);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [backendHealth, setBackendHealth] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('securai_auto_speak') === 'true';
  });
  const [speechRate, setSpeechRate] = useState(() => {
    if (typeof window === 'undefined') return 1.0;
    return Number(localStorage.getItem('securai_speech_rate') || '1.0');
  });
  const [isTestingVoice, setIsTestingVoice] = useState(false);

  const handleToggleAutoSpeak = () => {
    const next = !autoSpeak;
    setAutoSpeak(next);
    localStorage.setItem('securai_auto_speak', String(next));
  };

  const handleChangeRate = (rate: number) => {
    setSpeechRate(rate);
    localStorage.setItem('securai_speech_rate', String(rate));
  };

  const handleTestVoice = () => {
    if (isTestingVoice) {
      stopSpeaking();
      setIsTestingVoice(false);
      return;
    }
    setIsTestingVoice(true);
    speakText(t.voice.testVoiceSample, {
      lang: language,
      rate: speechRate,
      onEnd: () => setIsTestingVoice(false),
      onError: () => setIsTestingVoice(false),
    });
  };

  const loadStats = async () => {
    const [incs, evs, hists] = await Promise.all([
      db.incidents.count(),
      db.evidence.count(),
      db.analysisHistory.count(),
    ]);
    setIncidentCount(incs);
    setEvidenceCount(evs);
    setHistoryCount(hists);
  };

  const checkBackend = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/health');
      if (res.ok) {
        const data = await res.json();
        setBackendHealth(data);
      } else {
        setBackendHealth({ status: 'error', error: `HTTP ${res.status}` });
      }
    } catch (err) {
      setBackendHealth({ status: 'offline', error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const initSettingsView = async () => {
      try {
        const [incs, evs, hists] = await Promise.all([
          db.incidents.count(),
          db.evidence.count(),
          db.analysisHistory.count(),
        ]);
        if (active) {
          setIncidentCount(incs);
          setEvidenceCount(evs);
          setHistoryCount(hists);
        }
      } catch {
        // IndexedDB fallback
      }

      try {
        const res = await fetch('/api/v1/health');
        const data = res.ok ? await res.json() : { status: 'error', error: `HTTP ${res.status}` };
        if (active) {
          setBackendHealth(data);
        }
      } catch (err) {
        if (active) {
          setBackendHealth({ status: 'offline', error: String(err) });
        }
      }
    };

    initSettingsView();
    return () => {
      active = false;
    };
  }, []);

  const handleWipeData = async () => {
    if (!confirm(t.settingsTab.clearConfirm)) return;
    await purgeAllLocalVault();
    await loadStats();
    alert('Seluruh data IndexedDB lokal telah dibersihkan!');
  };

  const handleExportFullBackup = async () => {
    const incidents = await db.incidents.toArray();
    const timeline = await db.timeline.toArray();
    const evidence = await db.evidence.toArray();
    const history = await db.analysisHistory.toArray();

    const backup = {
      app: 'SecurAI',
      version: '2.7.0',
      exportedAt: new Date().toISOString(),
      incidents,
      timeline,
      evidence,
      analysisHistory: history,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `securai-full-vault-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportEncryptedBackup = async () => {
    try {
      const pass = prompt(
        language === 'en'
          ? 'Enter a passphrase to encrypt your entire vault backup with AES-256-GCM (minimum 6 characters):'
          : 'Masukkan passphrase untuk mengenkripsi cadangan brankas dengan AES-256-GCM (minimal 6 karakter):'
      );
      if (!pass) return;
      if (pass.length < 6) {
        alert(language === 'en' ? 'Passphrase must be at least 6 characters.' : 'Passphrase minimal 6 karakter.');
        return;
      }

      const incidents = await db.incidents.toArray();
      const timeline = await db.timeline.toArray();
      const evidence = await db.evidence.toArray();
      const history = await db.analysisHistory.toArray();

      const backup = {
        app: 'SecurAI',
        version: '2.7.0',
        exportedAt: new Date().toISOString(),
        incidents,
        timeline,
        evidence,
        analysisHistory: history,
      };

      const plainJson = JSON.stringify(backup, null, 2);
      const encryptedJson = await encryptVaultPayload(plainJson, pass);

      const blob = new Blob([encryptedJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `securai-full-vault-backup-${Date.now()}.encrypted.securai`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export encrypted backup failed: ${err}`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-cyan-400" />
          <span>{t.settingsTab.title}</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">{t.settingsTab.subtitle}</p>
      </div>

      {/* Storage Information Card */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-white text-sm">{t.settingsTab.storageTitle}</h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
            Local Retention Only
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {t.settingsTab.storageDesc}
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-center">
            <span className="text-xl font-bold font-mono text-cyan-400">{incidentCount}</span>
            <span className="block text-[11px] text-slate-400 mt-0.5">{t.nav.incidents}</span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-center">
            <span className="text-xl font-bold font-mono text-purple-400">{evidenceCount}</span>
            <span className="block text-[11px] text-slate-400 mt-0.5">
              {language === 'en' ? 'Evidence Artifacts' : 'Artefak Bukti'}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-center">
            <span className="text-xl font-bold font-mono text-blue-400">{historyCount}</span>
            <span className="block text-[11px] text-slate-400 mt-0.5">
              {language === 'en' ? 'Analysis History' : 'Riwayat Analisis'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800 flex-wrap">
          <button
            type="button"
            onClick={handleExportFullBackup}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>
              {language === 'en' ? 'Download Full Backup (.JSON)' : 'Unduh Cadangan Lengkap (.JSON)'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleExportEncryptedBackup}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>
              {language === 'en' ? 'Encrypted Backup (AES-256-GCM)' : 'Cadangan Terenkripsi (AES-256-GCM)'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleWipeData}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 text-xs font-semibold border border-rose-800/60 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>{t.settingsTab.btnClearAll}</span>
          </button>
        </div>
      </div>

      {/* Voice Interaction & Web Speech Card (VOICE-01 / VOICE-02) */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-white text-sm">{t.voice.voiceSettingsTitle}</h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40 text-cyan-300">
            W3C Web Speech API
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {language === 'en'
            ? 'Enables client-side voice transcription and speech synthesis. 100% on-device processing with zero server audio streaming.'
            : 'Mengaktifkan transkripsi input suara dan pembacaan respons asisten. 100% diproses di browser tanpa pengunggahan rekaman audio.'}
        </p>

        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
          {/* Auto Speak Toggle */}
          <label className="flex items-center justify-between cursor-pointer">
            <div className="pr-4">
              <span className="block text-xs font-semibold text-slate-200">{t.voice.autoSpeakLabel}</span>
              <span className="block text-[11px] text-slate-400 mt-0.5">{t.voice.autoSpeakDesc}</span>
            </div>
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={handleToggleAutoSpeak}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
            />
          </label>

          {/* Speech Rate Controls */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="block text-xs font-semibold text-slate-200">{t.voice.speechRateLabel}</span>
              <span className="block text-[11px] text-slate-400">
                {language === 'en' ? 'Adjust assistant speech tempo' : 'Atur tempo suara asisten'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs font-mono">
              {[0.8, 1.0, 1.2].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => handleChangeRate(rate)}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    speechRate === rate
                      ? 'bg-cyan-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Test Voice Button */}
          {isSpeechSynthesisSupported() && (
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {language === 'en' ? 'Click to preview assistant speech' : 'Dengarkan contoh suara asisten'}
              </span>
              <button
                type="button"
                onClick={handleTestVoice}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-medium transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isTestingVoice ? (language === 'en' ? 'Stop Sample' : 'Hentikan Contoh') : t.voice.testVoiceBtn}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Backend & Security Engine Card */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-white text-sm">{t.settingsTab.apiTitle}</h3>
          </div>

          <button
            type="button"
            onClick={checkBackend}
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Periksa Ulang</span>
          </button>
        </div>

        <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Endpoint:</span>
            <span className="text-slate-200">/api/v1 (FastAPI)</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Status Response:</span>
            <span className="text-emerald-400 font-semibold">
              {backendHealth
                ? JSON.stringify(backendHealth)
                : language === 'en'
                  ? 'Not checked yet'
                  : 'Belum diperiksa'}
            </span>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>SSRF Protection: Pinned Socket + Strict DNS Resolution (SEC-01)</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Brand Impersonation & PSL: Offline Public Suffix List (SEC-02)</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>AI Orchestration: Gemini Structured JSON Output (ANA-02)</span>
          </div>
        </div>
      </div>

      {/* Privacy Notice & Acceptable-Use Policy Card (GOV-01 / GOV-02) */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>{t.settingsTab.privacyNoticeTitle}</span>
          </h3>
          <span className="text-[10px] font-mono text-slate-400">{t.settingsTab.versionInfo}</span>
        </div>

        <ul className="space-y-2 text-xs text-slate-400 list-disc pl-5 leading-relaxed">
          <li>{t.settingsTab.privacyBulletLocal}</li>
          <li>{t.settingsTab.privacyBulletExternal}</li>
          <li>{t.settingsTab.privacyBulletScope}</li>
          <li>{t.settingsTab.privacyBulletDisclaimer}</li>
        </ul>
      </div>
    </div>
  );
};
