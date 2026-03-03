import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWatchlist } from '../hooks/useWatchlist';
import { useComplexSearch, useComplexPyeongTypes } from '../hooks/useComplex';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { formatWon } from '../utils/format';
import type { ComplexSearchResult } from '../types';

export default function WatchlistPage() {
  const { data, loading, remove, add } = useWatchlist();
  const nav = useNavigate();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="page">
      <div className="page-header">
        <h1>관심 단지</h1>
        <div className="flex items-center gap-8">
          {data.length > 0 && <span className="text-sm text-gray">{data.length}개</span>}
          <button onClick={() => setShowAdd(true)} style={{
            padding: '6px 12px', borderRadius: 'var(--radius-md)',
            background: 'var(--blue-500)', color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 600,
          }}>+ 추가</button>
        </div>
      </div>
      <div className="page-content">
        {loading && <LoadingSpinner />}

        {!loading && data.length === 0 && (
          <EmptyState message="관심 단지를 추가해주세요" />
        )}

        {!loading && data.length > 0 && (
          <div>
            {data.map(w => (
              <div key={w.id} className="card" style={{ marginBottom: 'var(--space-8)' }}>
                <div className="card-body" style={{ padding: 'var(--space-12) var(--space-16)' }}>
                  <div className="flex items-center justify-between">
                    <div style={{ cursor: 'pointer', minWidth: 0, flex: 1 }}
                      onClick={() => nav(`/complex/${w.complex_id}`)}>
                      <div className="truncate" style={{ fontWeight: 600 }}>{w.complex_name}</div>
                      <div className="flex items-center gap-8 text-sm text-gray" style={{ marginTop: 'var(--space-4)' }}>
                        {w.pyeong_type && <span>{w.pyeong_type}</span>}
                        {w.property_type !== 'all' && <span>{w.property_type === 'APT' ? '아파트' : '오피스텔'}</span>}
                        <span>매물 {w.total_articles}건</span>
                        {w.bargain_count > 0 && <span className="text-red">급매 {w.bargain_count}</span>}
                        {w.new_today > 0 && <span className="text-blue">오늘 +{w.new_today}</span>}
                      </div>
                      {w.avg_price && (
                        <div className="text-sm" style={{ marginTop: 'var(--space-4)' }}>
                          평균 {formatWon(w.avg_price)}
                          {w.min_price && ` · 최저 ${formatWon(w.min_price)}`}
                        </div>
                      )}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); remove(w.id); }}
                      style={{ color: 'var(--gray-400)', padding: 8, flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddWatchlistModal onClose={() => setShowAdd(false)} onAdd={add} />}
    </div>
  );
}

// ── Add Watchlist Modal ──

function AddWatchlistModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (complexId: number, pyeongType?: string, propertyType?: string) => Promise<void>;
}) {
  const [step, setStep] = useState<'search' | 'options'>('search');
  const [query, setQuery] = useState('');
  const { results, loading } = useComplexSearch(query);
  const [selected, setSelected] = useState<ComplexSearchResult | null>(null);
  const [propertyType, setPropertyType] = useState('all');
  const [pyeongType, setPyeongType] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: pyeongTypes, loading: pyeongLoading } = useComplexPyeongTypes(
    selected ? String(selected.id) : undefined
  );

  const handleSelect = (c: ComplexSearchResult) => {
    setSelected(c);
    setStep('options');
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await onAdd(selected.id, pyeongType || undefined, propertyType);
      onClose();
    } catch {
      alert('추가 실패. 이미 등록된 단지일 수 있습니다.');
    }
    setSubmitting(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div style={{
        position: 'relative', background: 'var(--white)', borderRadius: '16px 16px 0 0',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        padding: 'var(--space-16)',
      }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-12)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
            {step === 'search' ? '관심 단지 추가' : selected?.complex_name}
          </h2>
          <button onClick={onClose} style={{ padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 'search' && (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="단지명을 검색하세요"
              autoFocus
              style={{
                width: '100%', padding: 'var(--space-12) var(--space-16)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
                fontSize: 'var(--text-md)', outline: 'none', marginBottom: 'var(--space-8)',
              }}
            />
            {loading && <LoadingSpinner />}
            {results.map(c => (
              <div key={c.id}
                style={{ padding: 'var(--space-12) 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => handleSelect(c)}>
                <div style={{ fontWeight: 600 }}>{c.complex_name}</div>
                <div className="text-sm text-gray">
                  {c.property_type && `${c.property_type} · `}
                  {c.total_households && `${c.total_households}세대`}
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 'options' && (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {/* 주거타입 선택 */}
            <div style={{ marginBottom: 'var(--space-16)' }}>
              <label className="text-sm" style={{ fontWeight: 600, display: 'block', marginBottom: 'var(--space-8)' }}>
                주거타입
              </label>
              <div className="flex gap-8">
                {[
                  { value: 'all', label: '전체' },
                  { value: 'APT', label: '아파트' },
                  { value: 'OPST', label: '오피스텔' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setPropertyType(opt.value)} style={{
                    padding: '8px 16px', borderRadius: 'var(--radius-md)',
                    border: '1px solid',
                    borderColor: propertyType === opt.value ? 'var(--blue-500)' : 'var(--border)',
                    background: propertyType === opt.value ? 'var(--blue-50)' : 'transparent',
                    color: propertyType === opt.value ? 'var(--blue-500)' : 'var(--gray-700)',
                    fontWeight: propertyType === opt.value ? 600 : 400,
                    fontSize: 'var(--text-sm)',
                  }}>{opt.label}</button>
                ))}
              </div>
            </div>

            {/* 평형 선택 */}
            <div style={{ marginBottom: 'var(--space-16)' }}>
              <label className="text-sm" style={{ fontWeight: 600, display: 'block', marginBottom: 'var(--space-8)' }}>
                평형
              </label>
              {pyeongLoading ? <LoadingSpinner /> : (
                <select
                  value={pyeongType}
                  onChange={e => setPyeongType(e.target.value)}
                  style={{
                    width: '100%', padding: 'var(--space-12) var(--space-16)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
                    fontSize: 'var(--text-md)', outline: 'none', background: 'var(--white)',
                  }}
                >
                  <option value="">전체</option>
                  {pyeongTypes.map(pt => (
                    <option key={pt.space_name} value={pt.space_name}>
                      {pt.space_name} ({pt.pyeong}평, {pt.article_count}건)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex gap-8">
              <button onClick={() => { setStep('search'); setSelected(null); }} style={{
                flex: 1, padding: 'var(--space-12)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)', background: 'var(--white)',
                fontSize: 'var(--text-md)', fontWeight: 600,
              }}>이전</button>
              <button onClick={handleSubmit} disabled={submitting} style={{
                flex: 2, padding: 'var(--space-12)', borderRadius: 'var(--radius-lg)',
                background: 'var(--blue-500)', color: '#fff',
                fontSize: 'var(--text-md)', fontWeight: 600,
                opacity: submitting ? 0.6 : 1,
              }}>
                {submitting ? '추가 중...' : '추가'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
