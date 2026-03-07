'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCommunityPosts } from '@/hooks/useCommunity';
import { getAuthToken } from '@/hooks/useAuth';
import { isTossWebView } from '@/lib/env';
import CommunityPostCard from '@/components/CommunityPostCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import InlineBannerAd from '@/components/InlineBannerAd';

interface CommunityPageProps {
  initialPosts?: any[];
}

export default function CommunityPage({ initialPosts }: CommunityPageProps = {}) {
  const nav = useRouter();
  const [sort, setSort] = useState<'newest' | 'popular'>('newest');
  const { posts, loading, hasMore, loadMore, total } = useCommunityPosts(sort, initialPosts);
  const observerRef = useRef<HTMLDivElement>(null);

  // Infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0]?.isIntersecting && hasMore && !loading) {
      loadMore();
    }
  }, [hasMore, loading, loadMore]);

  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  const isLoggedIn = !!getAuthToken();
  const isToss = isTossWebView();

  // Web user (not logged in + not Toss) → show info card
  if (!isLoggedIn && !isToss) {
    return (
      <div className="page">
        <div className="page-header glass"><h1>게시판</h1></div>
        <div className="page-content">
          <div style={{
            background: 'linear-gradient(135deg, #3182f6, #1b64da)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px 24px',
            textAlign: 'center',
            color: 'white',
            margin: '20px 0',
            boxShadow: '0 4px 16px rgba(49, 130, 246, 0.3)',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}>
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12" y2="18" strokeLinecap="round" strokeWidth="2" />
            </svg>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>게시판은 토스 미니앱에서!</h3>
            <p style={{ fontSize: 14, opacity: 0.9, margin: '0 0 12px' }}>토스 미니앱에서 다른 사용자들과 급매 정보를 나눠보세요.</p>
            <p style={{ fontSize: 13, opacity: 0.6, margin: 0 }}>현재 토스 미니앱 출시 준비중입니다.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header glass">
        <h1>게시판</h1>
        {isLoggedIn && (
          <button
            onClick={() => nav.push('/community/write')}
            className="press-effect"
            style={{
              padding: '6px 14px',
              background: 'var(--blue-500)',
              color: 'white',
              borderRadius: 'var(--radius-full)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            글쓰기
          </button>
        )}
      </div>

      <div className="page-content">
        {/* Sort chips */}
        <div className="flex gap-6" style={{ marginBottom: 'var(--space-12)' }}>
          {(['newest', 'popular'] as const).map(s => (
            <button
              key={s}
              className={`chip ${sort === s ? 'chip--active' : ''}`}
              onClick={() => setSort(s)}
            >
              {s === 'newest' ? '최신순' : '인기순'}
            </button>
          ))}
          <span className="text-xs text-gray" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
            {total}개 글
          </span>
        </div>

        {/* Posts list with inline ads every 5 posts */}
        {posts.map((post, i) => (
          <div key={post.id}>
            <CommunityPostCard post={post} />
            {(i + 1) % 5 === 0 && <InlineBannerAd />}
          </div>
        ))}

        {/* Infinite scroll sentinel */}
        <div ref={observerRef} style={{ height: 1 }} />

        {loading && <LoadingSpinner />}

        {!loading && posts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gray-400)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px' }}>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p className="text-sm">아직 게시글이 없습니다</p>
            <p className="text-xs text-gray" style={{ marginTop: 4 }}>첫 글을 작성해보세요!</p>
          </div>
        )}
      </div>
    </div>
  );
}
