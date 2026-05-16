import React, { useState, useRef } from 'react';
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { eveGenerate } from '../../eveService';

export function EveButton({ yText, awareness }) {
  const [editor] = useLexicalComposerContext();
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const [reasoning, setReasoning] = useState('');
  const reasoningBuf = useRef('');

  const handleClick = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setReasoning('');
    reasoningBuf.current = '';
    setStatus('Summoning Eve...');

    await eveGenerate(
      editor,
      awareness,
      (msg) => setStatus(msg),
      (text) => {
        if (text === null) {
          setReasoning('');
          reasoningBuf.current = '';
        } else {
          reasoningBuf.current += text;
          setReasoning(reasoningBuf.current);
        }
      },
    );
    setStatus('');
    setReasoning('');
    reasoningBuf.current = '';
    setIsGenerating(false);
  };

  const showMarquee = isGenerating && reasoning;

  return (
    <button
      onClick={handleClick}
      disabled={isGenerating}
      style={{
        backgroundColor: isGenerating ? '#333' : '#00D1B2',
        color: '#00D1B2',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        maxWidth: '300px',
        fontFamily: 'monospace',
        fontSize: '12px',
      }}
    >
      {showMarquee ? (
        <marquee style={{ color: '#666' }}>{reasoning}</marquee>
      ) : (
        <span style={{ color: isGenerating ? '#aaa' : '#000' }}>{status || 'Summon Eve'}</span>
      )}
    </button>
  );
}
