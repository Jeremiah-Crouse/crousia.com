// Compare May 15 archive vs May 16 archive vs current live state
import { $getRoot, $createParagraphNode, $createTextNode, LexicalEditor, ParagraphNode, TextNode } from 'lexical';
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import WebSocket from "ws";

const doc = new Y.Doc();
let gotTypes = false;

const provider = new WebsocketProvider(
  "ws://localhost:1234/ysl",
  "crousia-shared-room",
  doc,
  { WebSocketPolyfill: WebSocket }
);

function walkY(node) {
  if (!node) return '';
  const name = node.constructor?.name || '?';
  if (name === 'YXmlText') return node.toString();
  if (name === 'YXmlElement') {
    let s = '';
    if (node._children) {
      for (const c of node._children) s += walkY(c);
    }
    return s;
  }
  if (name === 'YXmlFragment' || node._length !== undefined) {
    return (node.toArray ? node.toArray() : []).map(c => walkY(c)).join('');
  }
  return '';
}

provider.on("sync", (synced) => {
  if (!synced || gotTypes) return;
  gotTypes = true;
  
  setTimeout(() => {
    // Get live state
    const root = doc.getXmlFragment("root");
    const liveText = walkY(root);
    console.log("LIVE:", liveText.length, "chars");
    
    process.exit(0);
  }, 2000);
});

setTimeout(() => { process.exit(1); }, 15000);
