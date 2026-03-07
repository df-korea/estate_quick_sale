import type { Metadata } from 'next';
import CommunityPageClient from '@/components/pages/CommunityPageClient';
import { getCommunityPosts } from '@/lib/queries';
import { cached } from '@api/_lib/cache.js';

export const metadata: Metadata = {
  title: '게시판',
  description: '부동산 급매 관련 커뮤니티 게시판. 급매 정보, 투자 분석, 지역 정보를 나누세요.',
};

export const revalidate = 60; // ISR: regenerate every 60 seconds

export default async function CommunityPage() {
  const initialPosts = await cached('ssr:community:newest:1', 60_000, () => getCommunityPosts(1, 20)).catch(() => []);
  return <CommunityPageClient initialPosts={initialPosts} />;
}
