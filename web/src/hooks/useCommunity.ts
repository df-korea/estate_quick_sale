'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiFetch, apiPost, apiDelete } from '../lib/api';

export interface CommunityPost {
  id: number;
  title: string;
  content: string;
  nickname: string;
  attached_article_id: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  attached_article: {
    id: number;
    deal_price: number;
    formatted_price: string;
    exclusive_space: number;
    trade_type: string;
    complex_name: string;
    target_floor?: string;
    total_floor?: string;
    bargain_score?: number;
    bargain_keyword?: string;
    complex_id?: number;
  } | null;
  liked_by_me: boolean;
  comments?: CommunityComment[];
}

export interface CommunityComment {
  id: number;
  post_id: number;
  parent_id: number | null;
  content: string;
  nickname: string;
  like_count: number;
  is_deleted: boolean;
  created_at: string;
  liked_by_me: boolean;
}

interface PostsResponse {
  posts: CommunityPost[];
  total: number;
  page: number;
  limit: number;
}

export function useCommunityPosts(sort: 'newest' | 'popular' = 'newest') {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const fetch = useCallback(async (pageNum: number, append = false) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(pageNum), limit: '20', sort });
      const data = await apiFetch<PostsResponse>(`/community/posts?${qs}`);
      setPosts(prev => append ? [...prev, ...data.posts] : data.posts);
      setTotal(data.total);
      setHasMore(data.posts.length === 20);
    } catch { /* ignore */ }
    setLoading(false);
  }, [sort]);

  useEffect(() => {
    setPage(1);
    fetch(1);
  }, [fetch]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetch(next, true);
  }, [page, hasMore, loading, fetch]);

  const refetch = useCallback(() => {
    setPage(1);
    fetch(1);
  }, [fetch]);

  return { posts, loading, total, hasMore, loadMore, refetch };
}

export function useCommunityPost(postId: string | undefined) {
  const [data, setData] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      setData(await apiFetch<CommunityPost>(`/community/posts/${postId}`));
    } catch { setData(null); }
    setLoading(false);
  }, [postId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export async function createPost(body: { title: string; content: string; nickname?: string; attached_article_id?: number }) {
  return apiPost<CommunityPost>('/community/posts', body);
}

export async function createComment(postId: number, body: { content: string; nickname?: string; parent_id?: number }) {
  return apiPost<CommunityComment>(`/community/posts/${postId}/comments`, body);
}

export async function toggleLike(postId: number, liked: boolean) {
  if (liked) {
    return apiDelete<{ like_count: number; liked: boolean }>(`/community/posts/${postId}/like`);
  }
  return apiPost<{ like_count: number; liked: boolean }>(`/community/posts/${postId}/like`, {});
}
