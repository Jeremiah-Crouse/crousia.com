import React, { useState, useRef, useEffect } from 'react';
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
  const cursorRef = useRef(0);

  useEffect(() => {
    const unreg = editor.registerUpdateListener(() => {
      editor.getEditorState().read(() => {
        const sel = $getSelection();
        if (!$isRangeSelection(sel)) return;

        const anchor = sel.anchor;
        const anchorNode = anchor.getNode();
        const nodes = $getRoot().getChildren();
        let cum = 0;

        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          // Check if the anchor node is this block or a descendant of this block
          const isAnchorHere = node.is(anchorNode) || (node.isParentOf && node.isParentOf(anchorNode));

          if (isAnchorHere) {
            // Walk descendants of this block to find exact character offset
            const descendants = node.getChildren ? node.getChildren() : [node];
            for (const desc of descendants) {
              if (desc.is(anchorNode)) {
                cum += anchor.offset;
                break;
              }
              cum += desc.getTextContentSize();
            }
            break;
          }

          const nodeLen = node.getTextContentSize();
          cum += nodeLen;
          // Account for the \n that getTextContent() adds between blocks
          if (i < nodes.length - 1) cum += 1;
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
