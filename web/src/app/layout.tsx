import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import '../styles/global.css';
import { AuthProvider } from '@/components/AuthProvider';
import ClientLayout from '@/components/ClientLayout';

export const metadata: Metadata = {
  title: {
    default: '부동산 급매 레이더 - 전국 아파트 급매물 실시간 검색',
    template: '%s | 부동산 급매 레이더',
  },
  description: '전국 아파트 급매물을 실시간으로 검색하고 분석하세요. AI 기반 급매 점수, 시세 비교, 실거래가 분석을 제공합니다.',
  metadataBase: new URL('https://estate-rader.com'),
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: '부동산 급매 레이더',
    images: [{ url: '/thumbnails/logo-08-coral-1932x828.png', width: 1932, height: 828 }],
  },
  twitter: {
    card: 'summary_large_image',
  },
  icons: {
    icon: '/logos/logo-08-coral.svg',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3182f6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </AuthProvider>
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.KAKAO_JAVASCRIPT_KEY}&libraries=clusterer&autoload=false`}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
