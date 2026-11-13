import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Skeleton, AnalyzeWorkspaceSkeleton } from '../components/common/SkeletonLoader';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

describe('UI Feedback & Accessible Skeletons (UX-10)', () => {
  it('renders generic Skeleton with aria-hidden="true" and pulsing styling', () => {
    const html = renderToString(<Skeleton className="w-24 h-4" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('animate-pulse');
    expect(html).toContain('w-24 h-4');
  });

  it('renders AnalyzeWorkspaceSkeleton with status role and bilingual sr-only descriptions', () => {
    const idHtml = renderToString(<AnalyzeWorkspaceSkeleton language="id" />);
    expect(idHtml).toContain('role="status"');
    expect(idHtml).toContain('aria-busy="true"');
    expect(idHtml).toContain('Menganalisis indikator keamanan, mohon tunggu...');

    const enHtml = renderToString(<AnalyzeWorkspaceSkeleton language="en" />);
    expect(enHtml).toContain('role="status"');
    expect(enHtml).toContain('Analyzing security indicators, please wait...');
  });
});

describe('React Error Boundary (UX-10)', () => {
  it('renders children when no runtime error occurs', () => {
    const html = renderToString(
      <ErrorBoundary>
        <div id="test-child">SecurAI Normal Workspace</div>
      </ErrorBoundary>
    );
    expect(html).toContain('SecurAI Normal Workspace');
    expect(html).not.toContain('Terjadi Kendala Runtime Aplikasi');
  });

  it('derives state correctly from error via getDerivedStateFromError', () => {
    const error = new Error('Simulated memory fault');
    const state = ErrorBoundary.getDerivedStateFromError(error);
    expect(state.hasError).toBe(true);
    expect(state.error).toBe(error);
  });

  it('renders accessible fallback UI when in error state', () => {
    // Manually instantiate and inspect error rendering
    const boundary = new ErrorBoundary({
      children: <div>Child</div>,
    });
    boundary.state = {
      hasError: true,
      error: new Error('Critical UI failure'),
      errorInfo: { componentStack: '\n    in CrashingComponent\n    in App' },
      copied: false,
    };

    const rendered = boundary.render() as React.ReactElement;
    const html = renderToString(rendered);

    expect(html).toContain('role="alert"');
    expect(html).toContain('Terjadi Kendala Runtime Aplikasi');
    expect(html).toContain('Critical UI failure');
    expect(html).toContain('Data Brankas Aman (Local-First Guarantee)');
    expect(html).toContain('Muat Ulang Aplikasi');
    expect(html).toContain('Coba Pulihkan Sesi');
  });
});
