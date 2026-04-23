import { DecoratorNode } from 'lexical';
import React from 'react';

const TEXTURE_MAP = {
  gold: '/textures/gold.gif',
  green: '/textures/green.gif',
  purple: '/textures/purple.gif',
};

const TEXTURE_SIZE = 26;
const FRAMES = 24;

export class ImageNode extends DecoratorNode {
  __src;
  __altText;
  __variant;

  static getType() {
    return 'image';
  }

  static clone(node) {
    return new ImageNode(node.__src, node.__altText, node.__variant, node.__key);
  }

  constructor(src, altText, variant = 'gold', key) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__variant = variant;
  }

  static importJSON(serializedNode) {
    const { src, altText, variant } = serializedNode;
    const node = $createImageNode({ src, altText, variant });
    return node;
  }

  exportJSON() {
    return {
      src: this.__src,
      altText: this.__altText,
      variant: this.__variant,
      type: 'image',
      version: 1,
    };
  }

  createDOM(config) {
    const span = document.createElement('span');
    const theme = config.theme;
    const className = theme.image;
    if (className !== undefined) {
      span.className = className;
    }
    return span;
  }

  updateDOM() {
    return false;
  }

  decorate() {
    const texture = TEXTURE_MAP[this.__variant] || TEXTURE_MAP.gold;
    const src = this.__src || '';
    const altText = this.__altText || '';
    
    if (!src) return null;
    
    const isNote = src.includes('/notes/');
    const offset = isNote ? (src.charCodeAt(0) + (src.length % FRAMES)) % FRAMES : 0;
    
    return (
      <ImageWithTexture 
        src={src}
        alt={altText}
        texture={texture} 
        offset={offset}
        isNote={isNote}
      />
    );
  }
}

function ImageWithTexture({ src, alt, texture, offset, isNote }) {
  if (!src) {
    return null;
  }
  
  if (!isNote) {
    return (
      <img
        src={src}
        alt={alt}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          marginTop: '10px',
          marginBottom: '10px',
          borderRadius: '4px',
        }}
      />
    );
  }
  
  // Always show overlay immediately - mask will work when image loads
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        marginTop: '10px',
        marginBottom: '10px',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          opacity: 0,
        }}
        loading="lazy"
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url(${texture})`,
          backgroundSize: `${TEXTURE_SIZE * FRAMES}px ${TEXTURE_SIZE}px`,
          backgroundPosition: `-${offset * TEXTURE_SIZE}px 0`,
          animation: `frame-anim ${2.88}s steps(${FRAMES}) infinite`,
          WebkitMaskImage: `url(${src})`,
          WebkitMaskSize: 'contain',
          WebkitMaskPosition: 'center',
          WebkitMaskRepeat: 'no-repeat',
          maskImage: `url(${src})`,
          maskSize: 'contain',
          maskPosition: 'center',
          maskRepeat: 'no-repeat',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

export function $createImageNode({ src, altText, variant = 'gold' }) {
  return new ImageNode(src, altText, variant);
}

export function $isImageNode(node) {
  return node instanceof ImageNode;
}
