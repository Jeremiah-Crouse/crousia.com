// src/components/Editor.jsx
import React, { useMemo, useEffect, useContext } from "react";
import "./Editor.css";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { CollaborationPlugin } from "@lexical/react/LexicalCollaborationPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { TRANSFORMERS } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import {
  getSharedDoc,
  getSharedProvider,
  isAdmin,
  cleanupSharedState,
} from "../utils/collaboration";
import { UserContext } from "../context/UserContext";

import {
  $getSelection,
  $isRangeSelection,
  ParagraphNode,
  TextNode,
} from "lexical";

const USER_COLORS = {
  "King Jeremiah": "color: #FFD700",
  "Queen Lauren": "color: #A020F0",
};

// Sets the typing color before each keystroke — does NOT touch existing nodes,
// only affects characters about to be inserted.
import { $patchStyleText } from "@lexical/selection";

function AuthorColorPlugin({ username }) {
  const [editor] = useLexicalComposerContext();
  const color = USER_COLORS[username];

  useEffect(() => {
    if (!color) return;

    return editor.registerUpdateListener(() => {
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

export default function Editor() {
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
    ],
    theme: {
      paragraph: "editor-paragraph",
      text: {
        bold: "editor-bold",
        italic: "editor-italic",
      },
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
        <HistoryPlugin />
        <AutoSavePlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      </div>
    </LexicalComposer>
  );
}