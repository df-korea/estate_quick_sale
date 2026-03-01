import type { Metadata } from 'next';
import WatchlistPageClient from '@/components/pages/WatchlistPageClient';

export const metadata: Metadata = {
  title: '관심목록',
};

export default function WatchlistPage() {
  return <WatchlistPageClient />;
}
