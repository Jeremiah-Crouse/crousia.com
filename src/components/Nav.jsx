// src/components/Nav.jsx
import React, { useContext, useState, useEffect, useRef } from 'react';
import { UserContext } from '../context/UserContext';
import { clearSharedData, isAdmin } from '../utils/collaboration';
import CrousianText from './CrousianText';

const BREAKPOINT = 1200;

export default function Nav({ currentView, setView }) {
  const { handleLogout } = useContext(UserContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < BREAKPOINT);
  const navLinksRef = useRef(null);

  const performLogout = () => {
    clearSharedData();
    handleLogout();
  };

  useEffect(() => {
    const checkMobile = () => {
      const shouldBeMobile = window.innerWidth < BREAKPOINT;
      setIsMobile(shouldBeMobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!navLinksRef.current || isMobile) return;

    const checkOverflow = () => {
      const navLinks = navLinksRef.current;
      if (!navLinks) return;
      
      const linksWidth = navLinks.scrollWidth;
      const containerWidth = navLinks.parentElement?.clientWidth || window.innerWidth;
      
      const shouldBeMobile = linksWidth > containerWidth - 40 || window.innerWidth < BREAKPOINT;
      setIsMobile(shouldBeMobile);
    };

    checkOverflow();

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(navLinksRef.current);
    return () => observer.disconnect();
  }, [isMobile]);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handleNavClick = (view) => {
    setView(view);
    setMenuOpen(false);
  };

  const navItems = [
    { label: 'Home', view: 'da-she' },
    { label: 'YJS', view: 'home' },
    { label: 'Archive', view: 'log' },
    { label: 'Links', view: 'links' },
    { label: 'About', view: 'about' },
  ];

  if (!isAdmin()) {
    navItems.push({ label: 'Sign Up', view: 'signup' });
  }

  if (isMobile) {
    return (
      <nav className="nav nav-mobile">
        <div className="nav-brand-mobile">
          <CrousianText 
            text="CROU🐍IA" 
            size={1}
            logo
            style={{ height: '8rem' }} 
          />
        </div>
        <button 
          className={`hamburger ${menuOpen ? 'open' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>
{menuOpen && (
          <div className="mobile-dropdown">
            {navItems.map((item) => (
              <a
                key={item.view || item.url}
                href={item.url || undefined}
                className={item.view && currentView === item.view ? 'active' : ''}
                onClick={() => { if (item.view) { setView(item.view); setMenuOpen(false); } }}
              >
                <CrousianText
                  text={item.label}
                  nav
                  style={{ height: '4rem', width: 'auto' }}
                />
              </a>
            ))}
            {isAdmin() && (
              <a onClick={() => { performLogout(); setMenuOpen(false); }}>
                <CrousianText
                  text="Logout"
                  nav
                  style={{ height: '4rem', width: 'auto' }}
                />
              </a>
            )}
          </div>
        )}
      </nav>
    );
  }

  return (
    <nav className="nav">
      <div className="nav-brand">
        <CrousianText 
          text="CROU🐍IA" 
          size={1}
          logo
          style={{ height: '7rem' }} 
        />
      </div>
<div className="nav-links" ref={navLinksRef}>
        {navItems.map((item) => (
          <a 
            key={item.view || item.url}
            href={item.url || undefined}
            className={item.view && currentView === item.view ? 'active' : ''} 
            onClick={() => { if (item.view) { setView(item.view); setMenuOpen(false); } }}
          >
            <CrousianText
              text={item.label}
              nav
              style={{ height: '4rem' }}
            />
          </a>
        ))}
        {isAdmin() && (
          <a onClick={performLogout}>
            <CrousianText
              text="Logout"
              nav
              style={{ height: '4rem' }}
            />
          </a>
        )}
      </div>
    </nav>
  );
}
