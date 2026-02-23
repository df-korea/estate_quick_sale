import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles/global.css';
import TabBar from './components/TabBar';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import WatchlistPage from './pages/WatchlistPage';
import SettingsPage from './pages/SettingsPage';
import ArticleDetailPage from './pages/ArticleDetailPage';
import ComplexDetailPage from './pages/ComplexDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="mobile-frame">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/article/:id" element={<ArticleDetailPage />} />
          <Route path="/complex/:id" element={<ComplexDetailPage />} />
        </Routes>
        <TabBar />
      </div>
    </BrowserRouter>
  );
}
