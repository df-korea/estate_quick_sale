import type { Metadata } from 'next';
import SettingsPageClient from '@/components/pages/SettingsPageClient';

export const metadata: Metadata = {
  title: '설정',
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}
