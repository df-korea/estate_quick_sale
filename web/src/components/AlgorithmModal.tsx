'use client';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AlgorithmModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius-lg)',
          maxWidth: 360,
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto',
          padding: 'var(--space-24)',
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-16)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 17 }}>급매 점수 알고리즘</h3>
          <button onClick={onClose} style={{ padding: 4, color: 'var(--gray-400)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <Section title="키워드 급매">
          <p className="text-sm text-gray" style={{ lineHeight: 1.5, marginBottom: 8 }}>
            매물 설명에 아래 키워드 포함 시 별도 표시
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {['급매', '급처분', '급전', '급히', '마이너스피', '마피', '급급', '손절', '최저가', '급하게'].map(kw => (
              <span key={kw} style={{
                padding: '2px 8px',
                background: 'var(--red-50, #fff1f2)',
                color: 'var(--red-500)',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 600,
              }}>{kw}</span>
            ))}
          </div>
        </Section>

        <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

        <Section title="가격 급매점수 (0~100)">
          <Item num="1" title="단지내 호가비교 (최대 40점)" desc="동일 단지 동일평형 매물 평균가 대비 할인율 (0.5%=1점)" />
          <Item num="2" title="실거래비교 (최대 40점)" desc="최근 실거래 5건 평균 대비 할인율 (0.5%=1점)" />
          <Item num="3" title="인하 이력 (최대 10점)" desc="호가 인하 횟수 (1회=2점, 최대 5회)" />
          <Item num="4" title="누적 인하율 (최대 10점)" desc="최초가 대비 현재가 하락률 (2%=1점)" />
          <div className="text-sm" style={{ marginTop: 8, padding: '8px 12px', background: 'var(--blue-50)', borderRadius: 8, color: 'var(--blue-600)' }}>
            40점 이상이면 "가격 급매"로 판정
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, color: 'var(--gray-800)' }}>{title}</h4>
      {children}
    </div>
  );
}

function Item({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="flex gap-8" style={{ marginBottom: 8 }}>
      <span style={{
        width: 20, height: 20, borderRadius: '50%',
        background: 'var(--gray-100)', color: 'var(--gray-600)',
        fontSize: 11, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        marginTop: 1,
      }}>{num}</span>
      <div>
        <div className="text-sm" style={{ fontWeight: 600 }}>{title}</div>
        <div className="text-xs text-gray" style={{ marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}
