import React, { useEffect, useState } from 'react';
import { Shield, User, Terminal } from 'lucide-react';
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
    <header className="border-b border-slate-800/80 bg-[#0b1120]/95 backdrop-blur sticky top-0 z-50 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">
          {/* Brand & Compact Subtitle */}
          <div className="flex items-center gap-2.5 min-w-0">
            <Shield className="w-5 h-5 text-cyan-400 shrink-0 stroke-[2]" aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-base text-white tracking-tight">
                  Secur<span className="text-cyan-400">AI</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500">v2.6</span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block truncate">
                {t.app.subtitle}
              </p>
            </div>
          </div>

          {/* Right Controls: Subtle Health Indicator, Mode Switcher, Language Switcher */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <span
              role="status"
              aria-live="polite"
              className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-slate-400 pr-1"
              title="Backend Health (/api/v1/health)"
            >
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full ${
                  backendOnline === true
                    ? 'bg-emerald-400'
                    : backendOnline === false
                    ? 'bg-rose-500'
                    : 'bg-amber-400'
                }`}
              />
              <span>
                {backendOnline === true ? 'API Online' : backendOnline === false ? 'API Offline' : 'Checking'}
              </span>
            </span>

            {/* Consumer vs Analyst Mode Toggle */}
            <div
              role="group"
              aria-label={language === 'en' ? 'Presentation mode' : 'Mode tampilan'}
              className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800"
            >
              <button
                type="button"
                aria-pressed={mode === 'consumer'}
                onClick={() => mode !== 'consumer' && toggleMode()}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === 'consumer'
                    ? 'bg-slate-800 text-cyan-300 border border-slate-700/80'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
                title={t.modes.consumerDesc}
              >
                <User className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t.modes.consumer}</span>
              </button>

              <button
                type="button"
                aria-pressed={mode === 'analyst'}
                onClick={() => mode !== 'analyst' && toggleMode()}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === 'analyst'
                    ? 'bg-slate-800 text-indigo-300 border border-slate-700/80'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
                title={t.modes.analystDesc}
              >
                <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t.modes.analyst}</span>
              </button>
            </div>

            {/* Language Switcher */}
            <div
              role="group"
              aria-label={language === 'en' ? 'Interface language' : 'Bahasa antarmuka'}
              className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-xs"
            >
              <button
                type="button"
                aria-pressed={language === 'id'}
                aria-label="Bahasa Indonesia"
                onClick={() => setLanguage('id')}
                className={`px-2 py-1 rounded-md font-medium transition-colors ${
                  language === 'id' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ID
              </button>
              <button
                type="button"
                aria-pressed={language === 'en'}
                aria-label="English"
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded-md font-medium transition-colors ${
                  language === 'en' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
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
