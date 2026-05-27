import React, { useState, lazy, Suspense, useEffect, useCallback } from 'react';
import Nav from './components/Nav';
import Audio from './components/Audio';
import SplashScreen from './components/SplashScreen';
import './App.css';

const DaShe = lazy(() => import('./pages/DaShe'));
const Home = lazy(() => import('./pages/Home'));
const Log = lazy(() => import('./pages/Log'));
const Links = lazy(() => import('./pages/Links'));
const About = lazy(() => import('./pages/About'));
const Signup = lazy(() => import('./pages/Signup'));

const pathToView = {
  '/': 'da-she',
  '/home': 'home',
  '/archive': 'log',
  '/links': 'links',
  '/about': 'about',
  '/signup': 'signup',
};

const viewToPath = {};
for (const [p, v] of Object.entries(pathToView)) viewToPath[v] = p;

export default function App() {
  const getInitialView = () => {
    const p = window.location.pathname;
    return pathToView[p] || 'da-she';
  };
  const [view, setView] = useState(getInitialView);
  const [showSplash, setShowSplash] = useState(true);

  const navigate = useCallback((v) => {
    setView(v);
    const p = viewToPath[v] || '/';
    if (window.location.pathname !== p) {
      window.history.pushState({ view: v }, '', p);
    }
  }, []);

  useEffect(() => {
    const onPop = (e) => {
      const p = window.location.pathname;
      setView(pathToView[p] || 'da-she');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Handle direct URL access and signup params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const signup = params.get('signup');
    
    if (window.location.pathname === '/signup' || signup === 'success' || signup === 'cancel') {
      navigate('signup');
      if (signup) {
        const url = new URL(window.location);
        url.searchParams.delete('signup');
        window.history.replaceState({}, '', url.pathname);
      }
    }
  }, [navigate]);

  return (
    <>
      {showSplash && (
        <SplashScreen onComplete={() => setShowSplash(false)} />
      )}
      <div className="site-wrapper">
        <Nav currentView={view} setView={navigate} />
        <Audio />
        <main className="container">
          <Suspense fallback={<div className="loading">Loading...</div>}>
            {view === 'da-she' && <DaShe />}
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
