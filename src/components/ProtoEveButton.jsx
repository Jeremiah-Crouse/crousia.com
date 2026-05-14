import React, { useState } from 'react';
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { protoEveGenerate } from '../../protoEveService';

export function ProtoEveButton({ yText, awareness }) {
  const [editor] = useLexicalComposerContext();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleClick = async () => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    console.log("Summoning Proto Eve...");
    
    await protoEveGenerate(editor, awareness);
    setIsGenerating(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isGenerating}
      style={{
        backgroundColor: isGenerating ? '#555' : '#FFD700',
        color: '#000',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer'
      }}
    >
      {isGenerating ? 'Proto Eve is writing...' : 'Summon Proto Eve'}
    </button>
  );
}