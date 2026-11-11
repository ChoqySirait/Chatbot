import React, { useEffect, useState } from 'react';
import { Shield, User, Terminal, Lock, Activity } from 'lucide-react';
import { useLanguage } from '../../context/useLanguage';
import { useMode } from '../../context/useMode';

export const Header: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { mode, toggleMode } = useMode();
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/v1/health');
        if (res.ok) {
          const data = await res.json();
          setBackendOnline(data.status === 'healthy' || data.status === 'ok');
        } else {
          setBackendOnline(false);
        }
      } catch {
        setBackendOnline(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="border-b border-slate-800 bg-[#0f172a]/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Platform Info */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 shadow-lg shadow-cyan-500/20 text-white">
              <Shield className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">Secur<span className="text-cyan-400">AI</span></span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  v2.5
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                {t.app.subtitle}
              </p>
            </div>
          </div>

          {/* Privacy & Health Badges */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700/60 text-xs text-slate-300">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.app.privacyBadge}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700/60 text-xs text-slate-300">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span className="flex items-center gap-1.5">
                API:
                <span className={`w-2 h-2 rounded-full ${backendOnline === true ? 'bg-emerald-400 animate-pulse' : backendOnline === false ? 'bg-rose-500' : 'bg-amber-400'}`} />
                {backendOnline === true ? 'Online' : backendOnline === false ? 'Offline' : 'Checking'}
              </span>
            </div>
          </div>

          {/* Mode Switcher & Language Selector */}
          <div className="flex items-center gap-3">
            {/* Consumer vs Analyst Mode Toggle */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => mode !== 'consumer' && toggleMode()}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  mode === 'consumer'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t.modes.consumerDesc}
              >
                <User className="w-3.5 h-3.5" />
                <span>{t.modes.consumer}</span>
              </button>

              <button
                type="button"
                onClick={() => mode !== 'analyst' && toggleMode()}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  mode === 'analyst'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t.modes.analystDesc}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>{t.modes.analyst}</span>
              </button>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setLanguage('id')}
                className={`px-2 py-1 rounded font-semibold ${
                  language === 'id' ? 'bg-slate-700 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ID
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded font-semibold ${
                  language === 'en' ? 'bg-slate-700 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
