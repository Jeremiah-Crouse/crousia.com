import React, { useState, lazy, Suspense } from 'react';
import Nav from './components/Nav';
import Audio from './components/Audio';
import SplashScreen from './components/SplashScreen';
import './App.css';

// Lazy load pages to split the bundle
const Home = lazy(() => import('./pages/Home'));
const Log = lazy(() => import('./pages/Log'));
const Links = lazy(() => import('./pages/Links'));
const About = lazy(() => import('./pages/About'));
const Signup = lazy(() => import('./pages/Signup'));

export default function App() {
  const [view, setView] = useState('home');
  const [showSplash, setShowSplash] = useState(true);

  // Handle direct URL access and signup params
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const signup = params.get('signup');
    
    if (window.location.pathname === '/signup' || signup === 'success' || signup === 'cancel') {
      setView('signup');
      // Clear the query param after reading
      if (signup) {
        const url = new URL(window.location);
        url.searchParams.delete('signup');
        window.history.replaceState({}, '', url.pathname);
      }
    }
  }, []);

  return (
    <>
      {showSplash && (
        <SplashScreen onComplete={() => setShowSplash(false)} />
      )}
      <div className="site-wrapper">
        <Nav currentView={view} setView={setView} />
        <Audio />
        <main className="container">
          <Suspense fallback={<div className="loading">Loading...</div>}>
            {view === 'home' && <Home />}
            {view === 'log' && <Log />}
            {view === 'links' && <Links />}
            {view === 'about' && <About />}
            {view === 'signup' && <Signup />}
          </Suspense>
        </main>
      </div>
    </>
  );
}
