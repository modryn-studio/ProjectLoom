'use client';

import { useRouter } from 'next/navigation';
import { LandingPage } from '@/components/landing/LandingPage';

export default function HomePage() {
  const router = useRouter();
  return <LandingPage onEnter={() => router.push('/canvas')} />;
}
