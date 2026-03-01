import type { Metadata } from 'next';
import CommunityWritePageClient from '@/components/pages/CommunityWritePageClient';

export const metadata: Metadata = {
  title: '글쓰기',
};

export default function CommunityWritePage() {
  return <CommunityWritePageClient />;
}
