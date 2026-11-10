import React, { useState } from 'react';
import { Header } from './components/layout/Header';
import { Navbar, type TabType } from './components/layout/Navbar';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ModeProvider, useMode } from './context/ModeContext';
import { ShieldCheck, Terminal, User, Lock } from 'lucide-react';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('analyze');
  const { t } = useLanguage();
  const { mode } = useMode();

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">
      <Header />
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Banner highlighting active mode */}
        <div className={`mb-6 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          mode === 'consumer'
            ? 'bg-blue-950/20 border-blue-900/40 text-blue-200'
            : 'bg-purple-950/20 border-purple-900/40 text-purple-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              mode === 'consumer' ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'
            }`}>
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

        {/* Temporary Tab Placeholder during Shell verification */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center">
          <div className="inline-flex p-3 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {activeTab === 'analyze' && t.analyzeTab.title}
            {activeTab === 'incidents' && t.incidentsTab.title}
            {activeTab === 'evidence' && t.evidenceTab.title}
            {activeTab === 'reports' && t.reportsTab.title}
            {activeTab === 'settings' && t.settingsTab.title}
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto mb-6">
            {activeTab === 'analyze' && t.analyzeTab.subtitle}
            {activeTab === 'incidents' && t.incidentsTab.subtitle}
            {activeTab === 'evidence' && t.evidenceTab.subtitle}
            {activeTab === 'reports' && t.reportsTab.subtitle}
            {activeTab === 'settings' && t.settingsTab.subtitle}
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-cyan-300 font-mono border border-slate-700">
            Shell & Navigation Scaffold Loaded • Tab: {activeTab}
          </div>
        </div>
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
