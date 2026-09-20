'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      className="text-xs text-white/80 hover:text-white border border-white/30 rounded px-2 py-1 disabled:opacity-50 transition"
      onClick={async () => {
        setLoading(true);
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
      }}
      disabled={loading}
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
