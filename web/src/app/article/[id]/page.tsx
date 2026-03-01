import type { Metadata } from 'next';
import { getArticleById } from '@/lib/queries';
import ArticleDetailPageClient from '@/components/pages/ArticleDetailPageClient';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const article = await getArticleById(Number(id));
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
        images: [{ url: '/thumbnails/logo-08-coral-1932x828.png' }],
      },
    };
  } catch {
    return { title: '매물 상세' };
  }
}

export default function ArticleDetailPage() {
  return <ArticleDetailPageClient />;
}
