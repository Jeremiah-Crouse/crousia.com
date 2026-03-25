import React, { useState, useEffect } from 'react';
import CrousianText from '../components/CrousianText';
import { marked } from 'marked';

export default function About() {
  const [content, setContent] = useState('');

  useEffect(() => {
    fetch('/About.md')
      .then(res => res.text())
      .then(text => {
        const html = marked.parse(text);
        setContent(html);
      })
      .catch(err => console.error('Failed to load About.md:', err));
  }, []);

  return (
    <div className="about-container">
      <CrousianText text="CROUSIAN" size={0.7} />
      <div 
        className="about-content"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}
