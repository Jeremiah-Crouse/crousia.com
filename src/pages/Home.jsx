// src/pages/Home.jsx
import React, { useState, useEffect, useRef } from 'react';
import Editor from '../components/Editor';
import CrousianText from '../components/CrousianText';
import Comments from '../components/Comments';

function PageTabs({ headings, activeIndex, onSelect }) {
  if (!headings || headings.length <= 1) return null;
  
  return (
    <div className="page-tabs-sticky">
      {headings.map((label, i) => (
        <button
          key={i}
          className={`page-tab ${activeIndex === i ? 'active' : ''}`}
          onClick={() => onSelect(i)}
        >
          {label || `Section ${i + 1}`}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const today = new Date().toLocaleDateString('en-CA');
  const [h2Headings, setH2Headings] = useState([]);
  const [activeHeading, setActiveHeading] = useState(0);

  const scrollToHeading = (index) => {
    const editorEl = document.querySelector('.editor-input');
    if (!editorEl) return;
    
    const h2s = editorEl.querySelectorAll('h2');
    
    if (h2s[index]) {
      const target = h2s[index];
      const editorRect = editorEl.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const scrollTop = editorEl.scrollTop + targetRect.top - editorRect.top;
      editorEl.scrollTop = scrollTop;
    } else if (index === 0) {
      editorEl.scrollTop = 0;
    }
  };

  // Listen for scroll to update active tab
  useEffect(() => {
    const editorEl = document.querySelector('.editor-input');
    if (!editorEl || !h2Headings.length) return;
    
    const handleScroll = () => {
      const editorEl = document.querySelector('.editor-input');
      if (!editorEl) return;
      
      const editorRect = editorEl.getBoundingClientRect();
      const h2s = editorEl.querySelectorAll('h2');
      
      for (let i = 0; i < h2s.length; i++) {
        const h2 = h2s[i];
        const h2Rect = h2.getBoundingClientRect();
        
        // Check if this heading is visible in the editor (in viewport)
        if (h2Rect.top >= editorRect.top && h2Rect.top < editorRect.top + 100) {
          if (activeHeading !== i) setActiveHeading(i);
          return;
        }
      }
      
      // Also check if we've scrolled past all headings
      for (let i = 0; i < h2s.length - 1; i++) {
        const h2 = h2s[i];
        const nextH2 = h2s[i + 1];
        const nextRect = nextH2.getBoundingClientRect();
        
        if (nextRect.top > editorRect.top + 50) {
          if (activeHeading !== i) setActiveHeading(i);
          return;
        }
      }
    };
    
    editorEl.addEventListener('scroll', handleScroll);
    return () => editorEl.removeEventListener('scroll', handleScroll);
  }, [h2Headings, activeHeading]);

  return (
    <div className="container">
      <CrousianText text="המיוחד של היום" size={0.5} />
      <p className="date-display">{new Date().toLocaleDateString()}</p>
      <div className="thoughts-label">אמור מה שתרצה</div>
      <PageTabs 
        headings={h2Headings} 
        activeIndex={activeHeading}
        onSelect={scrollToHeading}
      />
      <Editor 
        uniqueId={location.pathname} 
        onH2Found={setH2Headings}
      />
      <Comments date={today} />
    </div>
  );
}
