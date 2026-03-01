'use client';

import { useAuth } from '@/components/AuthProvider';
import { isTossWebView } from '@/lib/env';
import TabBar from '@/components/TabBar';
import WebBanner from '@/components/WebBanner';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  const isToss = isTossWebView();
  const showWebBanner = !isLoggedIn && !isToss;

  return (
    <div className="mobile-frame">
      {showWebBanner && <WebBanner />}
      {children}
      <TabBar isLoggedIn={isLoggedIn} isToss={isToss} />
    </div>
  );
}
