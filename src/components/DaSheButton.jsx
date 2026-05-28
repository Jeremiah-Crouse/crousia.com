import React, { useState, useRef, useEffect } from 'react';
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $getSelection } from 'lexical';
import { daSheGenerate } from '../utils/daSheService';

export default function DaSheButton({ yText, awareness }) {
  const [editor] = useLexicalComposerContext();
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const textRef = useRef(null);
  const bufRef = useRef('');
  const countRef = useRef(0);
  const cursorRef = useRef(0);

  useEffect(() => {
    const unreg = editor.registerUpdateListener(() => {
      editor.getEditorState().read(() => {
        const sel = $getSelection();
        if (!sel) return;
        const nodes = $getRoot().getChildren();
        let cum = 0;
        for (const node of nodes) {
          const nodeLen = node.getTextContentSize();
          if (node === sel.anchor.getNode().getParentOrThrow()) {
            cum += sel.anchor.offset;
            break;
          }
          cum += nodeLen;
        }
        cursorRef.current = cum;
      });
    });
    return unreg;
  }, [editor]);

  const hasCursor = editor.getEditorState().read(() => !!$getSelection());

  const handleClick = async () => {
    if (generating || !hasCursor) return;
    let fullText = '';
    editor.getEditorState().read(() => {
      fullText = $getRoot().getTextContent();
    });
    const textBeforeCursor = fullText.slice(0, cursorRef.current);
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
          // Transitioning to text mode
          if (textRef.current) textRef.current.textContent = 'Da She is writing...';
        } else {
          // Stream reasoning as a ticker (last 30 chars)
          bufRef.current = (bufRef.current + t).slice(-30);
          if (textRef.current) textRef.current.textContent = bufRef.current;
        }
      },
      prompt,
      cursorRef.current
    );
    setStatus('');
    if (textRef.current) textRef.current.textContent = '';
    bufRef.current = '';
    countRef.current = 0;
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
