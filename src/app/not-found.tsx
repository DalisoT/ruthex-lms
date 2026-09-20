import Link from 'next/link';

export const metadata = { title: 'Not found — RUTHEX' };

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="card-padded max-w-md text-center shadow-lg">
        <div className="text-6xl mb-2">·</div>
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="text-slate-600 mt-2">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link href="/" className="btn btn-primary">Back to home</Link>
          <Link href="/dashboard" className="btn btn-secondary">Open dashboard</Link>
        </div>
      </div>
    </div>
  );
}
