import React, { useState, useEffect } from 'react';

export default function SplashScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageSrc = '/CROUSIA-mobile.jpeg';

  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => setImageLoaded(true);
    img.onerror = () => setImageLoaded(true);
  }, [imageSrc]);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const maxProgress = imageLoaded ? 100 : 80;
        if (prev >= maxProgress) {
          clearInterval(interval);
          if (imageLoaded) {
            setTimeout(onComplete, 500);
          }
          return maxProgress;
        }
        return prev + 2;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [onComplete, imageLoaded]);

  return (
    <div className="splash-screen">
      <img 
        src={imageSrc} 
        alt="Crousia" 
        className="splash-image" 
        style={{ opacity: imageLoaded ? 1 : 0.5 }}
      />
      <div className="splash-progress-container">
        <div className="splash-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="splash-percentage">{progress}%</div>
    </div>
  );
}
