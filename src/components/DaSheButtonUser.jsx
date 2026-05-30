import React, { useState, useRef } from 'react';
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $getSelection, $isRangeSelection, $isTextNode } from 'lexical';

export default function DaSheButtonUser() {
  const [editor] = useLexicalComposerContext();
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const textRef = useRef(null);
  const bufRef = useRef('');

  const handleClick = async () => {
    if (generating) return;

    let cursorInfo = null;
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const sel = $getSelection();
      if ($isRangeSelection(sel)) {
        const anchorNode = sel.anchor.getNode();
        const children = root.getChildren();
        let topLevelBlock = anchorNode;
        while (topLevelBlock && topLevelBlock.getParent() !== root) topLevelBlock = topLevelBlock.getParent();
        if (topLevelBlock) {
          const bi = children.indexOf(topLevelBlock);
          let bo = 0, found = false;
          (function walk(n) { if (found) return;
            if (n.is(anchorNode)) { bo += sel.anchor.offset; found = true; return; }
            if ($isTextNode(n)) { bo += n.getTextContentSize(); return; }
            if (n.getChildren) n.getChildren().forEach(walk);
          })(topLevelBlock);
          cursorInfo = { blockIndex: bi, blockOffset: bo };
        }
      }
    });

    setGenerating(true);
    bufRef.current = '';
    if (textRef.current) textRef.current.textContent = 'Thinking...';

    try {
      const res = await fetch('/api/da-she-daemon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cursorInfo || { blockIndex: 0, blockOffset: 0 }),
      });
      if (!res.ok) throw new Error(`Daemon error: ${res.status}`);

      // Read SSE stream for reasoning
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const chunk = JSON.parse(line.slice(6));
            if (chunk.delta) {
              if (chunk.type === 'reasoning') {
                bufRef.current = (bufRef.current + chunk.delta).slice(-30);
                if (textRef.current) textRef.current.textContent = bufRef.current;
              } else {
                if (textRef.current) textRef.current.textContent = 'Da She is writing...';
              }
            }
          } catch {}
        }
      }
      setStatus('Done');
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      setStatus('Error');
      setTimeout(() => setStatus(''), 3000);
    }
    setGenerating(false);
    if (textRef.current) textRef.current.textContent = '';
    bufRef.current = '';
  };

  return (
    <button onClick={handleClick} disabled={generating} style={{
      padding: '8px 16px', borderRadius: '4px', cursor: generating ? 'not-allowed' : 'pointer',
      background: generating ? '#2d1f0e' : '#ffb347', color: generating ? '#8a7a5a' : '#1a0f05',
      border: 'none', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit',
    }}>
      {generating ? <span ref={textRef} style={{color:'#ffb347'}}>{status||'...'}</span> : 'Summon Da She'}
    </button>
  );
}
