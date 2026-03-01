import type { Metadata } from 'next';
import { getCommunityPost } from '@/lib/queries';
import CommunityPostPageClient from '@/components/pages/CommunityPostPageClient';

interface Props {
  params: Promise<{ postId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params;
  try {
    const post = await getCommunityPost(Number(postId));
    if (!post) {
      return { title: '게시글을 찾을 수 없습니다' };
    }
    const title = post.title;
    const contentPreview = post.content?.slice(0, 100) || '';
    const description = `${title} - ${contentPreview}`;

    return {
      title,
      description,
      openGraph: {
        title: `${title} | 부동산 급매 레이더`,
        description,
        images: [{ url: '/thumbnails/logo-08-coral-1932x828.png' }],
      },
    };
  } catch {
    return { title: '게시글 상세' };
  }
}

export default function CommunityPostPage() {
  return <CommunityPostPageClient />;
}
