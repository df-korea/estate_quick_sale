'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';

const NO_ADS_PAGES = ['/watchlist', '/settings', '/settings/notifications', '/community/write'];

export default function AdSenseScript() {
  const pathname = usePathname();

  if (NO_ADS_PAGES.includes(pathname)) {
    return null;
  }

  return (
    <Script
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4556636593211939"
      crossOrigin="anonymous"
      strategy="lazyOnload"
    />
  );
}
