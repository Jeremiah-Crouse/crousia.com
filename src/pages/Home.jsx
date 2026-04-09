// src/pages/Home.jsx
import React from 'react';
import Editor from '../components/Editor';
import CrousianText from '../components/CrousianText';
import Comments from '../components/Comments';

export default function Home() {
  const today = new Date().toLocaleDateString('en-CA');

  return (
    <div className="container">
      <CrousianText text="DAILY WORDS" size={0.7} />
      <p className="date-display">{new Date().toLocaleDateString()}</p>
      <div className="thoughts-label">TODAY'S ENTRY</div>
      <Editor uniqueId={location.pathname} />
      <Comments date={today} />
    </div>
  );
}
