'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface unhandled client errors to the console. In production, wire this to
    // Sentry / Datadog / equivalent — the page itself stays the same.
    console.error('RUTHEX LMS error boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="card-padded max-w-md text-center shadow-lg">
        <div className="text-5xl mb-2">⚠</div>
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-slate-600 mt-2">
          A page-level error stopped this view. Your data is safe — try again, or jump to the dashboard.
        </p>
        {error.digest && (
          <div className="mt-3 text-xs font-mono text-slate-500">Reference: {error.digest}</div>
        )}
        <div className="mt-6 flex gap-3 justify-center">
          <button onClick={() => reset()} className="btn btn-primary">Try again</button>
          <a href="/dashboard" className="btn btn-secondary">Open dashboard</a>
        </div>
      </div>
    </div>
  );
}
