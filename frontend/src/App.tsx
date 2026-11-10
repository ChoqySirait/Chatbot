import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Navbar, type TabType } from './components/layout/Navbar';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ModeProvider, useMode } from './context/ModeContext';
import { IncidentManager } from './components/incidents/IncidentManager';
import { EvidenceVault } from './components/evidence/EvidenceVault';
import { ReportGenerator } from './components/reports/ReportGenerator';
import { SettingsManager } from './components/settings/SettingsManager';
import { db } from './db';
import { Terminal, User, Lock, Search } from 'lucide-react';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('analyze');
  const [incidentsCount, setIncidentsCount] = useState(0);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const { t } = useLanguage();
  const { mode } = useMode();

  const refreshCounts = async () => {
    try {
      const incCount = await db.incidents.count();
      const evCount = await db.evidence.count();
      setIncidentsCount(incCount);
      setEvidenceCount(evCount);
    } catch {
      // IndexedDB fallback
    }
  };

  useEffect(() => {
    refreshCounts();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">
      <Header />
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        incidentsCount={incidentsCount}
        evidenceCount={evidenceCount}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Banner highlighting active mode */}
        <div
          className={`mb-6 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            mode === 'consumer'
              ? 'bg-blue-950/20 border-blue-900/40 text-blue-200'
              : 'bg-purple-950/20 border-purple-900/40 text-purple-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                mode === 'consumer' ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'
              }`}
            >
              {mode === 'consumer' ? <User className="w-5 h-5" /> : <Terminal className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {mode === 'consumer' ? t.modes.consumer : t.modes.analyst}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-700">
                  {mode}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {mode === 'consumer' ? t.modes.consumerDesc : t.modes.analystDesc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>IndexedDB Vault Active</span>
          </div>
        </div>

        {/* Tab Content Router */}
        {activeTab === 'incidents' && <IncidentManager />}
        {activeTab === 'evidence' && <EvidenceVault />}
        {activeTab === 'reports' && <ReportGenerator />}
        {activeTab === 'settings' && <SettingsManager />}
        {activeTab === 'analyze' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 mb-4">
              <Search className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t.analyzeTab.title}</h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto mb-6">{t.analyzeTab.subtitle}</p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-cyan-300 font-mono border border-slate-700">
              Unified Analyzer Workspace (Ready for Commit 3 integration)
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SecurAI — Digital Trust & Threat Intelligence Platform</span>
          <span>Local-First • Bilingual ID/EN • MITRE ATT&CK & SHA-256 Verified</span>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <ModeProvider>
        <AppContent />
      </ModeProvider>
    </LanguageProvider>
  );
}
