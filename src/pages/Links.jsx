import React from 'react';
import CrousianText from '../components/CrousianText';

const linkItems = [
  { name: 'Alphacoin United Kingdom', url: 'https://alphacoin.uk' },
  { name: 'Crousia on GitHub', url: 'https://github.com/jeremiah-crouse/crousia-v2' },
];

export default function Links() {
  return (
    <div className="container">
      <div className="links-inner">
        <CrousianText text="Other Places" size={0.7} />
        <div className="links-grid">
          {linkItems.map((link) => (
            <a 
              key={link.name} 
              href={link.url} 
              target="_blank" 
              rel="noreferrer"
              className="link-card"
            >
              {link.unicode || link.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

