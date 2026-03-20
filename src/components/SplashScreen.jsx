import React, { useState, useEffect } from 'react';

export default function SplashScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="splash-screen">
      <img 
        src="/CROUSIA.jpeg" 
        alt="Crousia" 
        className="splash-image" 
      />
      <div className="splash-progress-container">
        <div className="splash-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="splash-percentage">{progress}%</div>
    </div>
  );
}
