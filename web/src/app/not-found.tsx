import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없습니다',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="page">
      <div className="page-content" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--gray-300)', marginBottom: 16 }}>404</div>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>페이지를 찾을 수 없습니다</h1>
        <p className="text-sm text-gray" style={{ marginBottom: 24 }}>
          요청하신 페이지가 존재하지 않거나 삭제되었습니다.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: 'var(--blue-500)',
            color: 'white',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
