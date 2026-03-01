import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles/global.css';
import { useAuth } from './hooks/useAuth';
import { isTossWebView } from './lib/env';
import TabBar from './components/TabBar';
import WebBanner from './components/WebBanner';
import HomePage from './pages/HomePage';
import IntroPage from './pages/IntroPage';
const SearchPage = lazy(() => import('./pages/SearchPage'));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ArticleDetailPage = lazy(() => import('./pages/ArticleDetailPage'));
const ComplexDetailPage = lazy(() => import('./pages/ComplexDetailPage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const CommunityPostPage = lazy(() => import('./pages/CommunityPostPage'));
const CommunityWritePage = lazy(() => import('./pages/CommunityWritePage'));
const NotificationSettingsPage = lazy(() => import('./pages/NotificationSettingsPage'));
const AuthRequiredPage = lazy(() => import('./pages/AuthRequiredPage'));

export default function App() {
  const auth = useAuth();
  const isToss = isTossWebView();

  useEffect(() => {
    if (isToss) {
      document.documentElement.classList.add('toss-webview');
    }
  }, []);

  // 토스 WebView에서 비로그인 → IntroPage (기존 동작 유지)
  if (isToss && !auth.isLoggedIn) {
    return (
      <BrowserRouter>
        <IntroPage onLogin={auth.login} loading={auth.loading} />
      </BrowserRouter>
    );
  }

  const showWebBanner = !auth.isLoggedIn && !isToss;

  return (
    <BrowserRouter>
      <div className="mobile-frame">
        {showWebBanner && <WebBanner />}
        <Suspense fallback={null}>
          <Routes>
            {/* 공개 페이지 */}
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/article/:id" element={<ArticleDetailPage />} />
            <Route path="/complex/:id" element={<ComplexDetailPage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/community/:postId" element={<CommunityPostPage />} />

            {/* 인증 필요 페이지 */}
            <Route path="/watchlist" element={auth.isLoggedIn ? <WatchlistPage /> : <AuthRequiredPage />} />
            <Route path="/settings" element={auth.isLoggedIn ? <SettingsPage /> : <AuthRequiredPage />} />
            <Route path="/settings/notifications" element={auth.isLoggedIn ? <NotificationSettingsPage /> : <AuthRequiredPage />} />
            <Route path="/community/write" element={auth.isLoggedIn ? <CommunityWritePage /> : <AuthRequiredPage />} />
          </Routes>
        </Suspense>
        <TabBar isLoggedIn={auth.isLoggedIn} isToss={isToss} />
      </div>
    </BrowserRouter>
  );
}
