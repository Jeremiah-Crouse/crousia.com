import React, { useState, useRef } from 'react';
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection } from 'lexical';
import { daSheGenerate } from '../utils/daSheService';

export default function DaSheButton({ yText, awareness }) {
  const [editor] = useLexicalComposerContext();
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const textRef = useRef(null);

  const hasCursor = editor.getEditorState().read(() => !!$getSelection());

  const handleClick = async () => {
    if (generating) return;
    setGenerating(true);
    if (textRef.current) textRef.current.textContent = '';
    await daSheGenerate(
      editor, awareness,
      m => setStatus(m),
      t => {
        if (t === null) {
          if (textRef.current) textRef.current.textContent = '';
        } else {
          if (textRef.current) textRef.current.textContent = t;
        }
      },
    );
    setStatus('');
    if (textRef.current) textRef.current.textContent = '';
    setGenerating(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={generating || !hasCursor}
      title={!hasCursor ? 'Place cursor in the editor first' : 'Summon Da She'}
      style={{
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: generating || !hasCursor ? 'not-allowed' : 'pointer',
        background: generating ? '#2d1f0e' : '#ffb347',
        color: generating ? '#8a7a5a' : '#1a0f05',
        border: 'none',
        fontWeight: 700,
        fontSize: '0.85rem',
        fontFamily: 'inherit',
        opacity: !hasCursor ? 0.4 : 1,
        transition: 'all 0.2s',
        overflow: generating ? 'hidden' : 'visible',
      }}
    >
      {generating ? (
        <span ref={textRef} style={{
          color: '#ffb347',
        }}>{status || 'Summoning...'}</span>
      ) : 'Summon Da She'}
    </button>
  );
}
