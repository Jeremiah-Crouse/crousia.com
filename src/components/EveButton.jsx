import React, { useState } from 'react';
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { eveGenerate } from '../../eveService';

export function EveButton({ yText, awareness }) {
  const [editor] = useLexicalComposerContext();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleClick = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    console.log("Summoning Eve...");

    await eveGenerate(editor, awareness, yText);
    setIsGenerating(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isGenerating}
      style={{
        backgroundColor: isGenerating ? '#555' : '#00D1B2',
        color: '#000',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer'
      }}
    >
      {isGenerating ? 'Eve is writing...' : 'Summon Eve'}
    </button>
  );
}
