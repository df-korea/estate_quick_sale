import type { Metadata } from 'next';
import SearchPageClient from '@/components/pages/SearchPageClient';

export const metadata: Metadata = {
  title: '검색',
  description: '아파트 단지를 검색하세요. 전국 아파트 단지 정보와 매물을 한 눈에 확인할 수 있습니다.',
};

export default function SearchPage() {
  return <SearchPageClient />;
}
