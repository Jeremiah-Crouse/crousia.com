import React from 'react';

const TEXTURE_MAP = {
  gold: '/textures/gold.gif',
  green: '/textures/green.gif',
  purple: '/textures/purple.gif',
};

const SIZE = 256;
const FRAMES = 24;

function toCssSize(value) {
  if (typeof value === 'number') {
    return `${value}px`;
  }
  return value;
}

function resolveFontSize({ size, style, logo, nav }) {
  if (style?.fontSize) {
    return toCssSize(style.fontSize);
  }
  
  // If height is provided, we scale the font-size down slightly (e.g. 75-85%) 
  // to ensure it fits comfortably within the container and doesn't feel "too big".
  if (style?.height) {
    const numericHeight = parseFloat(style.height);
    const unit = typeof style.height === 'string' ? style.height.replace(/[0-9.]/g, '') : 'px';
    const scale = logo ? 0.35 : 0.72; 
    return `${numericHeight * scale}${unit || 'px'}`;
  }

  if (logo) {
    return `${4 * size}rem`;
  }

  if (nav) {
    return `${1.8 * size}rem`;
  }

  return `${4 * size}rem`;
}

function getTextureVariant(char, variant) {
  if (variant) {
    return variant;
  }

  if (char === '🐍') {
    return 'green';
  }

  return 'gold';
}

export default function TexturedCrousianText({
  text = 'CROU🐍IA',
  size = 1,
  logo = false,
  nav = false,
  style = {},
  variant,
  ...props
}) {
  const fontSize = resolveFontSize({ size, style, logo, nav });
  const chars = [...text];
  const { height, fontSize: _ignoredFontSize, ...containerStyle } = style;

  // Generate random offsets once for each character
  const offsets = React.useMemo(() => 
    chars.map(() => Math.floor(Math.random() * FRAMES)), 
    [text]
  );

  return (
    <>
      <style>
        {`
          @keyframes frame-anim {
             from { background-position: 0px 0; }
             to { background-position: -${SIZE * FRAMES}px 0; }
          }
        `}
      </style>
      <span
        style={{
          display: nav || logo ? 'inline-block' : 'block',
          width: style.width || 'auto',
          maxWidth: style.maxWidth || '100%',
          lineHeight: 1,
          ...containerStyle,
        }}
        {...props}
      >
      <span
        aria-label={text}
        role="img"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          whiteSpace: 'pre',
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 600,
          fontSize,
          lineHeight: 0.9,
          letterSpacing: nav || logo ? '-0.05em' : '0.03em',
          filter: 'drop-shadow(0 0 4px rgba(0, 0, 0, 0.7)) drop-shadow(0 0 10px rgba(0, 0, 0, 0.35))',
        }}
      >
        {chars.map((char, index) => {
          if (char === ' ') {
            return <span key={`space-${index}`}>{char}</span>;
          }

          const texture = TEXTURE_MAP[getTextureVariant(char, variant)] || TEXTURE_MAP.gold;
          
          // Use pre-generated random offset for this character
          const offsetFrame = offsets[index];
          const delay = -offsetFrame * 0.06;

          return (
            <span
              key={`${char}-${index}-${offsetFrame}`}
              aria-hidden="true"
              style={{
                display: 'inline-block',
                backgroundImage: `url(${texture})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${SIZE * FRAMES}px ${SIZE}px`,
                backgroundPosition: `-${offsetFrame * SIZE}px 0`,
                animation: `frame-anim ${1.44}s steps(${FRAMES}) infinite`,
                animationDelay: `${delay}s`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
                WebkitTextStroke: '0.018em rgba(0, 0, 0, 0.55)',
                textShadow: '0 0 0.04em rgba(255, 255, 255, 0.08)',
                transform: char === '🐍' ? 'scaleX(-1)' : 'none',
              }}
            >
              {char}
            </span>
          );
        })}
      </span>
      </span>
    </>
  );
}
