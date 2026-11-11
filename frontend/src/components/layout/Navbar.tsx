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
    <nav className="border-b border-slate-800/80 bg-[#0b1120]/80 backdrop-blur sticky top-14 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-nowrap lg:flex-wrap items-center gap-1 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-cyan-400 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className="ml-0.5 text-[11px] font-mono tabular-nums text-slate-400">
                    ({item.count})
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
