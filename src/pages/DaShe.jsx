import React, { useContext } from 'react';
import { UserContext } from '../context/UserContext';
import CrousianText from '../components/CrousianText';
import { isAdmin } from '../utils/collaboration';

export default function DaShe() {
  const user = useContext(UserContext);
  const loggedIn = user?.name && user.name !== 'guest' && user.name !== '';

  return (
    <div className="container" style={{ textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <img src="/sun.gif" alt=""
        style={{
          width: '220px', height: '220px', objectFit: 'contain', marginBottom: '1.5rem',
          maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 80%)',
          WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 80%)',
        }}
      />

      {loggedIn ? (
        <CrousianText text="WELCOME" size={0.7} />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', width: '100%', maxWidth: '280px' }}>
            <a href="https://qwert.crousia.com"
              style={{
                display: 'block',
                padding: '0.8rem 1.5rem',
                background: '#ffb347',
                color: '#1a1a2e',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '1.1rem',
                fontWeight: 800,
                width: '100%',
                textAlign: 'center',
                border: 'none',
              }}>
              SIGN IN
            </a>
            <a href="/signup"
              style={{
                display: 'block',
                padding: '0.8rem 1.5rem',
                background: 'transparent',
                color: '#ffb347',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '1.1rem',
                fontWeight: 800,
                width: '100%',
                textAlign: 'center',
                border: '2px solid #ffb347',
              }}>
              SIGN UP
            </a>
          </div>
        </>
      )}
    </div>
  );
}
