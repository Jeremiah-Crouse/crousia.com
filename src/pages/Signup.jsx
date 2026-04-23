// src/pages/Signup.jsx
import React, { useState } from 'react';

export default function Signup() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState('form'); // form, processing, success, cancel
  const [error, setError] = useState('');

  const handleSignup = async () => {
    if (!name.trim() || !password) return;
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    
    setStep('processing');
    setError('');
    
    try {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const res = await fetch(`${protocol}//${window.location.host}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), password })
      });
      
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        setError(data.error);
        setStep('form');
      }
    } catch (err) {
      setError('Connection error');
      setStep('form');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSignup();
    }
  };

  // Check URL for cancel/success
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('canceled') === 'true' || window.location.pathname.includes('cancel')) {
      setStep('cancel');
    } else if (params.get('success') === 'true' || window.location.pathname.includes('success')) {
      setStep('success');
    }
  }, []);

  if (step === 'cancel') {
    return (
      <div className="signup-container" style={{ padding: '50px', textAlign: 'center' }}>
        <h2>Payment Cancelled</h2>
        <p>No worries. Come back anytime.</p>
        <button onClick={() => setStep('form')} style={{ padding: '10px 20px', marginTop: '20px' }}>
          Try Again
        </button>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="signup-container" style={{ padding: '50px', textAlign: 'center' }}>
        <h2>Welcome to Crousia!</h2>
        <p>Your payment went through and your account is now active.</p>
        <p>Go to qwert.crousia.com and log in with your new credentials.</p>
        <a href="/" style={{ padding: '10px 20px', display: 'inline-block', marginTop: '20px' }}>
          Go to Editor
        </a>
      </div>
    );
  }

  return (
    <div className="signup-container" style={{ 
      padding: '50px', 
      textAlign: 'center',
      maxWidth: '500px',
      margin: '0 auto'
    }}>
      <h2>Join Crousia</h2>
      <p style={{ marginBottom: '30px' }}>
        For a small monthly contribution, you gain editing access to the master document.
        Not to read someone else's conclusions — to help reach them.
      </p>
      
      <div style={{ 
        background: 'rgba(255,215,0,0.1)', 
        padding: '20px', 
        borderRadius: '8px',
        marginBottom: '30px'
      }}>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#FFD700' }}>$5/month</div>
        <div style={{ color: '#888' }}>recurring</div>
      </div>
      
      <input 
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Choose your name"
        style={{ padding: '10px', marginBottom: '10px', width: '100%', maxWidth: '300px' }}
        disabled={step === 'processing'}
      />
      <br />
      <input 
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Password"
        style={{ padding: '10px', marginBottom: '10px', width: '100%', maxWidth: '300px' }}
        disabled={step === 'processing'}
      />
      <br />
      <input 
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Confirm password"
        style={{ padding: '10px', marginBottom: '10px', width: '100%', maxWidth: '300px' }}
        disabled={step === 'processing'}
      />
      <br />
      <button 
        onClick={handleSignup}
        disabled={step === 'processing' || !name.trim() || !password || !confirmPassword}
        style={{ padding: '10px 30px', cursor: step === 'processing' ? 'not-allowed' : 'pointer', marginTop: '10px' }}
      >
        {step === 'processing' ? 'Processing...' : 'Subscribe $5/month'}
      </button>
      
      {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
      
      <p style={{ marginTop: '30px', fontSize: '0.85rem', color: '#666' }}>
        Payments via Stripe. Cancel anytime.
      </p>
    </div>
  );
}