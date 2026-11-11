import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Navbar, type TabType } from './components/layout/Navbar';
import { LanguageProvider } from './context/LanguageContext';
import { ModeProvider } from './context/ModeContext';
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

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      <Header />
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        incidentsCount={incidentsCount}
        evidenceCount={evidenceCount}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
