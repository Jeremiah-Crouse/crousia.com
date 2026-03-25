// src/pages/Home.jsx
import React from 'react';
import Editor from '../components/Editor';
import CrousianText from '../components/CrousianText';

export default function Home() {
  return (
    <div className="container">
      <CrousianText text="DAILY WORDS" size={0.7} />
      <p className="date-display">{new Date().toLocaleDateString()}</p>
      <div className="thoughts-label">TODAY'S ENTRY</div>
      <Editor uniqueId={location.pathname} />
    </div>
  );
}
