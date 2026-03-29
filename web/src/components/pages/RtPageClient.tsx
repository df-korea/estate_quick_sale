'use client';

import { Suspense, lazy, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRtWeekly } from '@/hooks/useRtMapData';
import { formatPrice } from '@/utils/format';
import { changeRateTextColor } from '@/utils/mapCodes';

const RtMapExplorer = lazy(() => import('@/components/map/RtMapExplorer'));

const SIDO_LIST = ['서울시','경기도','인천시','부산시','대구시','대전시','광주시','울산시','세종시','강원도','충청북도','충청남도','전북도','전라남도','경상북도','경상남도','제주도'];
const SIDO_SHORT: Record<string, string> = {
  '서울시':'서울','경기도':'경기','인천시':'인천','부산시':'부산','대구시':'대구',
  '대전시':'대전','광주시':'광주','울산시':'울산','세종시':'세종','강원도':'강원',
  '충청북도':'충북','충청남도':'충남','전북도':'전북','전라남도':'전남',
  '경상북도':'경북','경상남도':'경남','제주도':'제주',
};

export default function RtPageClient() {
  const [activeSido, setActiveSido] = useState<string | null>(null);
  const { data: weeklyItems, loading: weeklyLoading } = useRtWeekly(activeSido);
  const nav = useRouter();

  return (
    <div style={{ paddingTop: 8, paddingBottom: 'calc(var(--tab-height) + var(--safe-bottom) + 16px)' }}>
      <Suspense fallback={
        <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)' }}>
          실거래 지도 로딩 중...
        </div>
      }>
        <RtMapExplorer />
      </Suspense>

      {/* 이번주 실거래 */}
      <div style={{ marginTop: 20, padding: '0 2px' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--gray-900)' }}>
          이번주 실거래
        </div>

        {/* Sido tabs */}
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8,
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}>
          <button
            className={`chip ${!activeSido ? 'chip--active' : ''}`}
            onClick={() => setActiveSido(null)}
          >전체</button>
          {SIDO_LIST.map(sido => (
            <button
              key={sido}
              className={`chip ${activeSido === sido ? 'chip--active' : ''}`}
              onClick={() => setActiveSido(sido)}
              style={{ whiteSpace: 'nowrap' }}
            >
              {SIDO_SHORT[sido] || sido}
            </button>
          ))}
        </div>

        {/* Transaction cards */}
        {weeklyLoading ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--gray-400)', fontSize: 13 }}>
            로딩 중...
          </div>
        ) : weeklyItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--gray-400)', fontSize: 13 }}>
            이번주 실거래 데이터가 없습니다
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {weeklyItems.map((item, idx) => (
              <button
                key={item.id || idx}
                className="press-effect"
                onClick={() => item.complex_id && nav.push(`/complex/${item.complex_id}`)}
                style={{
                  background: 'var(--white)',
                  border: '1px solid var(--gray-100)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  textAlign: 'left',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-900)' }}>
                      {item.complex_name || item.apt_nm}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>
                      {item.division} {item.total_households ? `· ${item.total_households.toLocaleString()}세대` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900)' }}>
                      {formatPrice(item.deal_amount)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                      {item.exclu_use_ar.toFixed(0)}㎡ ({item.pyeong}평)
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                    {item.floor && <span style={{ color: 'var(--gray-500)' }}>{item.floor}층</span>}
                    <span style={{ color: 'var(--gray-500)' }}>
                      {item.deal_month}/{item.deal_day || '?'}
                    </span>
                  </div>
                  {item.price_diff !== null && item.price_diff !== 0 && (
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: changeRateTextColor(item.price_diff),
                    }}>
                      {item.price_diff > 0 ? '▲' : '▼'} {Math.abs(item.price_diff).toLocaleString()}만
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
