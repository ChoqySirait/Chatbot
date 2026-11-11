import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  FolderGit2,
  ShieldCheck,
  Activity,
  Lock,
  ArrowRight,
  Search,
  GraduationCap,
} from 'lucide-react';
import { db } from '../../db';
import type { StoredAnalysisRecord } from '../../types/api';
import { useLanguage } from '../../context/useLanguage';
import { useMode } from '../../context/useMode';
import type { TabType } from '../layout/Navbar';

interface OverviewDashboardProps {
  onNavigate: (tab: TabType) => void;
}

interface DashboardStats {
  totalAnalyses: number;
  highRiskCount: number;
  cautionCount: number;
  safeCount: number;
  openCasesCount: number;
  evidenceCount: number;
  recentHistory: StoredAnalysisRecord[];
}

const INITIAL_STATS: DashboardStats = {
  totalAnalyses: 0,
  highRiskCount: 0,
  cautionCount: 0,
  safeCount: 0,
  openCasesCount: 0,
  evidenceCount: 0,
  recentHistory: [],
};

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  const { mode } = useMode();
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      try {
        const [allHistory, incidents, evCount] = await Promise.all([
          db.analysisHistory.reverse().sortBy('createdAt'),
          db.incidents.toArray(),
          db.evidence.count(),
        ]);

        if (!active) return;

        const highRiskCount = allHistory.filter((item) => item.classification === 'high_risk').length;
        const cautionCount = allHistory.filter((item) => item.classification === 'needs_caution').length;
        const safeCount = allHistory.filter((item) => item.classification === 'no_major_indicator').length;
        const openCasesCount = incidents.filter((c) => c.status !== 'resolved').length;

        setStats({
          totalAnalyses: allHistory.length,
          highRiskCount,
          cautionCount,
          safeCount,
          openCasesCount,
          evidenceCount: evCount,
          recentHistory: allHistory.slice(0, 6),
        });
      } catch {
        // Fallback to empty stats if IndexedDB is restricted
      }
    };

    loadOverview();
    return () => {
      active = false;
    };
  }, []);

  const badgeStyle = (classification: StoredAnalysisRecord['classification']) => {
    switch (classification) {
      case 'high_risk':
        return 'bg-rose-950/70 text-rose-300 border-rose-800/70';
      case 'needs_caution':
        return 'bg-amber-950/70 text-amber-300 border-amber-800/70';
      case 'no_major_indicator':
        return 'bg-emerald-950/70 text-emerald-300 border-emerald-800/70';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Summary Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-cyan-400" />
            <span>{t.overviewTab.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">{t.overviewTab.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('analyze')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 whitespace-nowrap"
        >
          <Search className="w-4 h-4" />
          <span>{t.overviewTab.goToAnalyze}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Real IndexedDB Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t.overviewTab.totalAnalyses}</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-white">{stats.totalAnalyses}</p>
          <p className="text-[11px] text-slate-500">
            {mode === 'analyst' ? t.modes.analyst : t.modes.consumer}
          </p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t.overviewTab.highRiskCount}</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-rose-400">{stats.highRiskCount}</p>
          <p className="text-[11px] text-slate-500">
            {stats.cautionCount} {language === 'en' ? 'needs caution' : 'perlu waspada'}
          </p>
        </div>

        <div
          onClick={() => onNavigate('incidents')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate('incidents')}
          className="bg-slate-900/50 hover:border-cyan-500/40 border border-slate-800 rounded-2xl p-4 space-y-1 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t.overviewTab.openCasesCount}</span>
            <FolderGit2 className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-amber-300">{stats.openCasesCount}</p>
          <p className="text-[11px] text-slate-500">{t.nav.incidents} →</p>
        </div>

        <div
          onClick={() => onNavigate('evidence')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate('evidence')}
          className="bg-slate-900/50 hover:border-cyan-500/40 border border-slate-800 rounded-2xl p-4 space-y-1 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t.overviewTab.sealedEvidenceCount}</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-400">{stats.evidenceCount}</p>
          <p className="text-[11px] text-slate-500">{t.nav.evidence} →</p>
        </div>
      </div>

      {/* Main Grid: Recent History + Privacy & Quick Launch */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Analyses */}
        <div className="lg:col-span-7 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">{t.overviewTab.recentTitle}</h3>
            <span className="text-[11px] font-mono text-slate-500">
              {stats.recentHistory.length} / {stats.totalAnalyses}
            </span>
          </div>

          {stats.recentHistory.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-950/50 border border-slate-800 text-center space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">{t.overviewTab.emptyHistory}</p>
              <button
                type="button"
                onClick={() => onNavigate('analyze')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{t.overviewTab.goToAnalyze}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {stats.recentHistory.map((item) => (
                <div
                  key={item.analysisId + item.createdAt}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                        {item.inputType}
                      </span>
                      <span className="text-xs text-slate-200 font-medium truncate">
                        {item.inputSummary}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 mt-1">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {item.riskScore}/100
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeStyle(
                        item.classification
                      )}`}
                    >
                      {t.status[item.classification]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Quick Launch & Privacy Notice */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>{t.overviewTab.privacySummaryTitle}</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t.overviewTab.privacySummaryDesc}</p>
            <div className="pt-1 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
              >
                {t.nav.settings} →
              </button>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-white text-sm">{t.overviewTab.quickActions}</h3>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => onNavigate('analyze')}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/70 border border-slate-800 text-left text-xs transition-colors"
              >
                <span className="font-medium text-slate-200">{t.nav.analyze}</span>
                <Search className="w-4 h-4 text-cyan-400" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/70 border border-slate-800 text-left text-xs transition-colors"
              >
                <span className="font-medium text-slate-200">{t.nav.reports}</span>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('learn')}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/70 border border-slate-800 text-left text-xs transition-colors"
              >
                <span className="font-medium text-slate-200">{t.nav.learn}</span>
                <GraduationCap className="w-4 h-4 text-purple-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
