import HomePageClient from '@/components/pages/HomePageClient';
import { getFullBriefing, getLeaderboard, getTopPriceDrops, getDongRankings } from '@/lib/queries';
import { cached } from '@api/_lib/cache.js';

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: '부동산 급매 레이더',
  alternateName: ['부동산급매레이더', '급매레이더'],
  url: 'https://estate-rader.com',
  description: '부동산 급매 검색의 모든 것. 전국 아파트 급매물 실시간 검색, AI 급매 점수, 시세 비교, 실거래가 분석.',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://estate-rader.com/search?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
};

export const revalidate = 300; // ISR: regenerate every 5 minutes

export default async function HomePage() {
  const [briefing, leaderboard, topPriceDrops, dongRankings] = await Promise.all([
    cached('ssr:briefing', 300_000, () => getFullBriefing()).catch(() => null),
    cached('ssr:leaderboard:all:10', 300_000, () => getLeaderboard(10)).catch(() => []),
    cached('ssr:top-drops:10', 300_000, () => getTopPriceDrops(10)).catch(() => []),
    cached('ssr:dong-rankings:keyword:10', 300_000, () => getDongRankings(10, 'keyword')).catch(() => []),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePageClient
        initialBriefing={briefing}
        initialLeaderboard={leaderboard || []}
        initialTopPriceDrops={topPriceDrops || []}
        initialDongRankings={dongRankings || []}
      />
    </>
  );
}
