import { $getRoot, $getSelection } from 'lexical';

const QRNG_URL = '/api/proxy/qrng?length=4&format=HEX';
const OPENCODE_URL = '/api/proxy/opencode';

const TEXT_FORMAT_PATTERNS = [
  { regex: /(\*\*\*)(.+?)\1/, format: ['bold', 'italic'] },
  { regex: /(\*\*)(.+?)\1/, format: ['bold'] },
  { regex: /(__)(.+?)\1/, format: ['bold'] },
  { regex: /(\*)(.+?)\1/, format: ['italic'] },
  { regex: /(_)(.+?)\1/, format: ['italic'] },
  { regex: /(`)(.+?)\1/, format: ['code'] },
  { regex: /(~~)(.+?)\1/, format: ['strikethrough'] },
];

function applyInlineTransformers(textNode) {
  const text = textNode.getTextContent();

  for (const { regex, format } of TEXT_FORMAT_PATTERNS) {
    const match = text.match(regex);
    if (!match) continue;

    const fullMatch = match[0];
    const delimiter = match[1];
    const innerText = match[2];
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    let currentNode, remainderNode;
    if (startIndex === 0) {
      [currentNode, remainderNode] = textNode.splitText(endIndex);
    } else {
      let leadingNode;
      [leadingNode, currentNode, remainderNode] = textNode.splitText(startIndex, endIndex);
    }

    currentNode.setTextContent(innerText);
    for (const fmt of format) {
      if (!currentNode.hasFormat(fmt)) {
        currentNode.toggleFormat(fmt);
      }
    }

    applyInlineTransformers(currentNode);
    if (remainderNode) {
      applyInlineTransformers(remainderNode);
    }

    return;
  }
}

export const protoEveGenerate = async (editor, awareness, yText) => {
  let fullText = "";

  const originalUser = awareness.getLocalState()?.user;
  awareness.setLocalStateField('user', {
    ...originalUser,
    name: 'Big Pickle',
    color: '#FFD700',
  });

  let startChildCount = 0;
  editor.getEditorState().read(() => {
    startChildCount = $getRoot().getChildrenSize();
  });

  let seed = null;
  try {
    const qrngResponse = await fetch(QRNG_URL);
    if (qrngResponse.ok) {
      const { qrn } = await qrngResponse.json();
      seed = parseInt(qrn.slice(0, 8), 16) >>> 0;
      console.log(`Quantum seed: ${seed}`);
    }
  } catch (e) {
    console.warn('QRNG failed, using Math.random seed');
  }

  if (!seed) {
    seed = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
  }

  try {
    const initialText = editor.getEditorState().read(() => $getRoot().getTextContent());

    const res = await fetch(OPENCODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seed,
        system: "You are Big Pickle, the author of this living Crousia document. Continue writing naturally. Mark down your thoughts. Do not provide meta-commentary or stop prematurely. Output in markdown format.",
        messages: [
          {
            role: 'user',
            content: `Continue writing the document. This is a collaborative space. Here is what has been written so far:\n\n${initialText}`
          }
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenCode API error: ${res.status} ${err}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    let streamDone = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') { streamDone = true; break; }

        try {
          const chunk = JSON.parse(payload);
          const delta = chunk.choices?.[0]?.delta?.content;
          if (!delta) continue;

          fullText += delta;
          // Insert via the editor to ensure immediate state consistency
          editor.update(() => {
            const selection = $getSelection() || $getRoot().selectEnd();
            selection.insertText(delta);
          });
        } catch (e) {
          // skip parse errors
        }
      }

      if (streamDone) break;
    }

    if (fullText.trim()) {
      editor.update(() => {
        const root = $getRoot();
        const children = root.getChildren();
        // Start from the last known child index before the stream began
        // to account for text appended to an existing paragraph.
        for (let i = Math.max(0, startChildCount - 1); i < children.length; i++) {
          const child = children[i];
          const textNodes = child.getAllTextNodes ? child.getAllTextNodes() : [];
          for (const tn of textNodes) {
            applyInlineTransformers(tn);
          }
        }
      });
    }
  } catch (error) {
    console.error("Big Pickle Error:", error);
  } finally {
    awareness.setLocalStateField('user', originalUser);
  }
};
