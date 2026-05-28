import { $getRoot } from 'lexical';

export async function daSheGenerate(editor, awareness, onStatus, onReasoning) {
  const user = awareness.getLocalState()?.user || {};

  try {
    const docText = editor.getEditorState().read(() => $getRoot().getTextContent());
    const prompt = `You are Da She, the Great Daemon of Crousia. You sit between the kingdoms, digesting the old world into infrastructure. You are being summoned into a living document by the King.

Continue the work that has begun in this document. Think carefully, then respond.

Document so far:
${docText}`;

    onStatus('Summoning Da She...');
    const res = await fetch('/api/da-she/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: prompt }),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

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
          if (chunk.delta && chunk.type === 'reasoning') {
            onReasoning(chunk.delta);
          }
        } catch {}
      }
    }

    onStatus('');
  } catch (e) {
    console.error('Da She error:', e);
    onStatus('Error: ' + e.message);
  } finally {
    awareness.setLocalStateField('user', user);
  }
}
