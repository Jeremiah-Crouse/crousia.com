import React from 'react';

const IMAGE_MAP = {
  'CROU🐍IA': '/three-renders/CROUSIA.png',
  'HOME': '/three-renders/HOME.png',
  'ARCHIVE': '/three-renders/ARCHIVE.png',
  'LINKS': '/three-renders/LINKS.png',
  'LOGOUT': '/three-renders/LOGOUT.png',
  'DAILY WORDS': '/three-renders/DAILY_WORDS.png',
  'SUBDOMAINS': '/three-renders/SUBDOMAINS.png',
  'THE ARCHIVE': '/three-renders/THE_ARCHIVE.png',
};

export default function ImageCrousianText({ text = "CROU🐍IA", size = 1, logo = false, nav = false, style = {}, ...props }) {
  const imageSrc = IMAGE_MAP[text];
  
  const containerStyle = {
    display: nav ? 'inline-block' : 'block',
    height: style.height || 'auto',
    maxHeight: style.maxHeight || 'none',
    ...style,
  };
  
  if (!imageSrc) {
    return <span style={containerStyle}>{text}</span>;
  }
  
  return (
    <span
      style={containerStyle}
      {...props}
    >
      <img
        src={imageSrc}
        alt={text}
        style={{
          height: logo ? '90%' : '100%',
          width: 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </span>
  );
}
