import React, { useState } from 'react';
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import { $createHeadingNode } from '@lexical/rich-text';
import { $createHorizontalRuleNode, $isHorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";

const OPENCODE_URL = import.meta.env.VITE_EVE_OPENCODE_URL || '/api/proxy/opencode';

export function SummarizeButton() {
  const [editor] = useLexicalComposerContext();
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [status, setStatus] = useState('');

  const handleClick = async () => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    setStatus('Reading document...');

    try {
      const { textToSummarize } = editor.getEditorState().read(() => {
        const root = $getRoot();
        const children = root.getChildren();
        let lastHrIdx = -1;
        for (let i = 0; i < children.length; i++) {
          if ($isHorizontalRuleNode(children[i])) lastHrIdx = i;
        }
        if (lastHrIdx === -1) {
          return { textToSummarize: root.getTextContent().trim() };
        }
        let buf = '';
        for (let i = lastHrIdx + 1; i < children.length; i++) {
          buf += children[i].getTextContent() + '\n';
        }
        return { textToSummarize: buf.trim() };
      });

      if (!textToSummarize) {
        setStatus('Nothing to summarize');
        setTimeout(() => setStatus(''), 2000);
        setIsSummarizing(false);
        return;
      }

      setStatus('Summarizing...');

      const res = await fetch(OPENCODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-v4-flash-free',
          stream: true,
          seed: 0,
          temperature: 0.1,
          system: "You are a precise summarizer. Summarize the provided document into a single concise section (roughly 500 tokens). Output as markdown: start with a single ## heading, then a few short paragraphs. Do not include any meta-commentary, just the summary itself.",
          messages: [
            {
              role: 'user',
              content: `Summarize this document into roughly 500 tokens under a single ## heading:\n\n${textToSummarize}`
            }
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        setStatus(`Error: ${err.slice(0, 100)}`);
        setTimeout(() => setStatus(''), 3000);
        setIsSummarizing(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let summaryText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) summaryText += delta;
            } catch {}
          }
        }
      }

      if (!summaryText.trim()) {
        setStatus('Empty response');
        setTimeout(() => setStatus(''), 2000);
        setIsSummarizing(false);
        return;
      }

      editor.update(() => {
        const root = $getRoot();

        root.append($createHorizontalRuleNode());
        root.append($createParagraphNode());

        const lines = summaryText.split('\n');
        let i = 0;
        while (i < lines.length) {
          const line = lines[i].trim();

          if (line.startsWith('## ')) {
            const heading = $createHeadingNode('h2');
            heading.append($createTextNode(line.slice(3)));
            root.append(heading);
          } else if (line) {
            const p = $createParagraphNode();
            p.append($createTextNode(line));
            root.append(p);
          }
          i++;
        }
      });

      setStatus('Done');
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      setTimeout(() => setStatus(''), 3000);
    }

    setIsSummarizing(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isSummarizing}
      style={{
        marginLeft: 'auto',
        backgroundColor: isSummarizing ? '#333' : '#555',
        color: isSummarizing ? '#aaa' : '#fff',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'monospace',
        fontSize: '12px',
        border: '1px solid #777',
      }}
    >
      {isSummarizing ? (status || 'Summarizing...') : 'Summarize'}
    </button>
  );
}
