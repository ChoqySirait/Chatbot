import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check, Shield } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Local telemetry in console for developer and operator debugging
    console.error('[SecurAI ErrorBoundary caught an unhandled client error]:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
    this.props.onReset?.();
  };

  public handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public handleCopyDetails = async () => {
    const { error, errorInfo } = this.state;
    const text = [
      '--- SecurAI Client Error Report ---',
      `Timestamp: ${new Date().toISOString()}`,
      `Error: ${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
      'Stack Trace:',
      error?.stack || 'No stack available',
      'Component Stack:',
      errorInfo?.componentStack || 'No component stack available',
      '----------------------------------',
    ].join('\n');

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2500);
      }
    } catch {
      // Clipboard write fallback
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, copied } = this.state;

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-4 sm:p-6"
        >
          <div className="max-w-xl w-full bg-slate-900/95 border border-rose-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white">
                  Terjadi Kendala Runtime Aplikasi
                </h1>
                <p className="text-xs text-slate-400">
                  Application Runtime Encountered an Error
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs text-cyan-200 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-cyan-300">Data Brankas Aman (Local-First Guarantee)</p>
                <p className="text-slate-300 mt-0.5 text-[11px] leading-relaxed">
                  Catatan insiden dan brankas bukti Anda tersimpan secara persisten di IndexedDB lokal perangkat Anda dan tidak terpengaruh oleh kendala render antarmuka ini.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Detail Kesalahan Teknis
              </span>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-rose-300 overflow-x-auto max-h-40 whitespace-pre-wrap select-all">
                {error?.message || 'Unknown runtime error occurred.'}
                {errorInfo?.componentStack ? `\n\nComponent Stack:${errorInfo.componentStack}` : ''}
              </pre>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Muat Ulang Aplikasi</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
              >
                <span>Coba Pulihkan Sesi</span>
              </button>

              <button
                type="button"
                onClick={this.handleCopyDetails}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                title="Salin rincian error untuk pelaporan bug"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Detail</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
