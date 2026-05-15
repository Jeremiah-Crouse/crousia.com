import { $getRoot, $getSelection, $isParagraphNode, $isTextNode } from 'lexical';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { pipeline, random, TextStreamer } from '@huggingface/transformers';

const QRNG_URL = import.meta.env.VITE_EVE_QRNG_URL || '/api/proxy/qrng?length=4&format=HEX';
const EVE_MODEL = import.meta.env.VITE_EVE_MODEL || 'Xenova/tiny-random-mistral';
const SYSTEM_TOKEN_BUDGET = 50;
const PROMPT_TOKEN_BUDGET = 50;
const MIN_NEW_TOKENS = 50;
const MAX_NEW_TOKENS = 100;

const EVE_SYSTEM_PROMPT =
  'Eve is a tiny local oracle. Continue the page in brief, strange, vivid fragments. No explanations, no summaries, no assistant disclaimers.';

let generatorPromise;

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

function getGenerator() {
  if (!generatorPromise) {
    generatorPromise = pipeline('text-generation', EVE_MODEL, {
      dtype: 'q8',
      device: 'wasm',
    });
  }
  return generatorPromise;
}

function extractEntropyHex(data) {
  const value = data?.qrn ?? data?.hex ?? data?.random ?? data?.seed ?? data?.value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value).toString(16).padStart(8, '0').slice(-8);
  }
  if (typeof value === 'string') {
    const hex = value.replace(/[^a-fA-F0-9]/g, '');
    return hex.length >= 8 ? hex.slice(0, 8) : null;
  }
  if (Array.isArray(value)) {
    const hex = value
      .map((byte) => Number(byte).toString(16).padStart(2, '0'))
      .join('');
    return hex.length >= 8 ? hex.slice(0, 8) : null;
  }
  return null;
}

async function getEntropySettings() {
  try {
    const response = await fetch(QRNG_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`QRNG responded with ${response.status}`);

    const data = await response.json();
    if (data?.source === 'local-fallback') {
      throw new Error('QRNG returned local fallback data');
    }

    const entropyHex = extractEntropyHex(data);
    if (!entropyHex) throw new Error('QRNG response did not include usable hex entropy');

    const seed = parseInt(entropyHex, 16) >>> 0;
    const temperature = 2 + (seed / 0xffffffff) * 0.5;
    return { ok: true, seed, temperature, entropyHex };
  } catch (error) {
    console.warn('Eve entropy failed; using seed 0 and temperature 0.1:', error);
    return { ok: false, seed: 0, temperature: 0.1, entropyHex: '00000000' };
  }
}

function sliceTokens(tokenizer, text, maxTokens, fromEnd = false) {
  const tokens = tokenizer.encode(text || '', { add_special_tokens: false });
  const sliced = fromEnd ? tokens.slice(-maxTokens) : tokens.slice(0, maxTokens);
  return sliced.length ? tokenizer.decode(sliced, { skip_special_tokens: true }) : '';
}

function buildPrompt(tokenizer, documentText) {
  const system = sliceTokens(tokenizer, EVE_SYSTEM_PROMPT, SYSTEM_TOKEN_BUDGET);
  const recent = sliceTokens(tokenizer, documentText, PROMPT_TOKEN_BUDGET, true);
  return `${system}\n${recent}`.trim();
}

function insertText(editor, text) {
  if (!text) return;
  editor.update(() => {
    const selection = $getSelection() || $getRoot().selectEnd();
    selection.insertText(text);
  });
}

function applyMarkdownTransforms(editor, initialChildrenSize) {
  editor.update(() => {
    const root = $getRoot();
    const startIndexForProcessing = Math.max(0, initialChildrenSize - 1);
    const childrenToProcess = root.getChildren();

    for (let i = childrenToProcess.length - 1; i >= startIndexForProcessing; i--) {
      const child = childrenToProcess[i];
      if (!child || !child.isAttached()) continue;

      const transformedChild = applyBlockTransformers(child);
      const textNodes = transformedChild.getAllTextNodes ? transformedChild.getAllTextNodes() : [];
      for (const textNode of textNodes) {
        applyInlineTransformers(textNode);
      }
    }
  });
}

export const eveGenerate = async (editor, awareness) => {
  let fullText = '';
  const originalUser = awareness.getLocalState()?.user;

  awareness.setLocalStateField('user', {
    ...originalUser,
    name: 'Eve',
    color: '#00D1B2',
  });

  let initialChildrenSize = 0;
  editor.getEditorState().read(() => {
    initialChildrenSize = $getRoot().getChildrenSize();
  });

  try {
    const generator = await getGenerator();
    const { seed, temperature, entropyHex, ok } = await getEntropySettings();
    random.seed(seed);

    const documentText = editor.getEditorState().read(() => $getRoot().getTextContent());
    const prompt = buildPrompt(generator.tokenizer, documentText);

    console.log(
      `Eve entropy ${ok ? 'ok' : 'fallback'}; seed=${seed}; entropy=${entropyHex}; temperature=${temperature.toFixed(3)}`,
    );

    const streamer = new TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (delta) => {
        fullText += delta;
        insertText(editor, delta);
      },
    });

    await generator(prompt, {
      min_new_tokens: MIN_NEW_TOKENS,
      max_new_tokens: MAX_NEW_TOKENS,
      do_sample: true,
      temperature,
      top_k: 50,
      streamer,
    });

    if (fullText.trim()) {
      applyMarkdownTransforms(editor, initialChildrenSize);
    }
  } catch (error) {
    console.error('Eve Error:', error);
  } finally {
    awareness.setLocalStateField('user', originalUser);
  }
};
