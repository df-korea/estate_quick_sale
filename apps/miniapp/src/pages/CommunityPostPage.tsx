import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCommunityPost, createComment, toggleLike } from '../hooks/useCommunity';
import type { CommunityComment } from '../hooks/useCommunity';
import { getAuthToken } from '../hooks/useAuth';
import ArticlePreviewCard from '../components/ArticlePreviewCard';
import LoadingSpinner from '../components/LoadingSpinner';

export default function CommunityPostPage() {
  const { postId } = useParams<{ postId: string }>();
  const nav = useNavigate();
  const { data: post, loading, refetch } = useCommunityPost(postId);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [liking, setLiking] = useState(false);

  const isLoggedIn = !!getAuthToken();

  if (loading) return <div className="page"><LoadingSpinner /></div>;
  if (!post) return <div className="page"><div className="page-content">게시글을 찾을 수 없습니다</div></div>;

  const handleComment = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createComment(post.id, { content: commentText, parent_id: replyTo ?? undefined });
      setCommentText('');
      setReplyTo(null);
      refetch();
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    try {
      await toggleLike(post.id, post.liked_by_me);
      refetch();
    } catch { /* ignore */ }
    setLiking(false);
  };

  // Build comment tree
  const rootComments = (post.comments || []).filter(c => !c.parent_id);
  const replies = (post.comments || []).filter(c => c.parent_id);
  const repliesMap: Record<number, CommunityComment[]> = {};
  for (const r of replies) {
    if (!repliesMap[r.parent_id!]) repliesMap[r.parent_id!] = [];
    repliesMap[r.parent_id!].push(r);
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header glass">
        <button onClick={() => nav(-1)} style={{ display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1>게시글</h1>
        <div style={{ width: 20 }} />
      </div>

      <div className="page-content">
        {/* Post content */}
        <div style={{ marginBottom: 'var(--space-16)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{post.title}</h2>
          <div className="flex items-center gap-8 text-xs text-gray" style={{ marginBottom: 12 }}>
            <span>{post.nickname}</span>
            <span>{new Date(post.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <span>조회 {post.view_count}</span>
          </div>
          <p className="text-sm" style={{ lineHeight: 1.7, color: 'var(--gray-800)', whiteSpace: 'pre-wrap' }}>
            {post.content}
          </p>
        </div>

        {/* Attached article */}
        {post.attached_article && (
          <div style={{ marginBottom: 'var(--space-16)' }}>
            <div className="text-xs text-gray" style={{ marginBottom: 6 }}>첨부 매물</div>
            <ArticlePreviewCard article={post.attached_article} />
          </div>
        )}

        {/* Like button — 로그인 시에만 표시 */}
        <div className="flex items-center gap-12" style={{ marginBottom: 'var(--space-16)', paddingBottom: 'var(--space-16)', borderBottom: '1px solid var(--border)' }}>
          {isLoggedIn ? (
            <button
              onClick={handleLike}
              className="press-effect flex items-center gap-6"
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                border: `1px solid ${post.liked_by_me ? 'var(--red-400)' : 'var(--gray-200)'}`,
                background: post.liked_by_me ? 'var(--red-50)' : 'transparent',
                color: post.liked_by_me ? 'var(--red-500)' : 'var(--gray-600)',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24"
                fill={post.liked_by_me ? 'currentColor' : 'none'}
                stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
              좋아요 {post.like_count}
            </button>
          ) : (
            <span className="flex items-center gap-6 text-sm" style={{ color: 'var(--gray-400)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
              좋아요 {post.like_count}
            </span>
          )}
        </div>

        {/* Comments */}
        <div style={{ marginBottom: 'var(--space-16)' }}>
          <h4 style={{ fontWeight: 700, marginBottom: 'var(--space-12)' }}>
            댓글 {post.comment_count}
          </h4>

          {rootComments.length === 0 && (
            <div className="text-sm text-gray" style={{ padding: '16px 0' }}>
              아직 댓글이 없습니다
            </div>
          )}

          {rootComments.map(c => (
            <div key={c.id}>
              <CommentItem
                comment={c}
                onReply={() => setReplyTo(c.id)}
                isReplyTarget={replyTo === c.id}
                showReply={isLoggedIn}
              />
              {repliesMap[c.id]?.map(r => (
                <div key={r.id} style={{ marginLeft: 24 }}>
                  <CommentItem comment={r} onReply={() => setReplyTo(c.id)} showReply={isLoggedIn} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Comment input — 로그인 시에만 표시 */}
        {isLoggedIn && (
          <div style={{
            position: 'sticky',
            bottom: 'calc(var(--tab-height) + var(--safe-bottom) + 50px + 16px)',
            background: 'var(--white)',
            padding: '12px 0',
            borderTop: '1px solid var(--border)',
          }}>
            {replyTo && (
              <div className="flex items-center justify-between text-xs" style={{ marginBottom: 6, color: 'var(--blue-500)' }}>
                <span>답글 작성 중</span>
                <button onClick={() => setReplyTo(null)} style={{ color: 'var(--gray-400)' }}>취소</button>
              </div>
            )}
            <div className="flex gap-8">
              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder={replyTo ? '답글을 입력하세요' : '댓글을 입력하세요'}
                onKeyDown={e => e.key === 'Enter' && handleComment()}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--gray-200)',
                  background: 'var(--gray-50)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <button
                onClick={handleComment}
                disabled={!commentText.trim() || submitting}
                className="press-effect"
                style={{
                  padding: '10px 16px',
                  background: commentText.trim() ? 'var(--blue-500)' : 'var(--gray-200)',
                  color: 'white',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 13,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                등록
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CommentItem({ comment, onReply, isReplyTarget, showReply = true }: { comment: CommunityComment; onReply: () => void; isReplyTarget?: boolean; showReply?: boolean }) {
  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid var(--gray-100)',
      background: isReplyTarget ? 'var(--blue-50)' : 'transparent',
      borderRadius: isReplyTarget ? 8 : 0,
      paddingLeft: isReplyTarget ? 8 : 0,
      paddingRight: isReplyTarget ? 8 : 0,
    }}>
      <div className="flex items-center gap-6 text-xs text-gray" style={{ marginBottom: 4 }}>
        <span style={{ fontWeight: 500 }}>{comment.nickname}</span>
        <span>{formatTimeAgo(comment.created_at)}</span>
      </div>
      <p className="text-sm" style={{ lineHeight: 1.5, color: 'var(--gray-800)' }}>{comment.content}</p>
      <div className="flex items-center gap-12 text-xs text-gray" style={{ marginTop: 4 }}>
        {showReply && <button onClick={onReply} style={{ color: 'var(--gray-400)', fontSize: 11 }}>답글</button>}
        {comment.like_count > 0 && <span>좋아요 {comment.like_count}</span>}
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
