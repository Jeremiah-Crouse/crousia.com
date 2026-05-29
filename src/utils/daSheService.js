import { $getRoot, $createParagraphNode, $createTextNode, $getSelection, $isRangeSelection, $isTextNode } from 'lexical';

export async function daSheGenerate(editor, awareness, onStatus, onReasoning, prompt = '', cursor = null, textBeforeCursor = '') {
  const user = awareness.getLocalState()?.user || {};

  try {
    onStatus('Summoning Da She...');
    const res = await fetch('/api/da-she/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: prompt, cursor: cursor instanceof Uint8Array ? Array.from(cursor) : cursor, textBeforeCursor }),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let responseText = '';
    let initializedSelection = false;

    onStatus('Da She is thinking...');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') break;

        try {
          const chunk = JSON.parse(payload);
          if (chunk.delta) {
            if (chunk.type === 'reasoning') {
              onReasoning(chunk.delta);
            } else {
              responseText += chunk.delta;
              onReasoning(null);

              // Stream delta live into Lexical editor
              editor.update(() => {
                if (!initializedSelection && cursor) {
                  const root = $getRoot();
                  const children = root.getChildren();
                  const targetBlock = children[cursor.blockIndex];
                  if (targetBlock) {
                    let currentOffset = 0;
                    let found = false;

                    function selectAtOffset(node) {
                      if (found) return;
                      if ($isTextNode(node)) {
                        const len = node.getTextContentSize();
                        if (cursor.blockOffset >= currentOffset && cursor.blockOffset <= currentOffset + len) {
                          const nodeOffset = cursor.blockOffset - currentOffset;
                          node.select(nodeOffset, nodeOffset);
                          found = true;
                          return;
                        }
                        currentOffset += len;
                        return;
                      }
                      if (node.getChildren) {
                        const kids = node.getChildren();
                        for (const kid of kids) {
                          selectAtOffset(kid);
                          if (found) return;
                        }
                      }
                    }

                    selectAtOffset(targetBlock);
                    if (!found) {
                      targetBlock.select();
                    }
                  }
                  initializedSelection = true;
                }

                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                  selection.insertText(chunk.delta);
                }
              }, { tag: 'proto-eve' });
            }
          }
        } catch {}
      }
    }

    console.log('[da-she] Live Yjs stream insertion complete, response length:', responseText.length);
    onStatus('');
  } catch (e) {
    console.error('Da She error:', e);
    onStatus('Error: ' + e.message);
  } finally {
    awareness.setLocalStateField('user', user);
  }
}
