import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPost } from '../hooks/useCommunity';
import { apiFetch } from '../lib/api';
import ArticlePreviewCard from '../components/ArticlePreviewCard';

interface SearchResult {
  id: number;
  deal_price: number;
  formatted_price: string;
  exclusive_space: number;
  trade_type: string;
  complex_name: string;
  article_no: string;
  target_floor?: string;
  total_floor?: string;
  bargain_score?: number;
  bargain_keyword?: string;
}

export default function CommunityWritePage() {
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Article attachment
  const [attachedArticle, setAttachedArticle] = useState<SearchResult | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim() || searching) return;
    setSearching(true);
    try {
      const results = await apiFetch<SearchResult[]>(
        `/articles/search?q=${encodeURIComponent(searchQuery.trim())}&limit=10`
      );
      setSearchResults(results);
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const post = await createPost({
        title,
        content,
        attached_article_id: attachedArticle?.id,
      });
      nav(`/community/${post.id}`, { replace: true });
    } catch {
      alert('게시글 작성에 실패했습니다');
    }
    setSubmitting(false);
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header glass">
        <button onClick={() => nav(-1)} style={{ display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1>글쓰기</h1>
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || !content.trim() || submitting}
          className="press-effect"
          style={{
            padding: '6px 14px',
            background: title.trim() && content.trim() ? 'var(--blue-500)' : 'var(--gray-300)',
            color: 'white',
            borderRadius: 'var(--radius-full)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {submitting ? '등록 중...' : '등록'}
        </button>
      </div>

      <div className="page-content">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          style={{ ...inputStyle, fontWeight: 600, fontSize: 16 }}
        />

        {/* Content */}
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="내용을 입력하세요"
          rows={8}
          style={{
            ...inputStyle,
            resize: 'vertical',
            minHeight: 160,
            lineHeight: 1.6,
          }}
        />

        {/* Article attachment */}
        <div style={{ marginTop: 'var(--space-12)' }}>
          {attachedArticle ? (
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span className="text-xs text-gray">첨부 매물</span>
                <button onClick={() => setAttachedArticle(null)} className="text-xs" style={{ color: 'var(--red-400)' }}>
                  삭제
                </button>
              </div>
              <ArticlePreviewCard article={attachedArticle} clickable={false} />
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(v => !v)}
              className="press-effect"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px dashed var(--gray-300)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--gray-400)',
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              + 매물 첨부
            </button>
          )}
        </div>

        {/* Article search modal */}
        {searchOpen && !attachedArticle && (
          <div style={{ marginTop: 'var(--space-8)' }}>
            <div className="flex gap-8" style={{ marginBottom: 8 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="단지명 또는 매물번호 검색"
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
              />
              <button
                onClick={handleSearch}
                className="press-effect"
                style={{
                  padding: '8px 14px',
                  background: 'var(--blue-500)',
                  color: 'white',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                검색
              </button>
            </div>
            {searching && <div className="text-xs text-gray">검색 중...</div>}
            {searchResults.map(r => (
              <div
                key={r.id}
                onClick={() => { setAttachedArticle(r); setSearchOpen(false); setSearchResults([]); setSearchQuery(''); }}
                className="press-effect"
                style={{ marginBottom: 4, cursor: 'pointer' }}
              >
                <ArticlePreviewCard article={r} clickable={false} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid var(--gray-200)',
  borderRadius: 8,
  background: 'var(--gray-50)',
  fontSize: 14,
  marginBottom: 'var(--space-12)',
  outline: 'none',
};
