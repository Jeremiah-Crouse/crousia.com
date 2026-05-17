// src/components/Editor.jsx
import React, { useMemo, useEffect, useContext } from "react";
import "./Editor.css";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { CollaborationPlugin } from "@lexical/react/LexicalCollaborationPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { TRANSFORMERS, ELEMENT_TRANSFORMERS, TEXT_MATCH_TRANSFORMERS, TEXT_FORMAT_TRANSFORMERS } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ImageNode } from "./ImageNode";
import ImagePlugin from "./ImagePlugin";
import {
  getSharedDoc,
  getSharedProvider,
  isAdmin,
  cleanupSharedState,
} from "../utils/collaboration";
import { UserContext } from "../context/UserContext";
import { EveButton } from "./EveButton";
import { SummarizeButton } from "./SummarizeButton";

import {
  $getSelection,
  $isRangeSelection,
  $createTextNode,
  $createParagraphNode,
  $getRoot,
  ParagraphNode,
  TextNode,
} from "lexical";

import { HorizontalRuleNode, $createHorizontalRuleNode, $isHorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";

const USER_COLORS = {
  "King Jeremiah": "color: var(--gold)",
  "Queen Lauren": "color: #A020F0",
};

const HORIZONTAL_RULE_TRANSFORMER = {
  dependencies: [HorizontalRuleNode],
  export: (node) => {
    if (!$isHorizontalRuleNode(node)) return null;
    return "---";
  },
  regExp: /^(---)\s?$/,
  replace: (parentNode, _1, _2, isImport) => {
    const hr = $createHorizontalRuleNode();
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(hr);
    } else {
      parentNode.insertBefore(hr);
    }
    hr.selectNext();
  },
  type: "element",
};

const EM_DASH_TRANSFORMER = {
  dependencies: [],
  export: () => null,
  regExp: /-- $/,
  replace: (textNode, match) => {
    textNode.setTextContent("\u2014");
  },
  trigger: ' ',
  type: "text-match",
};

const ALL_TRANSFORMERS = [HORIZONTAL_RULE_TRANSFORMER, ...ELEMENT_TRANSFORMERS, ...TEXT_FORMAT_TRANSFORMERS, ...TEXT_MATCH_TRANSFORMERS, EM_DASH_TRANSFORMER];

// Sets the typing color before each keystroke — does NOT touch existing nodes,
// only affects characters about to be inserted.
import { $patchStyleText } from "@lexical/selection";

function AuthorColorPlugin({ username }) {
  const [editor] = useLexicalComposerContext();
  const color = USER_COLORS[username] || USER_COLORS["King Jeremiah"];

  useEffect(() => {
    if (!color) return;

    return editor.registerUpdateListener(({ tags }) => {
      if (tags.has('proto-eve')) return; // Don't interfere with Proto Eve
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        // Only set the *typing style* — doesn't touch any existing nodes
        selection.style = `color: ${color.replace("color: ", "")}`;
      });
    });
  }, [editor, color]);

  return null;
}

function AutoSavePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    let timeout;
    const save = () => {
      editor.getEditorState().read(() => {
        const json = editor.getEditorState().toJSON();
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
        fetch("/api/archive-today", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: JSON.stringify(json), date: today }),
        }).catch((err) => console.error("Save failed", err));
      });
    };
    return editor.registerUpdateListener(() => {
      clearTimeout(timeout);
      timeout = setTimeout(save, 2000);
    });
  }, [editor]);

  return null;
}

function PageTracker({ onH2Found }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!onH2Found || !editor) return;

    const extractHeadings = () => {
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const childCount = root.getChildrenSize();
        const h2s = [];
        
        for (let i = 0; i < childCount; i++) {
          const child = root.getChildAtIndex(i);
          if (!child) continue;
          
          if (child.getType?.() === 'heading' && child.getTag?.() === 'h2') {
            const text = child.getFirstChild?.()?.getTextContent?.() || '';
            if (text) h2s.push(text.substring(0, 30));
          }
        }
        
        onH2Found(h2s);
      });
    };

    extractHeadings();

    const remove = editor.registerUpdateListener(extractHeadings);
    return remove;
  }, [editor, onH2Found]);

  return null;
}

export default function Editor({ onH2Found }) {
  const { name: username } = useContext(UserContext) || {};
  const readonly = !isAdmin();

  useEffect(() => {
    return () => cleanupSharedState();
  }, []);

  const doc = useMemo(() => getSharedDoc(), []);
  const provider = useMemo(
    () => getSharedProvider({ readonly, username }),
    [readonly, username]
  );

  // Ensure we have access to the underlying YJS types for Proto Eve
  const { yText, awareness } = useMemo(() => ({
    yText: doc.getText("crousia-editor"),
    awareness: provider.awareness
  }), [doc, provider]);

  const initialConfig = {
    namespace: "CrousiaEditor",
    editable: !readonly,
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
    theme: {
      paragraph: "editor-paragraph",
      text: {
        bold: "editor-bold",
        italic: "editor-italic",
      },
      image: "editor-image",
    },
    onError(error) {
      console.error("Lexical error:", error);
    },
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="editor-container">
        <CollaborationPlugin
          id="crousia-editor"
          providerFactory={(id, yjsDocMap) => {
            yjsDocMap.set(id, doc);
            return provider;
          }}
          shouldBootstrap={true}
          username={username}
        />
        <AuthorColorPlugin username={username} />
        <RichTextPlugin
          contentEditable={<ContentEditable className="editor-input" />}
          placeholder={<div>Start writing...</div>}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <PageTracker onH2Found={onH2Found} />
        <HistoryPlugin />
        <AutoSavePlugin />
        {!readonly && (
          <div className="toolbar" style={{ borderBottom: 'none', marginBottom: 0, display: 'flex', alignItems: 'center' }}>
            <EveButton yText={yText} awareness={awareness} />
            <SummarizeButton />
          </div>
        )}
        <ImagePlugin isAdmin={!readonly} username={username} />
        <MarkdownShortcutPlugin transformers={ALL_TRANSFORMERS} />
      </div>
    </LexicalComposer>
  );
}
