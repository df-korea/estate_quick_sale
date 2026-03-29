'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCommunityPosts } from '@/hooks/useCommunity';
import { getAuthToken } from '@/hooks/useAuth';
import CommunityPostCard from '@/components/CommunityPostCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import InlineBannerAd from '@/components/InlineBannerAd';
import LoginModal from '@/components/LoginModal';

interface CommunityPageProps {
  initialPosts?: any[];
}

export default function CommunityPage({ initialPosts }: CommunityPageProps = {}) {
  const nav = useRouter();
  const [sort, setSort] = useState<'newest' | 'popular'>('newest');
  const { posts, loading, hasMore, loadMore, total } = useCommunityPosts(sort, initialPosts);
  const observerRef = useRef<HTMLDivElement>(null);
  const [showLogin, setShowLogin] = useState(false);

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

  const handleWrite = () => {
    if (isLoggedIn) {
      nav.push('/community/write');
    } else {
      setShowLogin(true);
    }
  };

  return (
    <div className="page">
      <div className="page-header glass">
        <h1>게시판</h1>
        <button
          onClick={handleWrite}
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

      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onLoginSuccess={() => nav.push('/community/write')}
      />
    </div>
  );
}
