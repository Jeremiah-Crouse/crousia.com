// src/components/Nav.jsx
import React, { useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { clearSharedData, isAdmin } from '../utils/collaboration';

export default function Nav({ currentView, setView }) {
  // We assume UserContext now provides { name, handleLogout }
  const { name, handleLogout } = useContext(UserContext);

  const performLogout = () => {
    clearSharedData();
    handleLogout();
  };

  return (
    <nav className="nav">
      <div className="nav-brand">
        <img src="/crousia.png" alt="CROUSIA" className="nav-logo" />
      </div>
      <div className="nav-links">
        <a className={currentView === 'home' ? 'active' : ''} onClick={() => setView('home')}>HOME</a>
        <a className={currentView === 'log' ? 'active' : ''} onClick={() => setView('log')}>LOG</a>
        <a className={currentView === 'links' ? 'active' : ''} onClick={() => setView('links')}>LINKS</a>
        
        {/* Only show logout for admin domain */}
        {isAdmin() && (
          <a onClick={performLogout} style={{ cursor: 'pointer' }}>LOGOUT</a>
        )}
      </div>
    </nav>
  );
}