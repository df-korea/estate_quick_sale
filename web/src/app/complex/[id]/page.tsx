import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getComplexById } from '@/lib/queries';
import { cached } from '@api/_lib/cache.js';
import ComplexDetailPageClient from '@/components/pages/ComplexDetailPageClient';

interface Props {
  params: Promise<{ id: string }>;
}

async function getComplexCached(id: number) {
  return cached(`ssr:complex:${id}`, 300_000, () => getComplexById(id));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const complex = await getComplexCached(Number(id));
    if (!complex) {
      return { title: '단지를 찾을 수 없습니다' };
    }
    const totalListings = complex.deal_count + complex.lease_count + complex.rent_count;
    const title = `${complex.complex_name}`;
    const description = `${complex.complex_name} - 매물 ${totalListings}건, ${complex.total_households ? `총 ${complex.total_households}세대` : ''} 급매물 분석, 실거래가, 시세 정보`;

    return {
      title,
      description,
      openGraph: {
        title: `${title} | 부동산 급매 레이더`,
        description,
      },
    };
  } catch {
    return { title: '단지 상세' };
  }
}

export default async function ComplexDetailPage({ params }: Props) {
  const { id } = await params;
  const complex = await getComplexCached(Number(id)).catch(() => null);
  if (!complex) notFound();
  return <ComplexDetailPageClient initialComplex={complex} />;
}
