import type { Metadata } from 'next';
import CommunityPageClient from '@/components/pages/CommunityPageClient';

export const metadata: Metadata = {
  title: '게시판',
  description: '부동산 급매 관련 커뮤니티 게시판. 급매 정보, 투자 분석, 지역 정보를 나누세요.',
};

export default function CommunityPage() {
  return <CommunityPageClient />;
}
