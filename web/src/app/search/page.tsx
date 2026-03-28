import type { Metadata } from 'next';
import { getPopularComplexes, getSidoList, getRegionalTopBargains } from '@/lib/queries';
import { cached } from '@api/_lib/cache.js';
import SearchPageClient from '@/components/pages/SearchPageClient';

export const metadata: Metadata = {
  title: '검색',
  description: '아파트 단지를 검색하세요. 전국 아파트 단지 정보와 매물을 한 눈에 확인할 수 있습니다.',
};

export const revalidate = 300;

export default async function SearchPage() {
  const [popularComplexes, sidoList, regionalBargains] = await Promise.all([
    cached('ssr:popular-complexes', 300_000, () => getPopularComplexes()).catch(() => []),
    cached('ssr:sido-list', 600_000, () => getSidoList()).catch(() => []),
    cached('ssr:regional-bargains:서울특별시', 120_000, () => getRegionalTopBargains('서울특별시', 10)).catch(() => []),
  ]);

  return (
    <SearchPageClient
      initialPopularComplexes={popularComplexes}
      initialSidoList={sidoList}
      initialRegionalBargains={regionalBargains}
    />
  );
}
