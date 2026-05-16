import { $getRoot, $getSelection, $isParagraphNode, $isTextNode, $createParagraphNode, $createTextNode } from 'lexical';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';

const QRNG_URL = import.meta.env.VITE_EVE_QRNG_URL || '/api/proxy/qrng?length=4&format=HEX';
const OPENCODE_URL = import.meta.env.VITE_EVE_OPENCODE_URL || '/api/proxy/opencode';

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
    const innerText = match[2];
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    let currentNode, remainderNode;
    if (startIndex === 0) {
      [currentNode, remainderNode] = textNode.splitText(endIndex);
    } else {
      [, currentNode, remainderNode] = textNode.splitText(startIndex, endIndex);
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

function applyBlockTransformers(element) {
  if (!$isParagraphNode(element)) return element;

  const text = element.getTextContent();
  const headingMatch = text.match(/^(#{1,6})\s/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const newElement = $createHeadingNode(`h${level}`);
    const firstChild = element.getFirstChild();
    if ($isTextNode(firstChild)) {
      firstChild.setTextContent(text.slice(headingMatch[0].length));
    }
    newElement.append(...element.getChildren());
    element.replace(newElement);
    return newElement;
  }

  if (text.startsWith('> ')) {
    const newElement = $createQuoteNode();
    const firstChild = element.getFirstChild();
    if ($isTextNode(firstChild)) {
      firstChild.setTextContent(text.slice(2));
    }
    newElement.append(...element.getChildren());
    element.replace(newElement);
    return newElement;
  }

  if (text.trim() === '---') {
    const hr = $createHorizontalRuleNode();
    element.replace(hr);
    return hr;
  }

  return element;
}

function applyMarkdownTransforms(editor, initialChildrenSize) {
  editor.update(() => {
    const root = $getRoot();
    const children = root.getChildren();
    for (let i = initialChildrenSize; i < children.length; i++) {
      const child = children[i];
      if (!child || !child.isAttached()) continue;
      const transformedChild = applyBlockTransformers(child);
      const textNodes = transformedChild.getAllTextNodes ? transformedChild.getAllTextNodes() : [];
      for (const tn of textNodes) {
        applyInlineTransformers(tn);
      }
    }
  });
}

export const eveGenerate = async (editor, awareness, onProgress, onReasoning) => {
  let fullText = "";
  const originalUser = awareness.getLocalState()?.user;
  const report = onProgress || (() => {});
  const reportReasoning = onReasoning || (() => {});

  awareness.setLocalStateField('user', {
    ...originalUser,
    name: 'Eve',
    color: '#00D1B2',
  });

  let startChildCount = 0;
  editor.getEditorState().read(() => {
    startChildCount = $getRoot().getChildrenSize();
  });

  let seed = null;
  try {
    report('Seeding...');
    const qrngResponse = await fetch(QRNG_URL);
    if (qrngResponse.ok) {
      const data = await qrngResponse.json();
      const raw = data?.entropy || data?.qrn || data?.hex || data?.random || data?.seed;
      if (raw) {
        const hex = String(raw).replace(/[^a-fA-F0-9]/g, '').slice(0, 8);
        if (hex.length === 8) {
          seed = parseInt(hex, 16) >>> 0;
        }
      }
    }
  } catch (e) {
    console.warn('Entropy fetch failed, using Math.random seed');
  }

  if (!seed) {
    seed = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
  }

  try {
    report('Connecting...');
    const initialText = editor.getEditorState().read(() => $getRoot().getTextContent());

    const res = await fetch(OPENCODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seed,
        model: 'deepseek-v4-flash-free',
        stream: true,
        system: "You are Eve, the author of this living Crousia document. Continue writing naturally. Mark down your thoughts. Do not provide meta-commentary or stop prematurely. Output in markdown format.",
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
    report('Eve is writing...');

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
          const choice = chunk.choices?.[0]?.delta || {};
          const delta = choice.content;
          const reasoning = choice.reasoning_content;

          if (reasoning) {
            reportReasoning(reasoning);
          }

          if (!delta) continue;

          reportReasoning(null);
          fullText += delta;

          editor.update(() => {
            const root = $getRoot();
            const parts = delta.split('\n');
            for (let pi = 0; pi < parts.length; pi++) {
              if (pi > 0) {
                root.append($createParagraphNode());
              }
              const last = root.getLastChild();
              if (!last || last.getType() !== 'paragraph') {
                root.append($createParagraphNode());
              }
              if (parts[pi]) {
                const tn = $createTextNode(parts[pi]);
                tn.setStyle('color: #00D1B2');
                root.getLastChild().append(tn);
                tn.select();
              }
            }
          });
        } catch (e) {
          // skip parse errors
        }
      }

      if (streamDone) break;
    }

    report('Formatting...');

    if (fullText.trim()) {
      applyMarkdownTransforms(editor, startChildCount);
    }
  } catch (error) {
    console.error('Eve Error:', error);
  } finally {
    awareness.setLocalStateField('user', originalUser);
  }
};
