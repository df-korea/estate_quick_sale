import type { Metadata } from 'next';
import RtPageClient from '@/components/pages/RtPageClient';

export const metadata: Metadata = {
  title: '실거래 변동 지도 | 부동산 급매 레이더',
  description: '전국 아파트 실거래가 변동률을 지도에서 한눈에. 시도 → 시군구 → 단지별 드릴다운으로 가격 변동을 확인하세요.',
};

export default function RealTransactionsPage() {
  return <RtPageClient />;
}
