import React, { useState } from 'react';
import Nav from './components/Nav';
import Audio from './components/Audio';
import Home from './pages/Home';
import Log from './pages/Log';
import Links from './pages/Links';
import SplashScreen from './components/SplashScreen';
import './App.css';

export default function App() {
  const [view, setView] = useState('home');
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {showSplash && (
        <SplashScreen onComplete={() => setShowSplash(false)} />
      )}
      <div className="site-wrapper">
        <Nav currentView={view} setView={setView} />
        <Audio />
        <main className="container">
          {view === 'home' && <Home />}
          {view === 'log' && <Log />}
          {view === 'links' && <Links />}
        </main>
      </div>
    </>
  );
}
