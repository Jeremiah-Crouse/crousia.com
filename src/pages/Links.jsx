import React from 'react';
import CrousianText from '../components/CrousianText';

const linkItems = [
  { name: 'Cristio (Kingdom)', url: 'https://cristio.ru' },
  { name: 'Alphacoin (Old World)', url: 'https://alphacoin.uk' },
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
