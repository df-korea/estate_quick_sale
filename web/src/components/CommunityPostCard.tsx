'use client';

import { useRouter } from 'next/navigation';
import type { CommunityPost } from '../hooks/useCommunity';
import ArticlePreviewCard from './ArticlePreviewCard';

interface Props {
  post: CommunityPost;
}

export default function CommunityPostCard({ post }: Props) {
  const nav = useRouter();

  return (
    <div
      className="card press-effect"
      style={{ marginBottom: 8, cursor: 'pointer' }}
      onClick={() => nav.push(`/community/${post.id}`)}
    >
      <div className="card-body" style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{post.title}</div>
        <div className="text-sm text-gray truncate" style={{ marginBottom: 8, lineHeight: 1.4 }}>
          {post.content.length > 80 ? post.content.slice(0, 80) + '...' : post.content}
        </div>

        {post.attached_article && (
          <div style={{ marginBottom: 8 }} onClick={e => e.stopPropagation()}>
            <ArticlePreviewCard article={post.attached_article} />
          </div>
        )}

        <div className="flex items-center gap-12 text-xs text-gray">
          <span>{post.nickname}</span>
          <span>{formatTimeAgo(post.created_at)}</span>
          <span style={{ marginLeft: 'auto' }} className="flex items-center gap-4">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 9V5a3 3 0 00-6 0v4M5 11h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2z" />
            </svg>
            {post.view_count}
          </span>
          <span className="flex items-center gap-4">
            <svg width="12" height="12" viewBox="0 0 24 24" fill={post.liked_by_me ? 'var(--red-500)' : 'none'} stroke={post.liked_by_me ? 'var(--red-500)' : 'currentColor'} strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            {post.like_count}
          </span>
          <span className="flex items-center gap-4">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            {post.comment_count}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}
