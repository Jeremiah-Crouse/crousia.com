// src/pages/Log.jsx
import React, { useEffect, useState } from 'react';
import { listArchives, getArchive } from '../utils/archive';
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ParagraphNode, TextNode } from "lexical";
import { ImageNode } from "../components/ImageNode";
import CrousianText from '../components/CrousianText';
import Comments from '../components/Comments';

function ArchiveEntry({ content }) {
  const json = typeof content === 'string' ? JSON.parse(content) : content;
  
  const initialConfig = {
    namespace: "CrousiaArchive",
    editable: false,
    nodes: [
      ParagraphNode,
      TextNode,
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      LinkNode,
      ImageNode,
    ],
    editorState: JSON.stringify(json),
    theme: {
      paragraph: "editor-paragraph",
      text: {
        gold: "text-gold",
        purple: "text-purple",
      },
      image: "editor-image",
    },
    onError(error) { console.error("Lexical error:", error); }
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <RichTextPlugin
        contentEditable={<ContentEditable className="editor-input" />}
        placeholder={<div></div>}
        ErrorBoundary={LexicalErrorBoundary}
      />
    </LexicalComposer>
  );
}

export default function Log() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  // Track which entries are expanded
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    async function fetchArchives() {
      try {
        const dates = await listArchives();
        const archives = await Promise.all(
          dates.map(async (date) => {
            const result = await getArchive(date);
            return { date, content: result?.content || null };
          })
        );
        setLogs(archives);
      } catch (e) {
        console.error('Failed to fetch archives:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchArchives();
  }, []);

  const toggleExpand = (date) => {
    setExpanded(prev => ({ ...prev, [date]: !prev[date] }));
  };

  if (loading) return <div className="container"><h1>THE ARCHIVE</h1><p>Loading...</p></div>;

  return (
    <div className="container">
      <CrousianText text="THE ARCHIVE" size={0.7} />
      {logs.length === 0 ? <p>No archives yet.</p> : (
        logs.map((log) => (
          <div key={log.date} className="archive-box">
            <h2 onClick={() => toggleExpand(log.date)} style={{ cursor: 'pointer' }}>
              {log.date} {expanded[log.date] ? '▼' : '▶'}
            </h2>
            {expanded[log.date] && (
              <div className="doc-content">
                {log.content && <ArchiveEntry content={log.content} />}
                <Comments date={log.date} readonly={true} />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
