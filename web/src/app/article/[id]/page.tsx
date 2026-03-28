import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getArticleById, getArticleAssessment, getArticlePriceHistory, getArticleRealTransactions } from '@/lib/queries';
import { cached } from '@api/_lib/cache.js';
import ArticleDetailPageClient from '@/components/pages/ArticleDetailPageClient';

interface Props {
  params: Promise<{ id: string }>;
}

async function getArticleCached(id: number) {
  return cached(`ssr:article:${id}`, 300_000, () => getArticleById(id));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const article = await getArticleCached(Number(id));
    if (!article) {
      return { title: '매물을 찾을 수 없습니다' };
    }
    const complexName = article.complexes.complex_name;
    const area = `${article.exclusive_space}㎡`;
    const price = article.formatted_price;
    const title = `${complexName} ${area} ${price}`;
    const description = `${complexName} ${area} ${price} - ${article.is_bargain ? '급매물' : '매물'} 상세 정보, 시세 비교, 가격 변동 내역`;

    return {
      title,
      description,
      openGraph: {
        title: `${title} | 부동산 급매 레이더`,
        description,
      },
    };
  } catch {
    return { title: '매물 상세' };
  }
}

export default async function ArticleDetailPage({ params }: Props) {
  const { id } = await params;
  const numId = Number(id);
  const article = await getArticleCached(numId).catch(() => null);
  if (!article) notFound();

  // Fetch assessment, price history, and real transactions in parallel for SSR
  const [assessment, priceHistory, realTx] = await Promise.all([
    cached(`ssr:assessment:${numId}`, 300_000, () => getArticleAssessment(numId)).catch(() => null),
    cached(`ssr:price-history:${numId}`, 300_000, () => getArticlePriceHistory(numId)).catch(() => []),
    article.trade_type === 'A1'
      ? cached(`ssr:real-tx:${article.complex_id}:${article.exclusive_space}`, 300_000,
          () => getArticleRealTransactions(article.complex_id, article.exclusive_space, 12)
        ).catch(() => ({ trend: [], transactions: [] }))
      : Promise.resolve({ trend: [], transactions: [] }),
  ]);

  return (
    <ArticleDetailPageClient
      initialArticle={article}
      initialAssessment={assessment}
      initialPriceHistory={priceHistory}
      initialTrend={realTx.trend}
      initialTransactions={realTx.transactions}
    />
  );
}
