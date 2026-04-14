import React from 'react';
import CrousianText from '../components/CrousianText';

const linkItems = [
  { name: 'KINGDOM', url: 'https://kingdom.crousia.com' },
  { name: 'RESUMES', url: 'https://resumes.crousia.com' },
  { name: 'PRINCESS', url: 'https://princess.crousia.com' },
  { name: 'PRINCE', url: 'https://prince.crousia.com' },
  { name: 'LOTTERY', url: 'https://lottery.crousia.com' },
  { name: 'ECHAD', url: 'https://echad.crousia.com' },
  { name: 'LAB', url: 'https://lab.crousia.com' },
  { name: 'MUSIC', url: 'https://music.crousia.com' },
  { name: 'VERDIS', url: 'https://verdis.crousia.com' },
  { name: 'USA', url: 'https://usa.crousia.com', unicode: 'ŪSA' },
  { name: 'BUS', url: 'https://bus.crousia.com' },
];

export default function Links() {
  return (
    <div className="container">
      <div className="links-inner">
        <CrousianText text="SUBDOMAINS" size={0.7} />
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

