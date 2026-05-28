import React, { useState, useRef } from 'react';
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $getSelection, $isRangeSelection, $isTextNode } from 'lexical';
import { $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { daSheGenerate } from '../utils/daSheService';
import * as Y from 'yjs';

export default function DaSheButton({ yText, awareness }) {
  const [editor] = useLexicalComposerContext();
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const textRef = useRef(null);
  const bufRef = useRef('');
  const countRef = useRef(0);

  function getYjsCursor() {
    const state = awareness.getLocalState();
    if (!state?.anchorPos) return null;
    const doc = yText.doc;
    if (!doc) return null;
    const absPos = Y.createAbsolutePositionFromRelativePosition(state.anchorPos, doc);
    if (!absPos) return null;
    let idx = 0;
    let cum = 0;
    let current = yText._start;
    while (current) {
      const typeNode = current.content?.type;
      if (typeNode instanceof Y.XmlText || typeNode instanceof Y.XmlElement) {
        const len = typeNode.length;
        if (absPos.index >= cum && absPos.index <= cum + len) {
          return { blockIndex: idx, blockOffset: absPos.index - cum };
        }
        cum += len;
      }
      idx++;
      current = current.right;
    }
    return null;
  }

  const hasCursor = editor.getEditorState().read(() => !!$getSelection());

  const handleClick = async () => {
    if (generating || !hasCursor) return;
    let textBeforeCursor = '';
    let yjsCursor = null;
    editor.getEditorState().read(() => {
      const fullText = $getRoot().getTextContent();
      const sel = $getSelection();
      if ($isRangeSelection(sel)) {
        const anchorNode = sel.anchor.getNode();
        const nodes = $getRoot().getChildren();
        let cum = 0;
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          const parent = anchorNode.getParent();
          if (node.is(anchorNode) || (parent && node.is(parent))) {
            if (node.is(anchorNode)) {
              cum += Math.min(sel.anchor.offset, node.getTextContentSize());
            } else {
              const descendants = node.getChildren ? node.getChildren() : [node];
              for (const desc of descendants) {
                if (desc.is(anchorNode)) {
                  cum += Math.min(sel.anchor.offset, desc.getTextContentSize());
                  break;
                }
                cum += desc.getTextContentSize();
              }
            }
            break;
          }
          cum += node.getTextContentSize();
          if (i < nodes.length - 1) cum += 1;
        }
        textBeforeCursor = fullText.slice(0, cum);
        yjsCursor = getYjsCursor();
      }
    });
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
      yjsCursor
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
