import React, { useRef } from 'react';
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
  const { t, language } = useLanguage();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % navItems.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + navItems.length) % navItems.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = navItems.length - 1;
    }
    if (nextIndex !== null) {
      e.preventDefault();
      setActiveTab(navItems[nextIndex].id);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <nav
      aria-label={language === 'en' ? 'Primary navigation' : 'Navigasi utama'}
      className="border-b border-slate-800/80 bg-[#0b1120]/80 backdrop-blur sticky top-14 z-40 print:hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          role="tablist"
          aria-label={language === 'en' ? 'Workspace sections' : 'Bagian ruang kerja'}
          className="flex flex-nowrap lg:flex-wrap items-center gap-1 overflow-x-auto no-scrollbar"
        >
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                id={`nav-tab-${item.id}`}
                role="tab"
                type="button"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(item.id)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-inset rounded-t-md ${
                  isActive
                    ? 'border-cyan-400 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} aria-hidden="true" />
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
