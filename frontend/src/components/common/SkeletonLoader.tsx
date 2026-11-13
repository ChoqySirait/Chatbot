import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div
      aria-hidden="true"
      className={`bg-slate-800/80 animate-pulse rounded-lg ${className}`}
      {...props}
    />
  );
};

export const AnalyzeWorkspaceSkeleton: React.FC<{ language?: 'id' | 'en' }> = ({
  language = 'id',
}) => {
  return (
    <div
      role="status"
      aria-busy="true"
      className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6"
    >
      <span className="sr-only">
        {language === 'en'
          ? 'Analyzing security indicators, please wait...'
          : 'Menganalisis indikator keamanan, mohon tunggu...'}
      </span>

      {/* Header bar placeholder */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl bg-slate-800" />
          <div className="space-y-1.5">
            <Skeleton className="w-36 h-4 bg-slate-800" />
            <Skeleton className="w-24 h-3 bg-slate-800/60" />
          </div>
        </div>
        <Skeleton className="w-24 h-7 rounded-full bg-slate-800" />
      </div>

      {/* Risk Gauge & Summary Metrics placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
          <Skeleton className="w-16 h-3 bg-slate-800" />
          <Skeleton className="w-24 h-8 bg-slate-800" />
          <Skeleton className="w-32 h-2.5 bg-slate-800/60" />
        </div>
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
          <Skeleton className="w-20 h-3 bg-slate-800" />
          <Skeleton className="w-28 h-8 bg-slate-800" />
          <Skeleton className="w-36 h-2.5 bg-slate-800/60" />
        </div>
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
          <Skeleton className="w-16 h-3 bg-slate-800" />
          <Skeleton className="w-20 h-8 bg-slate-800" />
          <Skeleton className="w-28 h-2.5 bg-slate-800/60" />
        </div>
      </div>

      {/* Forensic Findings list placeholder */}
      <div className="space-y-3">
        <Skeleton className="w-40 h-4 bg-slate-800" />
        <div className="space-y-2">
          <Skeleton className="w-full h-12 rounded-xl bg-slate-950/80 border border-slate-800/80" />
          <Skeleton className="w-full h-12 rounded-xl bg-slate-950/80 border border-slate-800/80" />
          <Skeleton className="w-full h-12 rounded-xl bg-slate-950/80 border border-slate-800/80" />
        </div>
      </div>

      {/* Recommended Actions placeholder */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <Skeleton className="w-48 h-4 bg-slate-800" />
        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2">
          <Skeleton className="w-full h-3 bg-slate-800" />
          <Skeleton className="w-3/4 h-3 bg-slate-800/80" />
          <Skeleton className="w-1/2 h-3 bg-slate-800/60" />
        </div>
      </div>
    </div>
  );
};
