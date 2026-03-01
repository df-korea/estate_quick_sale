import type { Metadata } from 'next';
import NotificationSettingsPageClient from '@/components/pages/NotificationSettingsPageClient';

export const metadata: Metadata = {
  title: '알림 설정',
};

export default function NotificationSettingsPage() {
  return <NotificationSettingsPageClient />;
}
