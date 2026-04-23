// src/components/GateKeeper.jsx
import React, { useState, useEffect, useRef } from 'react';
import { UserContext } from '../context/UserContext';

export default function Gatekeeper({ children }) {
  const [name, setName] = useState(() => localStorage.getItem("crousia_name") || '');
  const [password, setPassword] = useState('');
  const [authorized, setAuthorized] = useState(() => !!localStorage.getItem("crousia_token"));
  const [step, setStep] = useState('name'); // 'name' or 'password'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const inputRef = useRef(null);

  useEffect(() => {
    if (!authorized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [authorized, step]);

  const isPublicSite = window.location.hostname === "crousia.com";

  const handleCheckName = async () => {
    setError('');
    if (!name.trim()) return;
    
    setLoading(true);
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    try {
      const res = await fetch(`${protocol}//${window.location.host}/api/auth/check-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      });
      
      const data = await res.json();
      
      if (data.valid) {
        setStep('password');
      } else if (data.redirect) {
        window.location.href = "https://crousia.com";
      }
    } catch (err) {
      setError('Connection error');
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    setError('');
    if (!password) return;
    
    setLoading(true);
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    try {
      const res = await fetch(`${protocol}//${window.location.host}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), password })
      });
      
      const data = await res.json();
      
      if (data.authorized) {
        localStorage.setItem("crousia_token", data.token);
        localStorage.setItem("crousia_name", data.name);
        setAuthorized(true);
      } else {
        setError(data.error || 'Invalid password');
      }
    } catch (err) {
      setError('Connection error');
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (step === 'name') {
        handleCheckName();
      } else {
        handleLogin();
      }
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem("crousia_token");
    if (token) {
      try {
        await fetch(`${window.location.origin}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
      } catch (e) {}
    }
    setName('');
    setPassword('');
    setStep('name');
    setAuthorized(false);
    localStorage.removeItem("crousia_token");
    localStorage.removeItem("crousia_name");
    window.location.reload();
  };

  if (isPublicSite) {
    return (
        <UserContext.Provider value={{ name: name || "guest", handleLogout }}>
            {children}
        </UserContext.Provider>
    );
  }

  if (!authorized) {
    return (
      <div className="login-overlay" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <h2>Welcome to Crousia</h2>
        
        {step === 'name' ? (
          <>
            <input 
              ref={inputRef}
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              onKeyDown={handleKeyDown}
              placeholder="Who are you?" 
              style={{ padding: '10px', marginBottom: '10px' }}
              disabled={loading}
            />
            <button onClick={handleCheckName} style={{ padding: '10px 20px' }} disabled={loading}>
              {loading ? 'Checking...' : 'Enter'}
            </button>
          </>
        ) : (
          <>
            <p style={{ marginBottom: '10px' }}>Hello, {name}</p>
            <input 
              ref={inputRef}
              type="password"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              onKeyDown={handleKeyDown}
              placeholder="Password" 
              style={{ padding: '10px', marginBottom: '10px' }}
              disabled={loading}
            />
            <button onClick={handleLogin} style={{ padding: '10px 20px' }} disabled={loading}>
              {loading ? 'Logging in...' : 'Enter'}
            </button>
            <button onClick={() => { setStep('name'); setPassword(''); }} style={{ marginTop: '10px', padding: '5px 10px' }}>
              Back
            </button>
          </>
        )}
        
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ name: authorized ? name : "guest", handleLogout }}>
        {children}
    </UserContext.Provider>
  );
}