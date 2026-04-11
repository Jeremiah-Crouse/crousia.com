import { DecoratorNode } from 'lexical';
import React from 'react';

export class ImageNode extends DecoratorNode {
  __src;
  __altText;

  static getType() {
    return 'image';
  }

  static clone(node) {
    return new ImageNode(node.__src, node.__altText, node.__key);
  }

  constructor(src, altText, key) {
    super(key);
    this.__src = src;
    this.__altText = altText;
  }

  static importJSON(serializedNode) {
    const { src, altText } = serializedNode;
    const node = $createImageNode({ src, altText });
    return node;
  }

  exportJSON() {
    return {
      src: this.__src,
      altText: this.__altText,
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
    return (
      <img
        src={this.__src}
        alt={this.__altText}
        style={{
          width: '100%',
          maxWidth: '100%',
          height: 'auto',
          display: 'block',
          marginTop: '10px',
          marginBottom: '10px',
          borderRadius: '4px',
        }}
      />
    );
  }
}

export function $createImageNode({ src, altText }) {
  return new ImageNode(src, altText);
}

export function $isImageNode(node) {
  return node instanceof ImageNode;
}
