import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import '../styles/global.css';
import { AuthProvider } from '@/components/AuthProvider';
import ClientLayout from '@/components/ClientLayout';
import AdSenseScript from '@/components/AdSenseScript';

export const metadata: Metadata = {
  title: {
    default: '부동산 급매 레이더 - 전국 아파트 급매물 실시간 검색',
    template: '%s | 부동산 급매 레이더',
  },
  description: '부동산 급매 검색의 모든 것. 전국 아파트 급매물 실시간 검색, AI 급매 점수, 시세 비교, 실거래가 분석. 서울·경기·수도권 아파트 급매, 시세 이하 매물을 한눈에 확인하세요.',
  keywords: ['부동산 급매', '아파트 급매', '급매물', '부동산 급매 레이더', '아파트 시세', '급매 검색', '부동산 시세 비교', '실거래가 분석', '서울 급매', '수도권 급매'],
  metadataBase: new URL('https://estate-rader.com'),
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: '부동산 급매 레이더',
    // images provided by per-page opengraph-image.tsx
  },
  twitter: {
    card: 'summary_large_image',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    'google-adsense-account': 'ca-pub-4556636593211939',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3182f6',
};

const gaId = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
      </head>
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
        <AdSenseScript />
      </body>
    </html>
  );
}
