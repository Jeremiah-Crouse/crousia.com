export async function daSheGenerate(editor, awareness, onStatus, onReasoning, prompt = '', cursor = null) {
  const user = awareness.getLocalState()?.user || {};

  try {
    onStatus('Summoning Da She...');
    const res = await fetch('/api/da-she/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: prompt, cursor: cursor instanceof Uint8Array ? Array.from(cursor) : cursor }),
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
          if (chunk.delta) {
            if (chunk.type === 'reasoning') {
              onReasoning(chunk.delta);
            } else {
              // Transition: actual text has started, clear reasoning display
              onReasoning(null); 
            }
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
