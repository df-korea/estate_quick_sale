import type { Assessment } from '../types';
import { formatWon, formatPercent } from '../utils/format';

interface Props {
  assessment: Assessment;
}

export default function PriceAssessment({ assessment }: Props) {
  return (
    <div className="card" style={{ marginBottom: 'var(--space-16)' }}>
      <div className="card-body">
        <h4 style={{ fontWeight: 700, marginBottom: 'var(--space-12)' }}>가격 비교</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-12)' }}>
          {/* vs complex avg */}
          <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', padding: 'var(--space-12)' }}>
            <div className="text-xs text-gray" style={{ marginBottom: 4 }}>단지 평균 대비</div>
            {assessment.complex_avg_price ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: assessment.discount_vs_complex != null && assessment.discount_vs_complex < 0 ? 'var(--blue-600)' : 'var(--red-500)' }}>
                  {formatPercent(assessment.discount_vs_complex)}
                </div>
                <div className="text-xs text-gray">
                  평균 {formatWon(assessment.complex_avg_price)} ({assessment.complex_listing_count}건)
                </div>
              </>
            ) : (
              <div className="text-sm text-gray">비교 데이터 없음</div>
            )}
          </div>

          {/* vs real tx */}
          <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', padding: 'var(--space-12)' }}>
            <div className="text-xs text-gray" style={{ marginBottom: 4 }}>실거래 대비</div>
            {assessment.tx_avg_price ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: assessment.discount_vs_transaction != null && assessment.discount_vs_transaction < 0 ? 'var(--blue-600)' : 'var(--red-500)' }}>
                  {formatPercent(assessment.discount_vs_transaction)}
                </div>
                <div className="text-xs text-gray">
                  실거래 평균 {formatWon(assessment.tx_avg_price)} ({assessment.tx_count}건)
                </div>
              </>
            ) : (
              <div className="text-sm text-gray">비교 데이터 없음</div>
            )}
          </div>
        </div>

        {/* Score factors */}
        <div style={{ marginTop: 'var(--space-12)' }}>
          <div className="text-xs text-gray" style={{ marginBottom: 'var(--space-8)' }}>급매 점수 구성</div>
          {assessment.factors.map((f, i) => (
            <div key={i} className="flex items-center justify-between" style={{ padding: 'var(--space-4) 0' }}>
              <span className="text-sm">{f.name}</span>
              <span className="text-sm text-bold" style={{ color: 'var(--blue-500)' }}>+{f.value}</span>
            </div>
          ))}
        </div>

        {/* Extra info */}
        <div className="divider" />
        <div className="flex gap-16 text-sm text-gray">
          <span>등록 {assessment.days_on_market}일</span>
          <span>호가 변동 {assessment.price_change_count}회</span>
          {assessment.is_lowest_in_complex && <span className="text-red">단지 최저가</span>}
        </div>
      </div>
    </div>
  );
}
