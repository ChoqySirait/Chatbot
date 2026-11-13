import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Navbar, type TabType } from './components/layout/Navbar';
import { LanguageProvider } from './context/LanguageContext';
import { ModeProvider } from './context/ModeContext';
import { useLanguage } from './context/useLanguage';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { OverviewDashboard } from './components/overview/OverviewDashboard';
import { AnalyzeWorkspace } from './components/analyze/AnalyzeWorkspace';
import { ThreatIntelExplorer } from './components/threat-intel/ThreatIntelExplorer';
import { IncidentManager } from './components/incidents/IncidentManager';
import { EvidenceVault } from './components/evidence/EvidenceVault';
import { ReportGenerator } from './components/reports/ReportGenerator';
import { LearningCenter } from './components/learning/LearningCenter';
import { SettingsManager } from './components/settings/SettingsManager';
import { db } from './db';

const AppContent: React.FC = () => {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [incidentsCount, setIncidentsCount] = useState(0);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => {
    let active = true;

    const syncCounts = async () => {
      try {
        const [incCount, evCount] = await Promise.all([
          db.incidents.count(),
          db.evidence.count(),
        ]);
        if (active) {
          setIncidentsCount(incCount);
          setEvidenceCount(evCount);
        }
      } catch {
        // IndexedDB fallback
      }
    };

    syncCounts();
    return () => {
      active = false;
    };
  }, [activeTab, refreshSignal]);

  const handleVaultUpdated = () => {
    setRefreshSignal((prev) => prev + 1);
  };

  const tabTitles: Record<TabType, string> = {
    overview: t.nav.overview,
    analyze: t.nav.analyze,
    'threat-intel': t.nav.threatIntel,
    incidents: t.nav.incidents,
    evidence: t.nav.evidence,
    reports: t.nav.reports,
    learn: t.nav.learn,
    settings: t.nav.settings,
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans print:bg-white print:text-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-lg focus:bg-cyan-500 focus:text-slate-950 focus:font-semibold focus:text-xs"
      >
        {language === 'en' ? 'Skip to main content' : 'Lewati ke konten utama'}
      </a>

      <div aria-live="polite" className="sr-only">
        {language === 'en'
          ? `Active section: ${tabTitles[activeTab]}`
          : `Bagian aktif: ${tabTitles[activeTab]}`}
      </div>

      <Header />
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        incidentsCount={incidentsCount}
        evidenceCount={evidenceCount}
      />

      <main
        id="main-content"
        tabIndex={-1}
        role="tabpanel"
        aria-labelledby={`nav-tab-${activeTab}`}
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 focus:outline-none print:max-w-none print:py-0 print:px-0"
      >
        {/* Tab Content Router */}
        {activeTab === 'overview' && (
          <OverviewDashboard onNavigate={(tab) => setActiveTab(tab)} />
        )}
        {activeTab === 'analyze' && (
          <AnalyzeWorkspace
            onSwitchTab={(tab) => setActiveTab(tab)}
            onVaultUpdated={handleVaultUpdated}
          />
        )}
        {activeTab === 'threat-intel' && <ThreatIntelExplorer />}
        {activeTab === 'incidents' && <IncidentManager />}
        {activeTab === 'evidence' && <EvidenceVault />}
        {activeTab === 'reports' && <ReportGenerator />}
        {activeTab === 'learn' && <LearningCenter />}
        {activeTab === 'settings' && <SettingsManager />}
      </main>

      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500 print:hidden">
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
    <ErrorBoundary>
      <LanguageProvider>
        <ModeProvider>
          <AppContent />
        </ModeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
