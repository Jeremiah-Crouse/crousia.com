// src/pages/Log.jsx
import React, { useEffect, useState, useRef } from 'react';
import { listArchives, getArchive } from '../utils/archive';
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { ParagraphNode, TextNode } from "lexical";
import { ImageNode } from "../components/ImageNode";
import CrousianText from '../components/CrousianText';
import Comments from '../components/Comments';
import '../components/Editor.css';

function PageTabs({ headings, activeIndex, onSelect }) {
  if (!headings || headings.length === 0) {
    return (
      <div className="page-tabs-sticky">
        <button className="page-tab active">Full</button>
      </div>
    );
  }
  
  if (headings.length <= 1) return null;
  
  return (
    <div className="page-tabs-sticky">
      {headings.map((label, i) => (
        <button
          key={i}
          className={`page-tab ${activeIndex === i ? 'active' : ''}`}
          onClick={() => onSelect(i)}
        >
          {label || `Section ${i + 1}`}
        </button>
      ))}
    </div>
  );
}

function ArchiveEntry({ content, dateKey, onH2Found }) {
  const json = typeof content === 'string' ? JSON.parse(content) : content;
  
  useEffect(() => {
    if (!onH2Found || !json?.root?.children) return;
    
    const h2s = [];
    const traverse = (nodes) => {
      for (const node of nodes) {
        if (node.type === 'heading' && node.tag === 'h2') {
          const text = node.children?.[0]?.text || '';
          if (text) h2s.push(text.substring(0, 30));
        }
        if (node.children) traverse(node.children);
      }
    };
    traverse(json.root.children);
    onH2Found(h2s);
  }, [content]);
  
  const initialConfig = {
    namespace: "Crousia" + (dateKey || ''),
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
      HorizontalRuleNode,
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
    <LexicalComposer key={dateKey} initialConfig={initialConfig}>
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
  const [selectedDate, setSelectedDate] = useState(null);
  const [pageHeadings, setPageHeadings] = useState([]);
  const [activePage, setActivePage] = useState(0);

  useEffect(() => {
    async function fetchArchives() {
      try {
        const dates = await listArchives();
        const archives = await Promise.all(
          dates.map(async (date) => {
            const result = await getArchive(date);
            return { date, content: result || null };
          })
        );
        setLogs(archives);
        if (dates.length > 0) setSelectedDate(dates[0]);
      } catch (e) {
        console.error('Failed to fetch archives:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchArchives();
  }, []);

  const scrollToPage = (index) => {
    const editorEl = document.querySelector('.doc-content .editor-input');
    if (!editorEl) return;
    
    const h2s = editorEl.querySelectorAll('h2');
    
    if (h2s[index]) {
      const target = h2s[index];
      const editorRect = editorEl.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const scrollTop = editorEl.scrollTop + targetRect.top - editorRect.top;
      editorEl.scrollTop = scrollTop;
    } else if (index === 0) {
      editorEl.scrollTop = 0;
    }
  };

  const getCurrentPage = () => {
    const editorEl = document.querySelector('.doc-content .editor-input');
    if (!editorEl) return;
    
    const editorRect = editorEl.getBoundingClientRect();
    const h2s = editorEl.querySelectorAll('h2');
    
    for (let i = 0; i < h2s.length; i++) {
      const h2 = h2s[i];
      const h2Rect = h2.getBoundingClientRect();
      
      if (h2Rect.top >= editorRect.top && h2Rect.top < editorRect.top + 100) {
        if (activePage !== i) setActivePage(i);
        return;
      }
    }
    
    for (let i = 0; i < h2s.length - 1; i++) {
      const h2 = h2s[i];
      const nextH2 = h2s[i + 1];
      const nextRect = nextH2.getBoundingClientRect();
      
      if (nextRect.top > editorRect.top + 50) {
        if (activePage !== i) setActivePage(i);
        return;
      }
    }
  };

  useEffect(() => {
    const editorEl = document.querySelector('.doc-content .editor-input');
    if (!editorEl) return;
    
    const handleScroll = () => getCurrentPage();
    editorEl.addEventListener('scroll', handleScroll);
    return () => editorEl.removeEventListener('scroll', handleScroll);
  }, [pageHeadings, activePage]);

  if (loading) return <div className="container"><CrousianText text="The Archive" size={0.7} /><p>Loading...</p></div>;

  const selectedLog = logs.find(l => l.date === selectedDate);

  return (
    <div className="container">
      <CrousianText text="The Archive" size={0.7} />
      
      <div className="page-tabs-sticky">
        {logs.map((log) => (
          <button
            key={log.date}
            className={`page-tab ${selectedDate === log.date ? 'active' : ''}`}
            onClick={() => {
              setSelectedDate(log.date);
              setActivePage(0);
            }}
            disabled={!log.content}
          >
            {log.date}
          </button>
        ))}
      </div>

      {selectedLog?.content ? (
        <div className="doc-content">
          <PageTabs headings={pageHeadings} activeIndex={activePage} onSelect={scrollToPage} />
          <ArchiveEntry 
            content={selectedLog.content} 
            dateKey={selectedLog.date} 
            onH2Found={setPageHeadings}
          />
          <Comments date={selectedLog.date} readonly={true} />
        </div>
      ) : (
        <p>No entry for this date.</p>
      )}
    </div>
  );
}
