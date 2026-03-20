// src/pages/Home.jsx
import React from 'react';
import Editor from '../components/Editor';

export default function Home() {
  return (
    <div className="container">
      <h1>The Daily Thoughts</h1>
      <p className="date-display">{new Date().toLocaleDateString()}</p>
      <div className="thoughts-label">TODAY'S ENTRY</div>
      <Editor uniqueId={location.pathname} />
    </div>
  );
}
