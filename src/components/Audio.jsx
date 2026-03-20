import React, { useState, useRef } from 'react';

export default function Audio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // The .play() promise is handled to prevent errors 
        // if the user hasn't interacted with the DOM yet.
        audioRef.current.play().catch((error) => {
          console.log("Playback failed:", error);
        });
        setIsPlaying(true);
      }
    }
  };

  return (
    <div className="audio-player">
      <audio 
        ref={audioRef} 
        src="/113.m4a" 
        loop // This attribute ensures the music restarts automatically
      />
      <button className="audio-toggle" onClick={togglePlay}>
        {isPlaying ? '⏸' : '▶'}
      </button>
      <span className="audio-label">Music</span>
    </div>
  );
}