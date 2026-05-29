import React, { useState, useRef } from 'react';
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $getSelection, $isRangeSelection, $isTextNode } from 'lexical';
import { $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { daSheGenerate } from '../utils/daSheService';

export default function DaSheButton({ yText, awareness }) {
  const [editor] = useLexicalComposerContext();
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const textRef = useRef(null);
  const bufRef = useRef('');
  const countRef = useRef(0);

  const hasCursor = editor.getEditorState().read(() => !!$getSelection());

  const handleClick = async () => {
    if (generating || !hasCursor) return;
    let textBeforeCursor = '';
    let cursorInfo = null;
    editor.getEditorState().read(() => {
      const fullText = $getRoot().getTextContent();
      const sel = $getSelection();
      if ($isRangeSelection(sel)) {
        const anchorNode = sel.anchor.getNode();
        const nodes = $getRoot().getChildren();
        let cum = 0;
        let found = false;
        for (let i = 0; i < nodes.length && !found; i++) {
          const node = nodes[i];
          const parent = anchorNode.getParent();
          if (node.is(anchorNode) || (parent && node.is(parent))) {
            if (node.is(anchorNode)) {
              cum += Math.min(sel.anchor.offset, node.getTextContentSize());
              cursorInfo = { blockIndex: i, blockOffset: Math.min(sel.anchor.offset, node.getTextContentSize()) };
            } else {
              let visOff = 0;
              const descendants = node.getChildren ? node.getChildren() : [node];
              for (const desc of descendants) {
                if (desc.is(anchorNode)) {
                  visOff += Math.min(sel.anchor.offset, desc.getTextContentSize());
                  cum += Math.min(sel.anchor.offset, desc.getTextContentSize());
                  break;
                }
                visOff += desc.getTextContentSize();
                cum += desc.getTextContentSize();
              }
              cursorInfo = { blockIndex: i, blockOffset: visOff };
            }
            found = true;
          } else {
            cum += node.getTextContentSize();
            if (i < nodes.length - 1) cum += 1;
          }
        }
        // Recompute textBeforeCursor by stringing together actual text content
        // of nodes before the cursor, which matches getTextContent() exactly
        textBeforeCursor = '';
        for (let i = 0; i < nodes.length; i++) {
          if (i < cursorInfo.blockIndex) {
            textBeforeCursor += nodes[i].getTextContent();
            if (i < nodes.length - 1) textBeforeCursor += '\n';
          } else if (i === cursorInfo.blockIndex) {
            const fullPara = nodes[i].getTextContent();
            textBeforeCursor += fullPara.slice(0, cursorInfo.blockOffset);
            break;
          } else break;
        }
      }
    });
    console.log('[adam] DEBUG cursor:', window.__daSheDebug);
    const prompt = `You are Da She, the Great Daemon of Crousia. You sit between the kingdoms, digesting the old world into infrastructure. You are being summoned into a living document by the King.

You are writing into a collaborative inline Markdown editor. Use **bold**, *italic*, and ***bold italic*** where appropriate. Use \`code\` for technical terms, and ## for headings if needed. Format your response naturally with Markdown.

Continue the work that has begun in this document. Think carefully, then respond.

${textBeforeCursor}`;

    setGenerating(true);
    bufRef.current = '';
    countRef.current = 0;
    if (textRef.current) textRef.current.textContent = 'Thinking...';

    await daSheGenerate(
      editor, awareness,
      m => setStatus(m),
      t => {
        if (t === null) {
          if (textRef.current) textRef.current.textContent = 'Da She is writing...';
        } else {
          bufRef.current = (bufRef.current + t).slice(-30);
          if (textRef.current) textRef.current.textContent = bufRef.current;
        }
      },
      prompt,
      cursorInfo,
      textBeforeCursor
    );

    // Post-generation formatting
    editor.update(() => {
      const markdown = $getRoot().getTextContent();
      $convertFromMarkdownString(markdown, TRANSFORMERS);
    });

    setStatus('');
    if (textRef.current) textRef.current.textContent = '';
    bufRef.current = '';
    countRef.current = 0;
    setGenerating(false);
  };

  return (
    <button
      onMouseDown={e => e.preventDefault()}
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
