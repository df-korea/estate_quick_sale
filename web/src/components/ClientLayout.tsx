'use client';

import { useAuth } from '@/components/AuthProvider';
import { isTossWebView } from '@/lib/env';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import TabBar from '@/components/TabBar';
import WebBanner from '@/components/WebBanner';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  const isToss = isTossWebView();
  const pathname = usePathname();
  const showWebBanner = !isLoggedIn && !isToss;
  const isPrivacyPage = pathname === '/privacy';

  return (
    <div className="mobile-frame">
      {showWebBanner && <WebBanner />}
      {children}
      {!isPrivacyPage && <Footer />}
      <TabBar isLoggedIn={isLoggedIn} isToss={isToss} />
    </div>
  );
}

function Footer() {
  return (
    <footer style={{
      padding: '24px 16px 100px',
      borderTop: '1px solid var(--gray-100)',
      textAlign: 'center',
      fontSize: 12,
      color: 'var(--gray-400)',
      lineHeight: 1.8,
    }}>
      <div style={{ marginBottom: 4 }}>
        <Link href="/privacy" style={{ color: 'var(--gray-500)', textDecoration: 'underline' }}>
          개인정보처리방침
        </Link>
      </div>
      <div>&copy; 2026 부동산 급매 레이더. All rights reserved.</div>
    </footer>
  );
}
