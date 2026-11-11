import React from 'react';
import {
  LayoutDashboard,
  Search,
  FolderGit2,
  ShieldCheck,
  FileCheck2,
  Settings2,
  Terminal,
  GraduationCap,
} from 'lucide-react';
import { useLanguage } from '../../context/useLanguage';

export type TabType =
  | 'overview'
  | 'analyze'
  | 'threat-intel'
  | 'incidents'
  | 'evidence'
  | 'reports'
  | 'learn'
  | 'settings';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  incidentsCount?: number;
  evidenceCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  incidentsCount = 0,
  evidenceCount = 0,
}) => {
  const { t } = useLanguage();

  const navItems: { id: TabType; label: string; icon: React.FC<{ className?: string }>; count?: number }[] = [
    { id: 'overview', label: t.nav.overview, icon: LayoutDashboard },
    { id: 'analyze', label: t.nav.analyze, icon: Search },
    { id: 'threat-intel', label: t.nav.threatIntel, icon: Terminal },
    { id: 'incidents', label: t.nav.incidents, icon: FolderGit2, count: incidentsCount },
    { id: 'evidence', label: t.nav.evidence, icon: ShieldCheck, count: evidenceCount },
    { id: 'reports', label: t.nav.reports, icon: FileCheck2 },
    { id: 'learn', label: t.nav.learn, icon: GraduationCap },
    { id: 'settings', label: t.nav.settings, icon: Settings2 },
  ];

  return (
    <nav className="border-b border-slate-800 bg-slate-950/60 sticky top-16 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-3 overflow-x-auto py-2 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-slate-800 text-cyan-300 border border-cyan-900/50">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
