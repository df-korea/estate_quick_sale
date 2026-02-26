import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles/global.css';
import { useAuth } from './hooks/useAuth';
import { isTossWebView } from './lib/env';
import TabBar from './components/TabBar';
import AdBanner from './components/AdBanner';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import WatchlistPage from './pages/WatchlistPage';
import SettingsPage from './pages/SettingsPage';
import ArticleDetailPage from './pages/ArticleDetailPage';
import ComplexDetailPage from './pages/ComplexDetailPage';
import CommunityPage from './pages/CommunityPage';
import CommunityPostPage from './pages/CommunityPostPage';
import CommunityWritePage from './pages/CommunityWritePage';
import IntroPage from './pages/IntroPage';
import NotificationSettingsPage from './pages/NotificationSettingsPage';

export default function App() {
  const auth = useAuth();

  useEffect(() => {
    if (isTossWebView()) {
      document.documentElement.classList.add('toss-webview');
    }
  }, []);

  if (!auth.isLoggedIn) {
    return (
      <BrowserRouter>
        <IntroPage onLogin={auth.login} loading={auth.loading} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="mobile-frame">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
          <Route path="/article/:id" element={<ArticleDetailPage />} />
          <Route path="/complex/:id" element={<ComplexDetailPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/community/:postId" element={<CommunityPostPage />} />
          <Route path="/community/write" element={<CommunityWritePage />} />
        </Routes>
        <AdBanner />
        <TabBar />
      </div>
    </BrowserRouter>
  );
}
