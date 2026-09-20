import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth';

export default async function RootPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect('/dashboard');
  }
  redirect('/login');
}
